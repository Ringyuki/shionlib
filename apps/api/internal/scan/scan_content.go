package scan

import (
	"encoding/json"
	"path"
	"slices"
	"strings"
)

var executableExtensions = []string{
	"exe", "dll", "scr", "com", "cpl", "sys", "drv", "ocx", "msi", "msp",
	"bat", "cmd", "ps1", "psm1", "vbs", "vbe", "js", "jse", "wsf", "wsh", "hta", "lnk", "jar", "reg",
}

var ScannedExtensions = append(slices.Clone(executableExtensions), "zip", "rar", "7z", "cab")

func Scanned(name string) bool {
	return slices.Contains(ScannedExtensions, extension(name))
}

func Executable(name string) bool {
	return slices.Contains(executableExtensions, extension(name))
}

func extension(name string) string {
	return strings.TrimPrefix(strings.ToLower(path.Ext(name)), ".")
}

type EntryReport struct {
	Name   string
	Report Report
}

func MergeReports(entries []EntryReport) (Report, error) {
	merged := Report{Viruses: []string{}}
	results := make([]json.RawMessage, 0, len(entries))
	for _, entry := range entries {
		if entry.Report.Result != nil {
			results = append(results, entry.Report.Result)
		}
		if !entry.Report.Infected {
			continue
		}
		if !merged.Infected {
			merged.LogPath, merged.LogExcerpt = entry.Report.LogPath, entry.Report.LogExcerpt
		}
		merged.Infected = true
		for _, virus := range NormalizeViruses(entry.Report.Viruses) {
			merged.Viruses = append(merged.Viruses, virus+" ("+entry.Name+")")
		}
	}
	merged.Viruses = NormalizeViruses(merged.Viruses)
	result, err := json.Marshal(results)
	if err != nil {
		return Report{}, err
	}
	merged.Result = result
	return merged, nil
}
