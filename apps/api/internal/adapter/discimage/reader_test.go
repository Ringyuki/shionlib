package discimage_test

import (
	"bytes"
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"

	"golang.org/x/text/encoding/japanese"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/discimage"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/discimage/discimagetest"
	"github.com/Ringyuki/shionlib/apps/api/internal/scan"
)

var _ scan.DiscReader = (*discimage.Reader)(nil)

var gameFiles = []discimagetest.File{
	{Path: "Game/ゲーム本体.exe", Data: []byte("MZ game")},
	{Path: "Game/data/voice.xp3", Data: bytes.Repeat([]byte("v"), 5000)},
	{Path: "setup.exe", Data: []byte("MZ setup")},
	{Path: "readme.txt", Data: []byte("read me")},
}

func stored(t *testing.T, name string, content []byte) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), name)
	if err := os.WriteFile(path, content, 0o600); err != nil {
		t.Fatal(err)
	}
	return path
}

func probe(t *testing.T, path string) scan.DiscVolume {
	t.Helper()
	volume, err := discimage.NewReader().Probe(context.Background(), path)
	if err != nil {
		t.Fatal(err)
	}
	return volume
}

func TestProbeReadsAStandardImage(t *testing.T) {
	image := discimagetest.Build(discimagetest.Options{Label: "Annaffiare"}, gameFiles...)
	got := probe(t, stored(t, "game.iso", image))
	want := scan.DiscVolume{Readable: true, Format: discimage.FormatJoliet, Label: "Annaffiare", Bytes: int64(len(image))}
	if got != want {
		t.Fatalf("got %+v want %+v", got, want)
	}
}

func TestProbeReadsTheLabelOfAnImageWithoutJoliet(t *testing.T) {
	label, err := japanese.ShiftJIS.NewEncoder().Bytes([]byte("恋咲く都"))
	if err != nil {
		t.Fatal(err)
	}
	japaneseLabel := discimagetest.Build(discimagetest.Options{PrimaryOnly: true, RawLabel: label}, gameFiles...)
	if got := probe(t, stored(t, "a.iso", japaneseLabel)); got.Format != discimage.FormatISO || got.Label != "恋咲く都" {
		t.Fatalf("unexpected volume %+v", got)
	}
	plain := discimagetest.Build(discimagetest.Options{PrimaryOnly: true, Label: "testdisc"}, gameFiles...)
	if got := probe(t, stored(t, "b.iso", plain)); got.Label != "TESTDISC" {
		t.Fatalf("unexpected volume %+v", got)
	}
}

func TestProbeRecognisesRawSectorsAndCookRestoresThem(t *testing.T) {
	image := discimagetest.Build(discimagetest.Options{Label: "GAME"}, gameFiles...)
	withLead := append(make([]byte, 307200), image...)
	for name, tc := range map[string]struct {
		content    []byte
		subchannel bool
	}{
		"mode 1 sectors":                   {content: discimagetest.Raw(image, 2352, 16)},
		"mode 2 sectors":                   {content: discimagetest.Raw(image, 2352, 24)},
		"mode 2 sectors without a header":  {content: discimagetest.Raw(image, 2336, 8)},
		"sectors with subchannel data":     {content: discimagetest.Raw(image, 2448, 16), subchannel: true},
		"an image that starts after a gap": {content: withLead},
	} {
		t.Run(name, func(t *testing.T) {
			path := stored(t, "game.bin", tc.content)
			volume := probe(t, path)
			if !volume.Readable || !volume.Raw || volume.Subchannel != tc.subchannel || volume.Label != "GAME" || volume.Bytes != int64(len(image)) {
				t.Fatalf("unexpected volume %+v", volume)
			}
			restored := filepath.Join(t.TempDir(), "nested", "game.iso")
			if err := discimage.NewReader().Cook(context.Background(), path, restored); err != nil {
				t.Fatal(err)
			}
			got, err := os.ReadFile(restored)
			if err != nil || !bytes.Equal(got, image) {
				t.Fatalf("the restored image differs: %d bytes, %v", len(got), err)
			}
			if again := probe(t, restored); again.Raw || again.Format != discimage.FormatJoliet {
				t.Fatalf("unexpected restored volume %+v", again)
			}
		})
	}
}

func TestProbeLeavesOutTheAudioThatFollowsTheDataTrack(t *testing.T) {
	image := discimagetest.Build(discimagetest.Options{Label: "GAME"}, gameFiles...)
	mixed := append(discimagetest.Raw(image, 2352, 16), make([]byte, 2352*300)...)
	path := stored(t, "game.bin", mixed)
	if volume := probe(t, path); volume.Bytes != int64(len(image)) {
		t.Fatalf("unexpected volume %+v", volume)
	}
	restored := filepath.Join(t.TempDir(), "game.iso")
	if err := discimage.NewReader().Cook(context.Background(), path, restored); err != nil {
		t.Fatal(err)
	}
	if got, _ := os.ReadFile(restored); !bytes.Equal(got, image) {
		t.Fatalf("the restored image holds %d bytes", len(got))
	}
}

func TestProbeRecognisesUniversalDiskFormat(t *testing.T) {
	image := discimagetest.Build(discimagetest.Options{Label: "DVD"}, gameFiles...)
	bridge := append([]byte{}, image...)
	for i, mark := range []string{"BEA01", "NSR02", "TEA01"} {
		at := (19 + i) * discimagetest.Sector
		copy(bridge[at+1:], mark)
	}
	if got := probe(t, stored(t, "bridge.iso", bridge)); got.Format != discimage.FormatUDF || got.Label != "DVD" {
		t.Fatalf("unexpected bridge volume %+v", got)
	}
	only := make([]byte, 64*discimagetest.Sector)
	for i, mark := range []string{"BEA01", "NSR03", "TEA01"} {
		copy(only[(16+i)*discimagetest.Sector+1:], mark)
	}
	if got := probe(t, stored(t, "udf.iso", only)); !got.Readable || got.Format != discimage.FormatUDF || got.Raw {
		t.Fatalf("unexpected volume %+v", got)
	}
}

func TestProbeHasNothingToSayAboutOtherFiles(t *testing.T) {
	for name, content := range map[string][]byte{
		"compressed.mdx": bytes.Repeat([]byte("MEDIA DESCRIPTOR"), 9000),
		"short.iso":      []byte("CD001"),
		"empty.iso":      nil,
	} {
		path := stored(t, name, content)
		if got := probe(t, path); got != (scan.DiscVolume{}) {
			t.Fatalf("%s: unexpected volume %+v", name, got)
		}
		if err := discimage.NewReader().Cook(context.Background(), path, filepath.Join(t.TempDir(), "out.iso")); err == nil {
			t.Fatalf("%s: nothing to restore must be an error", name)
		}
	}
}

func TestProbeAndCookReportWhatCannotBeOpened(t *testing.T) {
	missing := filepath.Join(t.TempDir(), "missing.iso")
	if _, err := discimage.NewReader().Probe(context.Background(), missing); err == nil {
		t.Fatal("expected a failure")
	}
	if err := discimage.NewReader().Cook(context.Background(), missing, filepath.Join(t.TempDir(), "out.iso")); err == nil {
		t.Fatal("expected a failure")
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := discimage.NewReader().Probe(ctx, missing); !errors.Is(err, context.Canceled) {
		t.Fatalf("probe: %v", err)
	}
}
