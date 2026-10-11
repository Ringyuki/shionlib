package scan_test

import (
	"fmt"
	"strings"

	"github.com/Ringyuki/shionlib/apps/api/internal/inspection"
	"github.com/Ringyuki/shionlib/apps/api/internal/scan"
)

type listed struct {
	path      string
	size      int64
	folder    bool
	modified  string
	encrypted bool
}

func file(path string, size int64) listed {
	return listed{path: path, size: size}
}

func listing(format string, header string, entries ...listed) scan.ToolRun {
	var out strings.Builder
	fmt.Fprintf(&out, "7-Zip (z) 25.01\n\nListing archive: archive\n\n--\nPath = archive\nType = %s\nPhysical Size = 1000\n%s\n----------\n", format, header)
	for _, entry := range entries {
		fmt.Fprintf(&out, "Path = %s\nSize = %d\n", entry.path, entry.size)
		if entry.folder {
			out.WriteString("Folder = +\n")
		} else {
			out.WriteString("Folder = -\n")
		}
		if entry.modified != "" {
			fmt.Fprintf(&out, "Modified = %s\n", entry.modified)
		}
		if entry.encrypted {
			out.WriteString("Encrypted = +\n")
		} else {
			out.WriteString("Encrypted = -\n")
		}
		out.WriteString("\n")
	}
	return scan.ToolRun{Stdout: out.String()}
}

func names(entries []listed) []string {
	var out []string
	for _, entry := range entries {
		if !entry.folder {
			out = append(out, entry.path)
		}
	}
	return out
}

func tree(draft inspection.Draft) []string {
	out := make([]string, len(draft.Entries))
	for i, entry := range draft.Entries {
		name := entry.Name
		for parent := entry.Parent; parent != inspection.TopLevel; parent = draft.Entries[parent].Parent {
			name = draft.Entries[parent].Name + "/" + name
		}
		out[i] = string(entry.Kind) + " " + name
	}
	return out
}

func entryNamed(draft inspection.Draft, name string) inspection.DraftEntry {
	for _, entry := range draft.Entries {
		if entry.Name == name {
			return entry
		}
	}
	return inspection.DraftEntry{}
}
