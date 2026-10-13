package discimage

import (
	"bufio"
	"bytes"
	"context"
	"encoding/binary"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"

	"github.com/Ringyuki/shionlib/apps/api/internal/scan"
)

const (
	sheetLimit       = 4 << 20
	rawSector        = 2352
	cdFramesPerMin   = 60 * 75
	cdFramesPerSec   = 75
	mdsSignature     = "MEDIA DESCRIPTOR"
	mdsHeaderSize    = 88
	mdsSessionsAt    = 80
	mdsDPMAt         = 84
	mdsSessionSize   = 24
	mdsTrackSize     = 80
	mdsExtraSize     = 8
	mdsAudioMode     = 1
	mdsFirstNonTrack = 0xA0
	maxTracks        = 99
	leadOutPoint     = 0xA2
	dataControl      = 0x04
	byteOrderMark    = "\xef\xbb\xbf"
)

var (
	cueTrack = regexp.MustCompile(`(?i)^TRACK\s+(\d+)\s+(\S+)`)
	cueIndex = regexp.MustCompile(`(?i)^INDEX\s+(\d+)\s+(\d+):(\d+):(\d+)`)
	cueFile  = regexp.MustCompile(`(?i)^FILE\s+`)
)

type span struct {
	number int
	audio  bool
	start  int64
	end    int64
	file   int
}

func (r *Reader) Sheet(ctx context.Context, path string, imageBytes int64) (scan.DiscSheet, error) {
	if err := ctx.Err(); err != nil {
		return scan.DiscSheet{}, err
	}
	info, err := os.Stat(filepath.Clean(path))
	if errors.Is(err, fs.ErrNotExist) {
		return scan.DiscSheet{}, nil
	}
	if err != nil {
		return scan.DiscSheet{}, fmt.Errorf("stat disc sheet: %w", err)
	}
	if info.Size() > sheetLimit {
		return scan.DiscSheet{}, nil
	}
	data, err := os.ReadFile(filepath.Clean(path))
	if err != nil {
		return scan.DiscSheet{}, fmt.Errorf("read disc sheet: %w", err)
	}
	switch strings.ToLower(filepath.Ext(path)) {
	case ".cue":
		return scan.DiscSheet{Tracks: tracksOf(cueSpans(data), imageBytes/rawSector)}, nil
	case ".ccd":
		return scan.DiscSheet{Tracks: tracksOf(ccdSpans(data), imageBytes/rawSector)}, nil
	case ".mds":
		return mdsSheet(data), nil
	default:
		return scan.DiscSheet{}, nil
	}
}

func tracksOf(spans []span, imageFrames int64) []scan.DiscTrack {
	tracks := make([]scan.DiscTrack, 0, len(spans))
	for i, current := range spans {
		end := current.end
		if end == 0 && i+1 < len(spans) && spans[i+1].file == current.file {
			end = spans[i+1].start
		}
		if end == 0 && i == len(spans)-1 && current.file == 0 {
			end = imageFrames
		}
		tracks = append(tracks, scan.DiscTrack{Number: current.number, Audio: current.audio, Frames: max(end-current.start, 0)})
	}
	return tracks
}

func cueSpans(data []byte) []span {
	var spans []span
	file := -1
	scanner := bufio.NewScanner(bytes.NewReader(data))
	for scanner.Scan() {
		line := strings.TrimSpace(strings.TrimPrefix(scanner.Text(), byteOrderMark))
		switch {
		case cueFile.MatchString(line):
			file++
		case cueTrack.MatchString(line):
			groups := cueTrack.FindStringSubmatch(line)
			number, _ := strconv.Atoi(groups[1])
			spans = append(spans, span{number: number, audio: strings.EqualFold(groups[2], "AUDIO"), start: -1, file: max(file, 0)})
		case cueIndex.MatchString(line) && len(spans) > 0:
			groups := cueIndex.FindStringSubmatch(line)
			index, _ := strconv.Atoi(groups[1])
			minutes, _ := strconv.ParseInt(groups[2], 10, 64)
			seconds, _ := strconv.ParseInt(groups[3], 10, 64)
			frames, _ := strconv.ParseInt(groups[4], 10, 64)
			at := minutes*cdFramesPerMin + seconds*cdFramesPerSec + frames
			current := &spans[len(spans)-1]
			if index == 1 || current.start < 0 {
				current.start = at
			}
		}
	}
	for i := range spans {
		spans[i].start = max(spans[i].start, 0)
	}
	if len(spans) > maxTracks {
		return nil
	}
	return spans
}

func ccdSpans(data []byte) []span {
	type entry struct {
		point   int64
		control int64
		lba     int64
	}
	var entries []entry
	inEntry := false
	scanner := bufio.NewScanner(bytes.NewReader(data))
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if strings.HasPrefix(line, "[") {
			inEntry = strings.HasPrefix(strings.ToLower(line), "[entry")
			if inEntry {
				entries = append(entries, entry{})
			}
			continue
		}
		key, value, found := strings.Cut(line, "=")
		if !inEntry || !found {
			continue
		}
		number, err := strconv.ParseInt(strings.TrimSpace(value), 0, 64)
		if err != nil {
			continue
		}
		current := &entries[len(entries)-1]
		switch strings.ToLower(strings.TrimSpace(key)) {
		case "point":
			current.point = number
		case "control":
			current.control = number
		case "plba":
			current.lba = number
		}
	}
	var spans []span
	var leadOut int64
	for _, found := range entries {
		switch {
		case found.point == leadOutPoint:
			leadOut = found.lba
		case found.point >= 1 && found.point <= maxTracks:
			spans = append(spans, span{number: int(found.point), audio: found.control&dataControl == 0, start: found.lba})
		}
	}
	if len(spans) > 0 && leadOut > spans[len(spans)-1].start {
		spans[len(spans)-1].end = leadOut
	}
	return spans
}

func mdsSheet(data []byte) scan.DiscSheet {
	if len(data) < mdsHeaderSize || string(data[:len(mdsSignature)]) != mdsSignature {
		return scan.DiscSheet{}
	}
	sheet := scan.DiscSheet{DPM: binary.LittleEndian.Uint32(data[mdsDPMAt:]) != 0}
	session := int(binary.LittleEndian.Uint32(data[mdsSessionsAt:]))
	if session <= 0 || session+mdsSessionSize > len(data) {
		return sheet
	}
	blocks := int(data[session+10])
	first := int(binary.LittleEndian.Uint32(data[session+20:]))
	var tracks []scan.DiscTrack
	next := int64(0)
	for i := range blocks {
		at := first + i*mdsTrackSize
		if first <= 0 || at+mdsTrackSize > len(data) {
			return sheet
		}
		block := data[at : at+mdsTrackSize]
		point := int(block[4])
		if point == 0 || point >= mdsFirstNonTrack {
			continue
		}
		extra := int(binary.LittleEndian.Uint32(block[12:]))
		start := int64(binary.LittleEndian.Uint32(block[36:]))
		if extra <= 0 || extra+mdsExtraSize > len(data) || start < next {
			return sheet
		}
		length := int64(binary.LittleEndian.Uint32(data[extra+4:]))
		if length <= 0 {
			return sheet
		}
		next = start + length
		tracks = append(tracks, scan.DiscTrack{Number: point, Audio: block[0]&0x07 == mdsAudioMode, Frames: length})
	}
	if len(tracks) == 0 || len(tracks) > maxTracks {
		return sheet
	}
	sheet.Tracks = tracks
	return sheet
}
