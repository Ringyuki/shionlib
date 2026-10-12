package scan

import (
	"path/filepath"

	"github.com/Ringyuki/shionlib/apps/api/internal/inspection"
)

const (
	contentsDir     = "contents"
	nestedDir       = "nested"
	storedDir       = "stored"
	restoredImage   = ".iso"
	trackName       = "Track %02d"
	draftEntryRoom  = 2 * inspection.EntryLimit
	zipFormat       = "zip"
	nestedSeparator = "/"
)

type Source struct {
	Path      string
	Workspace string
	Archive   Archive
}

type reading struct {
	contents  Contents
	workspace string
	limit     int64
	room      int64
	texts     int
	images    int
	nested    int
	listed    bool
	opaque    bool
}

type container struct {
	path    string
	dir     string
	format  string
	entries []ArchiveEntry
	parent  int
	depth   int
	label   string
}

type checked struct {
	recorded inspection.Recorded
	digests  map[int]string
}

type examined struct {
	archive  Archive
	contents Contents
	reports  []EntryReport
	report   Report
}

type discPlan struct {
	index     int
	candidate discCandidate
	size      int64
}

type extraction struct {
	selection Selection
	size      int64
	previews  map[string]PreviewSource
	nested    map[string]int
	discs     map[string]discPlan
	shown     map[string]string
	targets   []string
}

func (r *reading) plan(c container, tree planted) extraction {
	plan := extraction{
		selection: Selection{Extensions: ScannedExtensions},
		previews:  map[string]PreviewSource{},
		nested:    map[string]int{},
		discs:     map[string]discPlan{},
		shown:     map[string]string{},
	}
	var candidates []inspection.Candidate
	images := map[int]discCandidate{}
	if r.listed {
		images = discCandidates(c.entries)
	}
	for i, entry := range c.entries {
		if entry.Folder {
			continue
		}
		key := cleanPath(entry.Path)
		plan.shown[key] = tree.paths[i]
		if Scanned(entry.Path) {
			if entry.Size > r.limit {
				plan.selection.Skip = append(plan.selection.Skip, entry.Path)
				r.contents.Skipped = append(r.contents.Skipped, c.label+tree.paths[i])
			} else {
				plan.size += entry.Size
				plan.targets = append(plan.targets, key)
			}
		}
		if !r.listed || tree.indexes[i] == inspection.TopLevel {
			continue
		}
		if NestedArchive(tree.paths[i]) {
			r.contents.Draft.Entries[tree.indexes[i]].Kind = inspection.KindArchive
			if c.depth < MaxNestingDepth && entry.Size <= r.limit {
				plan.nested[key] = tree.indexes[i]
			} else {
				r.contents.Draft.Entries[tree.indexes[i]].Unreadable = true
			}
		}
		if image, found := images[i]; found {
			r.contents.Draft.Entries[tree.indexes[i]].Kind = inspection.KindDisc
			if c.depth < MaxNestingDepth {
				plan.discs[key] = discPlan{index: tree.indexes[i], candidate: image, size: entry.Size}
			} else {
				r.contents.Draft.Entries[tree.indexes[i]].Unreadable = true
			}
		}
		if kind := inspection.Previewable(tree.paths[i], entry.Size); kind != inspection.PreviewNone {
			candidates = append(candidates, inspection.Candidate{Index: i, Depth: depthOf(tree.paths[i]), Kind: kind})
		}
	}
	if plan.size > r.room {
		return plan
	}
	for _, entry := range c.entries {
		key := cleanPath(entry.Path)
		disc, wanted := plan.discs[key]
		if !wanted {
			continue
		}
		if plan.size+disc.size > r.room {
			r.contents.Draft.Entries[disc.index].Unreadable = true
			delete(plan.discs, key)
			continue
		}
		plan.size += disc.size
		plan.selection.Paths = append(plan.selection.Paths, entry.Path)
		if disc.candidate.sheet != "" {
			plan.selection.Paths = append(plan.selection.Paths, disc.candidate.sheet)
		}
	}
	for _, candidate := range inspection.PickPreviews(candidates) {
		entry := c.entries[candidate.Index]
		left := &r.texts
		if candidate.Kind == inspection.PreviewImage {
			left = &r.images
		}
		extracted := Scanned(entry.Path)
		if *left == 0 || (!extracted && plan.size+entry.Size > r.room) {
			continue
		}
		*left--
		if !extracted {
			plan.size += entry.Size
			plan.selection.Paths = append(plan.selection.Paths, entry.Path)
		}
		plan.previews[cleanPath(entry.Path)] = PreviewSource{Entry: tree.indexes[candidate.Index], Kind: candidate.Kind}
	}
	return plan
}

func (r *reading) missing(c container, plan extraction, extracted []string) {
	came := map[string]bool{}
	for _, path := range extracted {
		if relative, err := filepath.Rel(c.dir, path); err == nil {
			came[cleanPath(filepath.ToSlash(relative))] = true
		}
	}
	for _, key := range plan.targets {
		if !came[key] && c.depth == 0 {
			r.contents.Skipped = append(r.contents.Skipped, c.label+plan.shown[key])
		}
	}
	for key, index := range plan.nested {
		if !came[key] {
			r.contents.Draft.Entries[index].Unreadable = true
		}
	}
	for key, disc := range plan.discs {
		if !came[key] {
			r.contents.Draft.Entries[disc.index].Unreadable = true
		}
	}
}
