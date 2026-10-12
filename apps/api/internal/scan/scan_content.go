package scan

import (
	"encoding/json"
	"path"
	"slices"
	"strings"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/inspection"
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

type Selection struct {
	Extensions []string
	Paths      []string
	Skip       []string
}

type LegacyNames struct {
	Encoding string
	Names    []string
}

func listedNames(c container) LegacyNames {
	paths := make([]string, len(c.entries))
	for i, entry := range c.entries {
		paths[i] = writtenName(entry.Path)
	}
	expected := inspection.EncodingUnknown
	if slices.Contains(discFileSystems, c.format) {
		expected = inspection.EncodingShiftJIS
	}
	names, encoding := inspection.ReadableNames(paths, expected)
	return LegacyNames{Encoding: string(encoding), Names: names}
}

type Engine struct {
	Name         string
	SignaturesAt *time.Time
}

type ScanTarget struct {
	Name string
	Path string
}

type PreviewSource struct {
	Entry int
	Kind  inspection.Preview
	Path  string
}

type Contents struct {
	Draft        inspection.Draft
	NameEncoding string
	Targets      []ScanTarget
	Skipped      []string
	Previews     []PreviewSource
}

func Executables(entries []EntryReport) int {
	count := 0
	for _, entry := range entries {
		if Executable(entry.Name) {
			count++
		}
	}
	return count
}

func Detections(entries []EntryReport) []inspection.Detection {
	detections := []inspection.Detection{}
	for _, entry := range entries {
		if !entry.Report.Infected {
			continue
		}
		for _, virus := range NormalizeViruses(entry.Report.Viruses) {
			detections = append(detections, inspection.Detection{Path: entry.Name, Signature: virus})
		}
	}
	return detections
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
