package inspection

import (
	"bytes"
	"cmp"
	"path"
	"slices"
	"strconv"
	"strings"
)

const (
	TextPreviewMaxBytes  = 1 << 20
	ImagePreviewMaxBytes = 30 << 20
	ImagePreviewLongest  = 4096
	TextPreviewLimit     = 200
	ImagePreviewLimit    = 300
	previewKeyPrefix     = "inspections/"
	PreviewImageType     = "image/webp"
)

type TextPreview struct {
	Entry    Entry
	Data     []byte
	Encoding Encoding
}

var textExtensions = []string{"txt", "nfo", "diz", "md", "ini", "inf", "cfg", "log", "cue", "csv", "json", "xml", "bat", "cmd", "reg"}

var imageExtensions = []string{"jpg", "jpeg", "png", "gif", "bmp", "webp"}

func Previewable(name string, size int64) Preview {
	base := strings.ToLower(path.Base(strings.ReplaceAll(name, "\\", "/")))
	extension := strings.TrimPrefix(path.Ext(base), ".")
	switch {
	case size <= 0:
		return PreviewNone
	case slices.Contains(textExtensions, extension) || base == "readme":
		if size > TextPreviewMaxBytes {
			return PreviewNone
		}
		return PreviewText
	case slices.Contains(imageExtensions, extension):
		if size > ImagePreviewMaxBytes {
			return PreviewNone
		}
		return PreviewImage
	default:
		return PreviewNone
	}
}

type Candidate struct {
	Index int
	Depth int
	Kind  Preview
}

func PickPreviews(candidates []Candidate) []Candidate {
	ordered := slices.Clone(candidates)
	slices.SortStableFunc(ordered, func(a, b Candidate) int {
		return cmp.Or(cmp.Compare(a.Depth, b.Depth), cmp.Compare(a.Index, b.Index))
	})
	room := map[Preview]int{PreviewText: TextPreviewLimit, PreviewImage: ImagePreviewLimit}
	picked := make([]Candidate, 0, len(ordered))
	for _, candidate := range ordered {
		if room[candidate.Kind] == 0 {
			continue
		}
		room[candidate.Kind]--
		picked = append(picked, candidate)
	}
	return picked
}

func LooksLikeText(data []byte) bool {
	if len(data) == 0 {
		return false
	}
	if _, found := unicodeMark(data); found {
		return true
	}
	return !bytes.ContainsRune(data, 0)
}

func previewKey(inspectionID, entryID int) string {
	return previewKeyPrefix + strconv.Itoa(inspectionID) + "/" + strconv.Itoa(entryID)
}
