package discimage

import (
	"bufio"
	"bytes"
	"context"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"unicode/utf16"

	"github.com/Ringyuki/shionlib/apps/api/internal/inspection"
	"github.com/Ringyuki/shionlib/apps/api/internal/scan"
)

const (
	cookedSector     = 2048
	firstDescriptor  = 16
	descriptorLimit  = 32
	primaryType      = 1
	supplementary    = 2
	terminatorType   = 255
	labelOffset      = 40
	labelLength      = 32
	blocksOffset     = 80
	escapesOffset    = 88
	anchorSector     = 256
	anchorTag        = 2
	logicalVolumeTag = 6
	sequenceEndTag   = 8
	sequenceExtent   = 16
	logicalNameAt    = 84
	logicalNameSize  = 128
	narrowText       = 8
	wideText         = 16
	subchannelSector = 2448
	cookBuffer       = 1 << 20
	dirMode          = 0o750
	fileMode         = 0o600
	FormatISO        = "iso9660"
	FormatJoliet     = "iso9660+joliet"
	FormatUDF        = "udf"
)

var (
	isoMark    = []byte("CD001")
	udfStart   = []byte("BEA01")
	udfMarks   = [][]byte{[]byte("NSR02"), []byte("NSR03")}
	jolietMark = [][]byte{[]byte("%/@"), []byte("%/C"), []byte("%/E")}
)

type layout struct {
	sector int64
	data   int64
	lead   int64
}

var layouts = []layout{
	{sector: 2048},
	{sector: 2352, data: 16},
	{sector: 2352, data: 24},
	{sector: 2336, data: 8},
	{sector: subchannelSector, data: 16},
	{sector: subchannelSector, data: 24},
	{sector: 2048, lead: 307200},
}

type Reader struct{}

func NewReader() *Reader {
	return &Reader{}
}

func (l layout) at(block int64) int64 {
	return l.lead + block*l.sector + l.data
}

func (l layout) cooked() bool {
	return l.sector == cookedSector && l.lead == 0
}

func block(file io.ReaderAt, shape layout, number int64) ([]byte, bool) {
	data := make([]byte, cookedSector)
	if _, err := file.ReadAt(data, shape.at(number)); err != nil {
		return nil, false
	}
	return data, true
}

func detect(file io.ReaderAt) (layout, bool) {
	for _, shape := range layouts {
		first, ok := block(file, shape, firstDescriptor)
		if ok && (bytes.Equal(first[1:6], isoMark) || bytes.Equal(first[1:6], udfStart)) {
			return shape, true
		}
	}
	return layout{}, false
}

func (r *Reader) Probe(ctx context.Context, path string) (scan.DiscVolume, error) {
	if err := ctx.Err(); err != nil {
		return scan.DiscVolume{}, err
	}
	file, err := os.Open(filepath.Clean(path))
	if err != nil {
		return scan.DiscVolume{}, fmt.Errorf("open disc image: %w", err)
	}
	defer func() { _ = file.Close() }()
	shape, found := detect(file)
	if !found {
		return scan.DiscVolume{}, nil
	}
	volume := scan.DiscVolume{Readable: true, Raw: !shape.cooked(), Subchannel: shape.sector == subchannelSector, Format: FormatISO}
	info, err := file.Stat()
	if err != nil {
		return scan.DiscVolume{}, fmt.Errorf("stat disc image: %w", err)
	}
	volume.Bytes = (info.Size() - shape.lead) / shape.sector * cookedSector
	joliet, universal := false, false
	for number := int64(firstDescriptor); number < firstDescriptor+descriptorLimit; number++ {
		descriptor, ok := block(file, shape, number)
		if !ok {
			break
		}
		mark := descriptor[1:6]
		switch {
		case bytes.Equal(mark, udfStart), slicesContain(udfMarks, mark):
			universal = true
		case !bytes.Equal(mark, isoMark):
		case descriptor[0] == primaryType:
			volume.Label = primaryLabel(descriptor[labelOffset : labelOffset+labelLength])
			if blocks := int64(binary.LittleEndian.Uint32(descriptor[blocksOffset:])); blocks > 0 {
				volume.Bytes = min(volume.Bytes, blocks*cookedSector)
			}
		case descriptor[0] == supplementary && slicesContain(jolietMark, descriptor[escapesOffset:escapesOffset+3]):
			joliet = true
			if label := wideLabel(descriptor[labelOffset : labelOffset+labelLength]); label != "" {
				volume.Label = label
			}
		}
	}
	switch {
	case universal:
		volume.Format = FormatUDF
		if label := universalLabel(file, shape); label != "" {
			volume.Label = label
		}
	case joliet:
		volume.Format = FormatJoliet
	}
	return volume, nil
}

