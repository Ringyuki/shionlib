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

	"golang.org/x/text/encoding"
	"golang.org/x/text/encoding/japanese"
	"golang.org/x/text/encoding/simplifiedchinese"
	"golang.org/x/text/encoding/traditionalchinese"

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

var labelDecoders = map[inspection.Encoding]encoding.Encoding{
	inspection.EncodingShiftJIS: japanese.ShiftJIS,
	inspection.EncodingGBK:      simplifiedchinese.GBK,
	inspection.EncodingBig5:     traditionalchinese.Big5,
	inspection.EncodingEUCJP:    japanese.EUCJP,
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
	case joliet:
		volume.Format = FormatJoliet
	}
	return volume, nil
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
	if decoder, legacy := labelDecoders[inspection.DetectEncoding(trimmed)]; legacy {
		if decoded, err := decoder.NewDecoder().Bytes(trimmed); err == nil {
			return strings.TrimSpace(string(decoded))
		}
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
