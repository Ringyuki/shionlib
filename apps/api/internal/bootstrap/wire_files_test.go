package bootstrap_test

import (
	"archive/zip"
	"bufio"
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"io"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"testing"
	"time"

	"github.com/gen2brain/webp"
	"golang.org/x/text/encoding/japanese"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/clamd"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/discimage"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/discimage/discimagetest"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/imaging"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/localfs"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/inspectionpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/scanpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/sevenzip"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/zipnames"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/download/downloadtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/inspection"
	"github.com/Ringyuki/shionlib/apps/api/internal/inspection/inspectiontest"
	"github.com/Ringyuki/shionlib/apps/api/internal/scan"
	"github.com/Ringyuki/shionlib/apps/api/internal/scan/scantest"
	"github.com/Ringyuki/shionlib/apps/api/internal/setting/settingtest"
)

const eicarMarker = "EICAR-STANDARD-ANTIVIRUS-TEST-FILE"

func serveClamd(t *testing.T) string {
	t.Helper()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = listener.Close() })
	answer := func(conn net.Conn) {
		defer func() { _ = conn.Close() }()
		reader := bufio.NewReader(conn)
		command, err := reader.ReadString(0)
		if err != nil {
			return
		}
		if command == "zVERSION\x00" {
			_, _ = conn.Write([]byte("ClamAV 1.4.3/27800/Wed Nov 26 09:30:45 2025\x00"))
			return
		}
		var stream bytes.Buffer
		for {
			var size [4]byte
			if _, err := io.ReadFull(reader, size[:]); err != nil {
				return
			}
			length := binary.BigEndian.Uint32(size[:])
			if length == 0 {
				break
			}
			if _, err := io.CopyN(&stream, reader, int64(length)); err != nil {
				return
			}
		}
		reply := "stream: OK\x00"
		if bytes.Contains(stream.Bytes(), []byte(eicarMarker)) {
			reply = "stream: Eicar-Test-Signature FOUND\x00"
		}
		_, _ = conn.Write([]byte(reply))
	}
	go func() {
		for {
			conn, err := listener.Accept()
			if err != nil {
				return
			}
			go answer(conn)
		}
	}()
	return listener.Addr().String()
}

type bucket map[string]string

func (b bucket) Fetch(_ context.Context, key, path string) error {
	source, stored := b[key]
	if !stored {
		return scan.ErrObjectMissing
	}
	content, err := os.ReadFile(source)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o750); err != nil {
		return err
	}
	return os.WriteFile(path, content, 0o600)
}

type checkLine struct {
	db          *pgtest.DB
	objects     bucket
	backfill    *scan.BackfillService
	scans       *scan.Service
	inspections *inspection.Service
	previews    *inspection.PreviewService
	visible     *inspectiontest.Resources
	events      *downloadtest.Recorder
	now         time.Time
}

func newCheckLine(t *testing.T, binary string) checkLine {
	t.Helper()
	db := pgtest.New(t)
	now := time.Date(2026, 10, 11, 12, 0, 0, 0, time.UTC)
	clock := func() time.Time { return now }
	tx := postgres.NewTransactor(db.Ent)
	archives := sevenzip.New(binary)
	scanner := clamd.New(clamd.Options{Address: serveClamd(t), Timeout: 5 * time.Second, LogDir: t.TempDir()})
	workspace := localfs.NewWorkspace(filepath.Join(t.TempDir(), "work"))
	inspectionRepo := inspectionpg.NewRepository(db.Ent)
	stored := inspectiontest.NewPreviewStore()
	visible := &inspectiontest.Resources{Visible: map[int][]int{}}
	events := &downloadtest.Recorder{}
	scans := scan.NewService(scan.Deps{
		Repo:        scanpg.NewRepository(db.Ent),
		Archives:    archives,
		Scanner:     scanner,
		Workspace:   workspace,
		Contents:    scan.NewContentService(scan.ContentDeps{Archives: archives, Names: zipnames.NewReader(), Discs: discimage.NewReader(), Workspace: workspace, Spool: &scantest.Spool{Room: 1 << 30}, Scanner: scanner}),
		Inspections: inspection.NewRecordService(inspectionRepo, stored, imaging.NewTranscoder(), tx, clock),
		Files:       scantest.NewMemoryRepository(clock),
		Activities:  events,
		Messages:    events,
		Banner:      &scantest.Banner{},
		Queue:       events,
		Tx:          tx,
		Settings:    settingtest.Source{},
		Options:     scan.Options{Enabled: true},
		Now:         clock,
	})
	objects := bucket{}
	return checkLine{
		db:          db,
		objects:     objects,
		backfill:    scan.NewBackfillService(scans, objects, &scantest.Spool{Room: 1 << 30}),
		scans:       scans,
		inspections: inspection.NewService(inspectionRepo, visible),
		previews:    inspection.NewPreviewService(inspectionRepo, visible, stored),
		visible:     visible,
		events:      events,
		now:         now,
	}
}

