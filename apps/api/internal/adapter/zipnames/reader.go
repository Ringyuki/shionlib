package zipnames

import (
	"archive/zip"
	"context"
	"errors"
	"fmt"
	"io/fs"

	"golang.org/x/text/encoding"
	"golang.org/x/text/encoding/japanese"
	"golang.org/x/text/encoding/simplifiedchinese"
	"golang.org/x/text/encoding/traditionalchinese"

	"github.com/Ringyuki/shionlib/apps/api/internal/inspection"
	"github.com/Ringyuki/shionlib/apps/api/internal/scan"
)

var decoders = map[inspection.Encoding]encoding.Encoding{
	inspection.EncodingShiftJIS: japanese.ShiftJIS,
	inspection.EncodingGBK:      simplifiedchinese.GBK,
	inspection.EncodingBig5:     traditionalchinese.Big5,
	inspection.EncodingEUCJP:    japanese.EUCJP,
}

type Reader struct{}

func NewReader() *Reader {
	return &Reader{}
}

func (r *Reader) LegacyNames(ctx context.Context, path string) (scan.LegacyNames, error) {
	if err := ctx.Err(); err != nil {
		return scan.LegacyNames{}, err
	}
	archive, err := zip.OpenReader(path)
	var missing *fs.PathError
	if errors.As(err, &missing) {
		return scan.LegacyNames{}, fmt.Errorf("open %s to read its names: %w", path, err)
	}
	if err != nil {
		return scan.LegacyNames{}, nil
	}
	defer func() { _ = archive.Close() }()
	var sample []byte
	for _, file := range archive.File {
		if file.NonUTF8 && len(sample) < inspection.EncodingSampleBytes {
			sample = append(append(sample, file.Name...), '\n')
		}
	}
	if len(sample) == 0 {
		return scan.LegacyNames{}, nil
	}
	detected := inspection.DetectEncoding(sample)
	decoder, legacy := decoders[detected]
	if !legacy {
		return scan.LegacyNames{}, nil
	}
	names := make([]string, len(archive.File))
	for i, file := range archive.File {
		names[i] = file.Name
		if !file.NonUTF8 {
			continue
		}
		if decoded, err := decoder.NewDecoder().String(file.Name); err == nil {
			names[i] = decoded
		}
	}
	return scan.LegacyNames{Encoding: string(detected), Names: names}, nil
}
