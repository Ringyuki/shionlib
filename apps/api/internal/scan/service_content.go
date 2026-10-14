package scan

import (
	"context"
	"fmt"
	"path/filepath"
	"strconv"

	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/inspection"
)

type ContentService struct {
	archives  ArchiveTool
	names     NameReader
	discs     DiscReader
	workspace Workspace
	spool     Spool
	scanner   VirusScanner
}

type ContentDeps struct {
	Archives  ArchiveTool
	Names     NameReader
	Discs     DiscReader
	Workspace Workspace
	Spool     Spool
	Scanner   VirusScanner
}

func NewContentService(deps ContentDeps) *ContentService {
	return &ContentService{
		archives:  deps.Archives,
		names:     deps.Names,
		discs:     deps.Discs,
		workspace: deps.Workspace,
		spool:     deps.Spool,
		scanner:   deps.Scanner,
	}
}

func (s *ContentService) Read(ctx context.Context, source Source) (Contents, error) {
	room, err := s.spool.SpoolRoom(ctx)
	if err != nil {
		return Contents{}, err
	}
	r := &reading{
		workspace: source.Workspace,
		limit:     s.scanner.MaxSize(),
		room:      room,
		texts:     inspection.TextPreviewLimit,
		images:    inspection.ImagePreviewLimit,
		listed:    Container(source.Archive.Facts.Format),
		opaque:    source.Archive.Unsupported,
	}
	top := container{
		path:    source.Path,
		dir:     filepath.Join(source.Workspace, contentsDir),
		format:  source.Archive.Facts.Format,
		entries: source.Archive.Entries,
		parent:  inspection.TopLevel,
	}
	if err := s.unpack(ctx, r, top); err != nil {
		return Contents{}, err
	}
	return r.contents, nil
}

func (s *ContentService) unpack(ctx context.Context, r *reading, c container) error {
	var tree planted
	if r.listed {
		names, err := s.shownNames(ctx, r, c)
		if err != nil {
			return err
		}
		tree = plantListing(&r.contents.Draft, c.parent, c.entries, names)
	} else {
		tree = planted{indexes: make([]int, len(c.entries)), paths: make([]string, len(c.entries))}
		for i, entry := range c.entries {
			tree.indexes[i], tree.paths[i] = inspection.TopLevel, cleanPath(entry.Path)
		}
	}
	plan := r.plan(c, tree)
	if plan.size > r.room {
		if c.depth == 0 {
			return fmt.Errorf("extracting %d bytes needs more than the %d bytes the spool can spare", plan.size, r.room)
		}
		return nil
	}
	run, err := s.archives.Extract(ctx, c.path, c.dir, plan.selection)
	if err != nil {
		return err
	}
	for _, part := range plan.apart {
		single, err := s.archives.ExtractEntry(ctx, c.path, part.entry, c.dir, part.file)
		if err != nil {
			return err
		}
		if single.Failed && !run.Failed {
			run = single
		}
	}
	if run.Failed && !run.Killed && c.depth == 0 && !r.opaque {
		return fmt.Errorf("extract contents: %s", run.failure())
	}
	r.room -= plan.size
	paths, err := s.workspace.Files(ctx, c.dir)
	if err != nil {
		return err
	}
	if run.Failed {
		r.missing(c, plan, paths)
	}
	for _, path := range paths {
		relative, err := filepath.Rel(c.dir, path)
		if err != nil {
			return err
		}
		key := plan.key(relative)
		shown, known := plan.shown[key]
		if !known {
			shown = key
		}
		if Scanned(key) {
			r.contents.Targets = append(r.contents.Targets, ScanTarget{Name: c.label + shown, Path: path})
		}
		if preview, picked := plan.previews[key]; picked {
			preview.Path = path
			r.contents.Previews = append(r.contents.Previews, preview)
		}
		if index, nested := plan.nested[key]; nested {
			if err := s.descend(ctx, r, c, path, index, shown); err != nil {
				return err
			}
		}
		if disc, image := plan.discs[key]; image {
			if err := s.mount(ctx, r, c, path, disc, shown); err != nil {
				return err
			}
		}
	}
	return nil
}