func (l checkLine) upload(t *testing.T, path string) (int, int) {
	t.Helper()
	ctx := context.Background()
	info, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	creator := l.db.User(t)
	resource := l.db.Ent.GameDownloadResource.Create().SetGameID(l.db.Game(t)).SetCreatorID(creator).SaveX(ctx)
	uploaded := l.db.Ent.GameDownloadResourceFile.Create().
		SetGameDownloadResourceID(resource.ID).
		SetType(download.FileTypeObjectStore).
		SetFileName(filepath.Base(path)).
		SetFilePath(path).
		SetFileSize(info.Size()).
		SetFileHash("b3").
		SetFileStatus(download.FileOnServer).
		SetCreatorID(creator).
		SaveX(ctx)
	return resource.ID, uploaded.ID
}

func sevenZip(t *testing.T) string {
	t.Helper()
	for _, name := range []string{"7zz", "7z"} {
		if _, err := exec.LookPath(name); err == nil {
			return name
		}
	}
	t.Skip("7-Zip is not installed")
	return ""
}

func pack(t *testing.T, binary, dir, name string, files map[string][]byte) string {
	t.Helper()
	source := filepath.Join(dir, "source")
	for file, content := range files {
		path := filepath.Join(source, filepath.FromSlash(file))
		if err := os.MkdirAll(filepath.Dir(path), 0o750); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, content, 0o600); err != nil {
			t.Fatal(err)
		}
	}
	target := filepath.Join(dir, name)
	cmd := exec.CommandContext(t.Context(), binary, "a", target, "Game")
	cmd.Dir = source
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("create %s: %v\n%s", name, err, out)
	}
	return target
}

func shiftJIS(t *testing.T, text string) []byte {
	t.Helper()
	data, err := japanese.ShiftJIS.NewEncoder().Bytes([]byte(text))
	if err != nil {
		t.Fatal(err)
	}
	return data
}

func picture(t *testing.T, width, height int) []byte {
	t.Helper()
	img := image.NewNRGBA(image.Rect(0, 0, width, height))
	for y := range height {
		for x := range width {
			img.Set(x, y, color.NRGBA{R: uint8(x), G: uint8(y), B: 128, A: 255})
		}
	}
	var out bytes.Buffer
	if err := png.Encode(&out, img); err != nil {
		t.Fatal(err)
	}
	return out.Bytes()
}