func universalLabel(file io.ReaderAt, shape layout) string {
	anchor, ok := block(file, shape, anchorSector)
	if !ok || binary.LittleEndian.Uint16(anchor) != anchorTag {
		return ""
	}
	length := int64(binary.LittleEndian.Uint32(anchor[sequenceExtent:])) / cookedSector
	start := int64(binary.LittleEndian.Uint32(anchor[sequenceExtent+4:]))
	for number := start; number < start+min(length, descriptorLimit); number++ {
		descriptor, ok := block(file, shape, number)
		if !ok {
			return ""
		}
		switch binary.LittleEndian.Uint16(descriptor) {
		case logicalVolumeTag:
			return compressedText(descriptor[logicalNameAt : logicalNameAt+logicalNameSize])
		case sequenceEndTag:
			return ""
		}
	}
	return ""
}

func compressedText(field []byte) string {
	length := int(field[len(field)-1])
	if length < 2 || length >= len(field) {
		return ""
	}
	body := field[1:length]
	switch field[0] {
	case narrowText:
		chars := make([]rune, len(body))
		for i, char := range body {
			chars[i] = rune(char)
		}
		return strings.TrimRight(string(chars), " \x00")
	case wideText:
		return wideLabel(body)
	default:
		return ""
	}
}

func slicesContain(candidates [][]byte, value []byte) bool {
	for _, candidate := range candidates {
		if bytes.Equal(candidate, value) {
			return true
		}
	}
	return false
}

func primaryLabel(raw []byte) string {
	trimmed := bytes.TrimRight(raw, " \x00")
	if decoded, legacy := inspection.Decode(trimmed, inspection.DetectEncodingExpecting(trimmed, inspection.EncodingShiftJIS)); legacy {
		return strings.TrimSpace(decoded)
	}
	return strings.TrimSpace(strings.ToValidUTF8(string(trimmed), ""))
}

func wideLabel(raw []byte) string {
	units := make([]uint16, 0, len(raw)/2)
	for i := 0; i+1 < len(raw); i += 2 {
		units = append(units, binary.BigEndian.Uint16(raw[i:]))
	}
	return strings.TrimRight(string(utf16.Decode(units)), " \x00")
}

func (r *Reader) Cook(ctx context.Context, path, target string) error {
	source, err := os.Open(filepath.Clean(path))
	if err != nil {
		return fmt.Errorf("open disc image: %w", err)
	}
	defer func() { _ = source.Close() }()
	shape, found := detect(source)
	if !found {
		return errors.New("the disc image has no file system to restore")
	}
	volume, err := r.Probe(ctx, path)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(target), dirMode); err != nil {
		return fmt.Errorf("create the folder of the restored image: %w", err)
	}
	out, err := os.OpenFile(filepath.Clean(target), os.O_CREATE|os.O_TRUNC|os.O_WRONLY, fileMode)
	if err != nil {
		return fmt.Errorf("create the restored image: %w", err)
	}
	written := bufio.NewWriterSize(out, cookBuffer)
	reader := bufio.NewReaderSize(io.NewSectionReader(source, shape.lead, 1<<62), cookBuffer)
	sector := make([]byte, shape.sector)
	for done := int64(0); done < volume.Bytes; done += cookedSector {
		if done%(cookBuffer*64) == 0 {
			if err := ctx.Err(); err != nil {
				_ = out.Close()
				return err
			}
		}
		if _, err := io.ReadFull(reader, sector); err != nil {
			break
		}
		if _, err := written.Write(sector[shape.data : shape.data+cookedSector]); err != nil {
			_ = out.Close()
			return fmt.Errorf("write the restored image: %w", err)
		}
	}
	if err := written.Flush(); err != nil {
		_ = out.Close()
		return fmt.Errorf("write the restored image: %w", err)
	}
	if err := out.Close(); err != nil {
		return fmt.Errorf("close the restored image: %w", err)
	}
	return nil
}