func (s *ContentService) mount(ctx context.Context, r *reading, outer container, path string, disc discPlan, shown string) error {
	volume, err := s.discs.Probe(ctx, path)
	if err != nil {
		return err
	}
	var sheet DiscSheet
	if disc.candidate.sheet != "" {
		sheet, err = s.discs.Sheet(ctx, filepath.Join(outer.dir, filepath.FromSlash(disc.sheetFile)), disc.size)
		if err != nil {
			return err
		}
	}
	r.contents.Draft.Entries[disc.index].Detail.Signals = discSignals(volume, sheet, disc.candidate)
	if !volume.Readable && sheet.Audio() {
		r.contents.Draft.Entries[disc.index].Detail.Format = DiscFormatAudio
	} else if err := s.list(ctx, r, outer, path, disc, shown, volume); err != nil {
		return err
	}
	for _, track := range sheet.Tracks {
		if !track.Audio {
			continue
		}
		r.contents.Draft.Add(inspection.DraftEntry{
			Parent: disc.index,
			Name:   fmt.Sprintf(trackName, track.Number),
			Kind:   inspection.KindTrack,
			Size:   track.Bytes(),
			Detail: inspection.Detail{Track: track.Number, Seconds: track.Seconds()},
		})
	}
	return nil
}

func (s *ContentService) list(ctx context.Context, r *reading, outer container, path string, disc discPlan, shown string, volume DiscVolume) error {
	if !volume.Readable || (volume.Raw && volume.Bytes > r.room) {
		r.contents.Draft.Entries[disc.index].Unreadable = true
		return nil
	}
	image := path
	if volume.Raw {
		r.nested++
		image = filepath.Join(r.workspace, nestedDir, strconv.Itoa(r.nested)+restoredImage)
		if err := s.discs.Cook(ctx, path, image); err != nil {
			return err
		}
		r.room -= volume.Bytes
	}
	listing, err := InspectDisc(ctx, s.archives, image)
	if err != nil {
		return err
	}
	if listing.Status != download.CheckOK {
		r.contents.Draft.Entries[disc.index].Unreadable = true
		return nil
	}
	entries := withoutBoot(listing.Entries)
	files, folders := countListed(entries)
	detail := &r.contents.Draft.Entries[disc.index].Detail
	detail.Format, detail.Label, detail.Files, detail.Folders = volume.Format, volume.Label, files, folders
	r.nested++
	return s.unpack(ctx, r, container{
		path:    image,
		dir:     filepath.Join(r.workspace, nestedDir, strconv.Itoa(r.nested)),
		format:  listing.Facts.Format,
		entries: entries,
		parent:  disc.index,
		depth:   outer.depth + 1,
		label:   outer.label + shown + nestedSeparator,
	})
}

func (s *ContentService) descend(ctx context.Context, r *reading, outer container, path string, index int, shown string) error {
	entry := &r.contents.Draft.Entries[index]
	if len(r.contents.Draft.Entries) > draftEntryRoom {
		entry.Unreadable = true
		return nil
	}
	archive, err := InspectNested(ctx, s.archives, path)
	if err != nil {
		return err
	}
	if archive.Status != download.CheckOK || !Container(archive.Facts.Format) {
		entry.Unreadable = true
		entry.Encrypted = archive.Status == download.CheckEncrypted
		return nil
	}
	entry.Detail.Format = archive.Facts.Format
	r.nested++
	return s.unpack(ctx, r, container{
		path:    path,
		dir:     filepath.Join(r.workspace, nestedDir, strconv.Itoa(r.nested)),
		format:  archive.Facts.Format,
		entries: archive.Entries,
		parent:  index,
		depth:   outer.depth + 1,
		label:   outer.label + shown + nestedSeparator,
	})
}

func (s *ContentService) shownNames(ctx context.Context, r *reading, c container) ([]string, error) {
	shown := LegacyNames{}
	if c.format == zipFormat {
		legacy, err := s.names.LegacyNames(ctx, c.path)
		if err != nil {
			return nil, err
		}
		if len(legacy.Names) == len(c.entries) {
			shown = legacy
		}
	}
	if shown.Names == nil {
		shown = listedNames(c)
	}
	if c.depth == 0 {
		r.contents.NameEncoding = shown.Encoding
	}
	return shown.Names, nil
}