func legacyBonus(t *testing.T) []byte {
	t.Helper()
	var out bytes.Buffer
	writer := zip.NewWriter(&out)
	for _, entry := range []struct{ name, content string }{{"特典/セットアップ.exe", "MZ bonus"}, {"特典/特典について.txt", "bonus notes"}} {
		header := &zip.FileHeader{Name: string(shiftJIS(t, entry.name)), NonUTF8: true, Method: zip.Deflate}
		file, err := writer.CreateHeader(header)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := file.Write([]byte(entry.content)); err != nil {
			t.Fatal(err)
		}
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	return out.Bytes()
}

func listed(t *testing.T, line checkLine, inspectionID int, parent *int) []inspection.Entry {
	t.Helper()
	entries, _, err := line.inspections.Children(context.Background(), actor.Actor{}, inspectionID, parent, inspection.Page{Number: 1, Size: inspection.MaxPageSize})
	if err != nil {
		t.Fatal(err)
	}
	return entries
}

func named(entries []inspection.Entry) []string {
	out := make([]string, len(entries))
	for i, entry := range entries {
		out[i] = string(entry.Kind) + " " + entry.Name
	}
	return out
}

func TestACheckedUploadCanBeBrowsedAndPreviewed(t *testing.T) {
	binary := sevenZip(t)
	line := newCheckLine(t, binary)
	readme := shiftJIS(t, "このファイルは説明書です。インストール方法を記載しています。")
	archive := pack(t, binary, t.TempDir(), "game.7z", map[string][]byte{
		"Game/game.exe":         []byte("MZ game"),
		"Game/readme.txt":       readme,
		"Game/data/voice.xp3":   bytes.Repeat([]byte("v"), 4096),
		"Game/manual/cover.png": picture(t, 64, 48),
		"Game/特典.zip":           legacyBonus(t),
	})
	resourceID, fileID := line.upload(t, archive)
	ctx := context.Background()
	if err := line.scans.ScanPending(ctx); err != nil {
		t.Fatal(err)
	}

	row := line.db.Ent.GameDownloadResourceFile.GetX(ctx, fileID)
	raw, err := os.ReadFile(archive)
	if err != nil {
		t.Fatal(err)
	}
	digest := sha256.Sum256(raw)
	if row.FileCheckStatus != int(download.CheckOK) || row.InspectionID == nil || row.FileSha256 == nil || *row.FileSha256 != hex.EncodeToString(digest[:]) {
		t.Fatalf("unexpected file row %+v", row)
	}
	if jobs := line.events.Jobs(); len(jobs) != 1 || jobs[0] != (download.StoreFile{FileID: fileID}) {
		t.Fatalf("the file goes on to be stored: %+v", jobs)
	}

	line.visible.Visible[resourceID] = []int{*row.InspectionID}
	views, err := line.inspections.OfResource(ctx, actor.Actor{}, resourceID)
	if err != nil || len(views) != 1 {
		t.Fatalf("views: %+v %v", views, err)
	}
	found := views[0]
	if found.Status != inspection.StatusReady || found.Archive.Format != "7z" || !found.Verified || found.Truncated {
		t.Fatalf("unexpected inspection %+v", found.Inspection)
	}
	if found.Totals.Files != 5 || found.Totals.Folders != 3 || found.Totals.Discs != 0 {
		t.Fatalf("unexpected totals %+v", found.Totals)
	}
	signatures := time.Date(2025, 11, 26, 9, 30, 45, 0, time.UTC)
	if found.Scan.Engine != "ClamAV 1.4.3" || found.Scan.SignaturesAt == nil || !found.Scan.SignaturesAt.Equal(signatures) || found.Scan.Scanned != 2 || found.Scan.At == nil || !found.Scan.At.Equal(line.now) || len(found.Scan.Detections) != 0 {
		t.Fatalf("unexpected scan %+v", found.Scan)
	}

	top := listed(t, line, found.ID, nil)
	if !slices.Equal(named(top), []string{"folder Game"}) || top[0].Items != 5 || top[0].Children != 5 {
		t.Fatalf("unexpected top level %+v", top)
	}
	game := listed(t, line, found.ID, &top[0].ID)
	if !slices.Equal(named(game), []string{"folder data", "folder manual", "file game.exe", "file readme.txt", "archive 特典.zip"}) {
		t.Fatalf("unexpected game folder %v", named(game))
	}
	if game[3].Modified == nil || game[3].Preview != inspection.PreviewText || game[3].Size != int64(len(readme)) {
		t.Fatalf("unexpected readme %+v", game[3])
	}
	bonus := listed(t, line, found.ID, &game[4].ID)
	if !slices.Equal(named(bonus), []string{"folder 特典"}) || game[4].Items != 2 || game[4].Unreadable {
		t.Fatalf("unexpected nested archive %+v %v", game[4], named(bonus))
	}
	inner := listed(t, line, found.ID, &bonus[0].ID)
	if !slices.Equal(named(inner), []string{"file セットアップ.exe", "file 特典について.txt"}) || inner[1].Preview != inspection.PreviewText {
		t.Fatalf("unexpected nested entries %+v", inner)
	}
	matches, total, err := line.inspections.Search(ctx, actor.Actor{}, found.ID, "exe", inspection.Page{Number: 1, Size: 10})
	if err != nil || total != 2 || matches[0].Location != "Game" || matches[1].Location != "Game/特典.zip/特典" {
		t.Fatalf("search: %+v %d %v", matches, total, err)
	}

	text, err := line.previews.Text(ctx, actor.Actor{}, game[3].ID)
	if err != nil || !bytes.Equal(text.Data, readme) || text.Encoding != inspection.EncodingShiftJIS {
		t.Fatalf("text preview: %+v %v", text, err)
	}
	if notes, err := line.previews.Text(ctx, actor.Actor{}, inner[1].ID); err != nil || string(notes.Data) != "bonus notes" {
		t.Fatalf("a file inside the nested archive is previewed with its own bytes: %+v %v", notes, err)
	}
	manual := listed(t, line, found.ID, &game[1].ID)
	if len(manual) != 1 || manual[0].Preview != inspection.PreviewImage {
		t.Fatalf("unexpected manual folder %+v", manual)
	}
	shown, err := line.previews.Image(ctx, actor.Actor{}, manual[0].ID)
	if err != nil {
		t.Fatal(err)
	}
	if decoded, err := webp.Decode(bytes.NewReader(shown)); err != nil || decoded.Bounds().Dx() != 64 || decoded.Bounds().Dy() != 48 {
		t.Fatalf("the image preview is a WebP of the same size: %v", err)
	}
}

func TestAHeldUploadKeepsWhatWasDetectedUntilItIsCleared(t *testing.T) {
	binary := sevenZip(t)
	line := newCheckLine(t, binary)
	archive := pack(t, binary, t.TempDir(), "patch.zip", map[string][]byte{
		"Game/patch.exe": []byte("MZ " + eicarMarker),
		"Game/clean.dll": []byte("MZ clean"),
	})
	resourceID, fileID := line.upload(t, archive)
	ctx := context.Background()
	if err := line.scans.ScanPending(ctx); err != nil {
		t.Fatal(err)
	}
	row := line.db.Ent.GameDownloadResourceFile.GetX(ctx, fileID)
	if row.FileCheckStatus != int(download.CheckHarmfulPendingReview) || row.InspectionID == nil {
		t.Fatalf("unexpected file row %+v", row)
	}
	line.visible.Visible[resourceID] = []int{*row.InspectionID}
	views, err := line.inspections.OfResource(ctx, actor.Actor{}, resourceID)
	if err != nil || len(views) != 1 {
		t.Fatalf("views: %+v %v", views, err)
	}
	want := []inspection.Detection{{Path: "Game/patch.exe", Signature: "Eicar-Test-Signature"}}
	if !slices.Equal(views[0].Scan.Detections, want) || views[0].Scan.Scanned != 2 || views[0].Scan.ClearedAt != nil {
		t.Fatalf("unexpected scan %+v", views[0].Scan)
	}
	cases, total, err := line.scans.List(ctx, scan.ListFilter{ResourceID: resourceID, SortBy: "created"}, scan.Page{Number: 1, Size: 10})
	if err != nil || total != 1 {
		t.Fatalf("cases: %+v %v", cases, err)
	}
	if _, err := line.scans.Review(ctx, actor.Actor{UserID: row.CreatorID, Role: actor.RoleAdmin}, cases[0].ID, scan.ReviewInput{Decision: scan.DecisionAllow}); err != nil {
		t.Fatal(err)
	}
	cleared, err := line.inspections.OfResource(ctx, actor.Actor{}, resourceID)
	if err != nil || cleared[0].Scan.ClearedAt == nil || !cleared[0].Scan.ClearedAt.Equal(line.now) {
		t.Fatalf("cleared: %+v %v", cleared, err)
	}
	if released := line.db.Ent.GameDownloadResourceFile.GetX(ctx, fileID); released.FileCheckStatus != int(download.CheckOK) || !released.IsVirusFalsePositive {
		t.Fatalf("unexpected released file %+v", released)
	}
}

func TestDiscImagesInsideAnUploadAreReadLikeFolders(t *testing.T) {
	binary := sevenZip(t)
	line := newCheckLine(t, binary)
	disc := discimagetest.Build(discimagetest.Options{Label: "Annaffiare"},
		discimagetest.File{Path: "Game/データ.dat", Data: bytes.Repeat([]byte("d"), 3000)},
		discimagetest.File{Path: "setup.exe", Data: []byte("MZ setup")},
		discimagetest.File{Path: "readme.txt", Data: []byte("read me first")},
	)
	frames := len(disc) / discimagetest.Sector
	mixed := append(discimagetest.Raw(disc, 2352, 16), make([]byte, 2352*450)...)
	cue := fmt.Sprintf("FILE \"DISC1.bin\" BINARY\r\n  TRACK 01 MODE1/2352\r\n    INDEX 01 00:00:00\r\n  TRACK 02 AUDIO\r\n    INDEX 01 %02d:%02d:%02d\r\n", frames/4500, frames/75%60, frames%75)
	bonus := discimagetest.Build(discimagetest.Options{Label: "Bonus"}, discimagetest.File{Path: "wallpaper.png", Data: picture(t, 32, 24)})
	archive := pack(t, binary, t.TempDir(), "game.7z", map[string][]byte{
		"Game/DISC1.bin":  mixed,
		"Game/DISC1.cue":  []byte(cue),
		"Game/BONUS.iso":  bonus,
		"Game/data.bin":   []byte("not an image"),
		"Game/readme.txt": []byte("outer"),
	})
	resourceID, fileID := line.upload(t, archive)
	ctx := context.Background()
	if err := line.scans.ScanPending(ctx); err != nil {
		t.Fatal(err)
	}
	row := line.db.Ent.GameDownloadResourceFile.GetX(ctx, fileID)
	if row.FileCheckStatus != int(download.CheckOK) || row.InspectionID == nil {
		t.Fatalf("unexpected file row %+v", row)
	}
	line.visible.Visible[resourceID] = []int{*row.InspectionID}
	views, err := line.inspections.OfResource(ctx, actor.Actor{}, resourceID)
	if err != nil || len(views) != 1 {
		t.Fatalf("views: %+v %v", views, err)
	}
	found := views[0]
	if found.Totals.Files != 5 || found.Totals.Folders != 1 || found.Totals.Discs != 2 || found.Totals.DiscFiles != 5 || found.Scan.Scanned != 1 {
		t.Fatalf("unexpected totals %+v scan %+v", found.Totals, found.Scan)
	}
	if len(found.Discs) != 2 {
		t.Fatalf("unexpected disc images %+v", found.Discs)
	}
	byName := map[string]inspection.Entry{}
	for _, image := range found.Discs {
		byName[image.Name] = image
	}
	first := byName["DISC1.bin"]
	if first.Unreadable || first.Detail.Format != "iso9660+joliet" || first.Detail.Label != "Annaffiare" || first.Detail.Files != 3 || first.Detail.Folders != 1 || !slices.Equal(first.Detail.Signals, []string{"audio"}) {
		t.Fatalf("unexpected first image %+v", first)
	}
	if second := byName["BONUS.iso"]; second.Unreadable || second.Detail.Label != "Bonus" || second.Detail.Files != 1 || len(second.Detail.Signals) != 0 {
		t.Fatalf("unexpected second image %+v", second)
	}
	inside := listed(t, line, found.ID, &first.ID)
	if !slices.Equal(named(inside), []string{"folder Game", "file readme.txt", "file setup.exe", "track Track 02"}) {
		t.Fatalf("unexpected entries of the image %v", named(inside))
	}
	if track := inside[3]; track.Detail.Track != 2 || track.Detail.Seconds != 6 || track.Size != 2352*450 {
		t.Fatalf("unexpected track %+v", track)
	}
	if inside[1].Preview != inspection.PreviewText {
		t.Fatalf("a text file inside the image is kept for preview: %+v", inside[1])
	}
	if text, err := line.previews.Text(ctx, actor.Actor{}, inside[1].ID); err != nil || string(text.Data) != "read me first" {
		t.Fatalf("text inside the image: %+v %v", text, err)
	}
	deeper := listed(t, line, found.ID, &inside[0].ID)
	if !slices.Equal(named(deeper), []string{"file データ.dat"}) || deeper[0].Size != 3000 {
		t.Fatalf("unexpected folder inside the image %+v", deeper)
	}
	matches, _, err := line.inspections.Search(ctx, actor.Actor{}, found.ID, "setup", inspection.Page{Number: 1, Size: 10})
	if err != nil || len(matches) != 1 || matches[0].Location != "Game/DISC1.bin" {
		t.Fatalf("search: %+v %v", matches, err)
	}
	wallpaper := listed(t, line, found.ID, ptr(byName["BONUS.iso"].ID))
	if len(wallpaper) != 1 || wallpaper[0].Preview != inspection.PreviewImage {
		t.Fatalf("unexpected bonus image %+v", wallpaper)
	}
}

func ptr[T any](value T) *T {
	return &value
}

func (l checkLine) publish(t *testing.T, path string, downloads int) (int, int) {
	t.Helper()
	ctx := context.Background()
	info, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	creator := l.db.User(t)
	resource := l.db.Ent.GameDownloadResource.Create().SetGameID(l.db.Game(t)).SetCreatorID(creator).SetDownloads(downloads).SetPublishedAt(l.now).SaveX(ctx)
	key := fmt.Sprintf("games/%d/%s", resource.ID, filepath.Base(path))
	stored := l.db.Ent.GameDownloadResourceFile.Create().
		SetGameDownloadResourceID(resource.ID).
		SetType(download.FileTypeObjectStore).
		SetFileName(filepath.Base(path)).
		SetS3FileKey(key).
		SetFileSize(info.Size()).
		SetFileHash("legacy").
		SetFileStatus(download.FileInObjectStore).
		SetFileCheckStatus(int(download.CheckOK)).
		SetCreatorID(creator).
		SaveX(ctx)
	l.objects[key] = path
	return resource.ID, stored.ID
}

func TestFilesPublishedBeforeAreInspectedFromTheBucket(t *testing.T) {
	binary := sevenZip(t)
	line := newCheckLine(t, binary)
	clean := pack(t, binary, t.TempDir(), "game.7z", map[string][]byte{
		"Game/game.exe":   []byte("MZ game"),
		"Game/readme.txt": []byte("read me"),
	})
	flagged := pack(t, binary, t.TempDir(), "patch.zip", map[string][]byte{"Game/patch.exe": []byte("MZ " + eicarMarker)})
	quietID, quietFile := line.publish(t, clean, 3)
	popularID, popularFile := line.publish(t, flagged, 900)
	goneID, goneFile := line.publish(t, clean, 1)
	delete(line.objects, fmt.Sprintf("games/%d/game.7z", goneID))
	ctx := context.Background()

	outcomes := map[int]scan.BackfillOutcome{}
	var order []int
	var seen []int
	for {
		done, found, err := line.backfill.Next(ctx, seen)
		if err != nil {
			t.Fatal(err)
		}
		if !found {
			break
		}
		seen = append(seen, done.ResourceID)
		order = append(order, done.ResourceID)
		outcomes[done.ResourceID] = done.Units[0].Outcome
	}
	if !slices.Equal(order, []int{popularID, quietID, goneID}) {
		t.Fatalf("resources are taken by downloads: %v", order)
	}
	if outcomes[popularID] != scan.BackfillHeld || outcomes[quietID] != scan.BackfillInspected || outcomes[goneID] != scan.BackfillMissing {
		t.Fatalf("unexpected outcomes %v", outcomes)
	}

	inspected := line.db.Ent.GameDownloadResourceFile.GetX(ctx, quietFile)
	raw, err := os.ReadFile(clean)
	if err != nil {
		t.Fatal(err)
	}
	digest := sha256.Sum256(raw)
	if inspected.FileStatus != download.FileInObjectStore || inspected.FileCheckStatus != int(download.CheckOK) || inspected.InspectionID == nil || inspected.FileSha256 == nil || *inspected.FileSha256 != hex.EncodeToString(digest[:]) {
		t.Fatalf("unexpected inspected file %+v", inspected)
	}
	line.visible.Visible[quietID] = []int{*inspected.InspectionID}
	top := listed(t, line, *inspected.InspectionID, nil)
	if !slices.Equal(named(top), []string{"folder Game"}) {
		t.Fatalf("unexpected listing %v", named(top))
	}
	inside := listed(t, line, *inspected.InspectionID, &top[0].ID)
	if !slices.Equal(named(inside), []string{"file game.exe", "file readme.txt"}) || inside[1].Preview != inspection.PreviewText {
		t.Fatalf("unexpected entries %+v", inside)
	}

	held := line.db.Ent.GameDownloadResourceFile.GetX(ctx, popularFile)
	if held.FileStatus != download.FileInObjectStore || held.FileCheckStatus != int(download.CheckHarmfulPendingReview) || held.InspectionID == nil {
		t.Fatalf("unexpected held file %+v", held)
	}
	cases, total, err := line.scans.List(ctx, scan.ListFilter{ResourceID: popularID, SortBy: "created"}, scan.Page{Number: 1, Size: 10})
	if err != nil || total != 1 || cases[0].Status != scan.CasePending {
		t.Fatalf("cases: %+v %v", cases, err)
	}

	if gone := line.db.Ent.GameDownloadResourceFile.GetX(ctx, goneFile); gone.InspectionID != nil || gone.FileSha256 != nil {
		t.Fatalf("a file the bucket does not hold is left as it was: %+v", gone)
	}
}
