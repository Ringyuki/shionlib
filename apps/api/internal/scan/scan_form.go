package scan

import (
	"path"
	"regexp"
	"slices"
	"strings"

	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/inspection"
)

var (
	formRedist      = regexp.MustCompile(`(?i)^(directx|dx\d*|_?commonredist|redist\w*|vcredist\w*|runtime\w*|ucrt\w*|dotnet\w*|\.net\w*|lav\w*|codec\w*|support)$`)
	formInstaller   = regexp.MustCompile(`(?i)^(setup|install|installer|autorun(menu)?)(\d+|[_-]\w+)?\.exe$`)
	formUninstaller = regexp.MustCompile(`(?i)^(unins\d*|uninst\w*|uninstall\w*|unwise\w*)\.exe$`)
	formTool        = regexp.MustCompile(`(?i)^(dxsetup|dxwebsetup|vc_?redist\w*|ndp\w*|dotnet\w*|directx\w*|instmsi\w*|\w*update\w*|config\w*|settings?\w*|\w*filech\w*|checking|crack\w*|\w*crashhandler\w*|python\w*|zsync\w*|startuptool|delfile)\.exe$|設定|设定|设置|破損|チェック`)
	formSlice       = regexp.MustCompile(`(?i)^(.+)-\d+\.bin$`)
	formPayload     = []string{".cab", ".msi", ".hdr"}
)

type formFile struct {
	folder int
	name   string
	size   int64
}

type formReading struct {
	files    []formFile
	total    int64
	unopened int64
}

func ReadForm(draft inspection.Draft) (download.Form, bool) {
	if holdsDisc(draft) {
		return download.FormDisc, true
	}
	reading := readFormFiles(draft)
	if reading.total == 0 || reading.unopened*2 > reading.total {
		return "", false
	}
	var programs, installers []formFile
	for _, file := range reading.files {
		if strings.EqualFold(path.Ext(file.name), ".exe") {
			programs = append(programs, file)
		}
	}
	if slices.ContainsFunc(programs, func(file formFile) bool { return formUninstaller.MatchString(file.name) }) {
		return download.FormPortable, true
	}
	for _, file := range programs {
		if formInstaller.MatchString(file.name) {
			installers = append(installers, file)
		}
	}
	if len(installers) > 0 && reading.payload(installers)*2 > reading.total {
		return download.FormInstaller, true
	}
	if slices.ContainsFunc(programs, func(file formFile) bool {
		return !formInstaller.MatchString(file.name) && !formTool.MatchString(file.name)
	}) {
		return download.FormPortable, true
	}
	if len(installers) > 0 {
		return download.FormInstaller, true
	}
	return "", false
}

func holdsDisc(draft inspection.Draft) bool {
	return slices.ContainsFunc(draft.Entries, func(entry inspection.DraftEntry) bool { return entry.Kind == inspection.KindDisc })
}

func (r formReading) payload(installers []formFile) int64 {
	var size int64
	for _, installer := range installers {
		size += installer.size
	}
	for _, file := range r.files {
		slice := formSlice.FindStringSubmatch(file.name)
		switch {
		case slice != nil && slices.ContainsFunc(installers, func(installer formFile) bool {
			return installer.folder == file.folder && strings.EqualFold(strings.TrimSuffix(installer.name, path.Ext(installer.name)), slice[1])
		}):
			size += file.size
		case slices.ContainsFunc(formPayload, func(extension string) bool { return strings.EqualFold(path.Ext(file.name), extension) }):
			size += file.size
		}
	}
	return size
}

func readFormFiles(draft inspection.Draft) formReading {
	opened := make([]bool, len(draft.Entries))
	for _, entry := range draft.Entries {
		if entry.Parent >= 0 && entry.Parent < len(opened) {
			opened[entry.Parent] = true
		}
	}
	redist := make(map[int]bool, len(draft.Entries))
	var under func(index int) bool
	under = func(index int) bool {
		if index < 0 || index >= len(draft.Entries) {
			return false
		}
		if found, seen := redist[index]; seen {
			return found
		}
		redist[index] = false
		entry := draft.Entries[index]
		found := (entry.Kind == inspection.KindFolder && formRedist.MatchString(entry.Name)) || under(entry.Parent)
		redist[index] = found
		return found
	}
	var reading formReading
	for i, entry := range draft.Entries {
		switch {
		case entry.Kind == inspection.KindArchive && !opened[i]:
			reading.total += entry.Size
			reading.unopened += entry.Size
		case entry.Kind != inspection.KindFile:
		case under(entry.Parent):
			reading.total += entry.Size
		default:
			reading.total += entry.Size
			reading.files = append(reading.files, formFile{folder: entry.Parent, name: entry.Name, size: entry.Size})
		}
	}
	return reading
}
