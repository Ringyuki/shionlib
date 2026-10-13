package composition

import (
	"cmp"
	"path"
	"slices"
	"strings"

	"golang.org/x/text/unicode/norm"
)

const (
	Root            = ""
	ChangeListLimit = 200
	DirListLimit    = 300
	DirListDepth    = 4
	commonNameLimit = 64
	programSuffix   = ".exe"
)

type Entry struct {
	Path string
	Size int64
}

type Dir struct {
	Path  string
	Items int
}

type Change struct {
	Path    string
	Size    int64
	OldSize *int64
}

type Count struct {
	Files int
	Size  int64
}

type Plan struct {
	Folder    string
	GameDir   string
	PatchDir  string
	GameDirs  []Dir
	PatchDirs []Dir
	Added     []Change
	Replaced  []Change
	Conflicts []string
	Adds      Count
	Replaces  Count
	Unchanged Count
	Total     Count
}

type Placement struct {
	GameDir  *string
	PatchDir *string
}

func (p Plan) Empty() bool {
	return p.Adds.Files+p.Replaces.Files == 0
}

func Key(name string) string {
	return strings.ToLower(norm.NFC.String(name))
}

func CleanPath(name string) string {
	parts := strings.FieldsFunc(strings.ReplaceAll(name, `\`, "/"), func(r rune) bool { return r == '/' })
	kept := parts[:0]
	for _, part := range parts {
		if part != "." && part != ".." {
			kept = append(kept, part)
		}
	}
	return strings.Join(kept, "/")
}

func Within(dir, name string) (string, bool) {
	inside := splitPath(dir)
	parts := splitPath(name)
	if len(parts) <= len(inside) {
		return "", false
	}
	for i, part := range inside {
		if Key(part) != Key(parts[i]) {
			return "", false
		}
	}
	return strings.Join(parts[len(inside):], "/"), true
}

func splitPath(name string) []string {
	if name == Root {
		return nil
	}
	return strings.Split(name, "/")
}

func Draw(base, patch []Entry, placed Placement) Plan {
	plan := Plan{GameDirs: dirsOf(base), PatchDirs: dirsOf(patch)}
	plan.GameDir, plan.PatchDir = guess(base, patch)
	if placed.GameDir != nil && known(base, *placed.GameDir) {
		plan.GameDir = CleanPath(*placed.GameDir)
	}
	if placed.PatchDir != nil && known(patch, *placed.PatchDir) {
		plan.PatchDir = CleanPath(*placed.PatchDir)
	}
	existing := make(map[string]int64, len(base))
	folders := map[string]bool{}
	var whole Count
	for _, entry := range base {
		existing[Key(entry.Path)] = entry.Size
		whole.Files++
		whole.Size += entry.Size
		for dir := parentOf(entry.Path); dir != Root; dir = parentOf(dir) {
			folders[Key(dir)] = true
		}
	}
	plan.Unchanged = whole
	for _, entry := range patch {
		rest, ok := Within(plan.PatchDir, entry.Path)
		if !ok {
			continue
		}
		target := path.Join(plan.GameDir, rest)
		key := Key(target)
		if folders[key] || blocked(existing, target) {
			plan.Conflicts = append(plan.Conflicts, target)
			continue
		}
		if old, replaced := existing[key]; replaced {
			plan.Replaces.Files++
			plan.Replaces.Size += entry.Size
			plan.Unchanged.Files--
			plan.Unchanged.Size -= old
			plan.Replaced = append(plan.Replaced, Change{Path: rest, Size: entry.Size, OldSize: &old})
			continue
		}
		plan.Adds.Files++
		plan.Adds.Size += entry.Size
		plan.Added = append(plan.Added, Change{Path: rest, Size: entry.Size})
	}
	plan.Total = Count{
		Files: plan.Unchanged.Files + plan.Replaces.Files + plan.Adds.Files,
		Size:  plan.Unchanged.Size + plan.Replaces.Size + plan.Adds.Size,
	}
	plan.Added = listed(plan.Added)
	plan.Replaced = listed(plan.Replaced)
	slices.Sort(plan.Conflicts)
	plan.Conflicts = plan.Conflicts[:min(len(plan.Conflicts), ChangeListLimit)]
	return plan
}

func blocked(existing map[string]int64, target string) bool {
	for dir := parentOf(target); dir != Root; dir = parentOf(dir) {
		if _, file := existing[Key(dir)]; file {
			return true
		}
	}
	return false
}

func listed(changes []Change) []Change {
	slices.SortFunc(changes, func(a, b Change) int { return cmp.Compare(Key(a.Path), Key(b.Path)) })
	return changes[:min(len(changes), ChangeListLimit)]
}

func known(entries []Entry, wanted string) bool {
	wanted = CleanPath(wanted)
	return wanted == Root || slices.ContainsFunc(entries, func(entry Entry) bool {
		_, inside := Within(wanted, entry.Path)
		return inside
	})
}

func parentOf(name string) string {
	cut := strings.LastIndexByte(name, '/')
	if cut < 0 {
		return Root
	}
	return name[:cut]
}

func dirsOf(entries []Entry) []Dir {
	items := map[string]map[string]bool{Root: {}}
	names := map[string]string{Root: Root}
	for _, entry := range entries {
		child := entry.Path
		for {
			parent := parentOf(child)
			key := Key(parent)
			if items[key] == nil {
				items[key] = map[string]bool{}
				names[key] = parent
			}
			items[key][Key(child)] = true
			if parent == Root {
				break
			}
			child = parent
		}
	}
	dirs := make([]Dir, 0, len(items))
	for key, children := range items {
		if strings.Count(names[key], "/") < DirListDepth {
			dirs = append(dirs, Dir{Path: names[key], Items: len(children)})
		}
	}
	slices.SortFunc(dirs, func(a, b Dir) int { return cmp.Compare(Key(a.Path), Key(b.Path)) })
	return dirs[:min(len(dirs), DirListLimit)]
}

type pairing struct {
	game  string
	patch string
}

func guess(base, patch []Entry) (string, string) {
	byName := map[string][][]string{}
	for _, entry := range base {
		parts := splitPath(entry.Path)
		name := Key(parts[len(parts)-1])
		byName[name] = append(byName[name], parts)
	}
	votes := map[pairing]int{}
	shown := map[pairing]pairing{}
	for _, entry := range patch {
		parts := splitPath(entry.Path)
		candidates := byName[Key(parts[len(parts)-1])]
		if len(candidates) == 0 || len(candidates) > commonNameLimit {
			continue
		}
		for depth := range parts {
			rest := parts[depth:]
			for _, candidate := range candidates {
				if !endsWith(candidate, rest) {
					continue
				}
				found := pairing{game: strings.Join(candidate[:len(candidate)-len(rest)], "/"), patch: strings.Join(parts[:depth], "/")}
				vote := pairing{game: Key(found.game), patch: Key(found.patch)}
				votes[vote]++
				shown[vote] = found
			}
		}
	}
	if len(votes) == 0 {
		return programDir(base), soleDir(patch)
	}
	var best pairing
	for vote, count := range votes {
		if count > votes[best] || (count == votes[best] && shallower(vote, best)) {
			best = vote
		}
	}
	return shown[best].game, shown[best].patch
}

func endsWith(whole, tail []string) bool {
	if len(tail) > len(whole) {
		return false
	}
	offset := len(whole) - len(tail)
	for i, part := range tail {
		if Key(part) != Key(whole[offset+i]) {
			return false
		}
	}
	return true
}

func shallower(a, b pairing) bool {
	return cmp.Or(
		cmp.Compare(len(splitPath(a.patch)), len(splitPath(b.patch))),
		cmp.Compare(len(splitPath(a.game)), len(splitPath(b.game))),
		cmp.Compare(a.patch, b.patch),
		cmp.Compare(a.game, b.game),
	) < 0
}

func soleDir(entries []Entry) string {
	dir := Root
	for {
		next, alone := "", true
		for _, entry := range entries {
			rest, inside := Within(dir, entry.Path)
			if !inside {
				continue
			}
			first, _, nested := strings.Cut(rest, "/")
			if !nested || (next != "" && Key(first) != Key(next)) {
				alone = false
				break
			}
			next = first
		}
		if !alone || next == "" {
			return dir
		}
		dir = path.Join(dir, next)
	}
}

func programDir(entries []Entry) string {
	best, found := soleDir(entries), false
	for _, entry := range entries {
		if !strings.HasSuffix(Key(entry.Path), programSuffix) {
			continue
		}
		dir := parentOf(entry.Path)
		if !found || shallower(pairing{game: dir}, pairing{game: best}) {
			best, found = dir, true
		}
	}
	return best
}
