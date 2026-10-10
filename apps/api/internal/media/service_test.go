package media_test

import (
	"context"
	"errors"
	"maps"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/media"
	"github.com/Ringyuki/shionlib/apps/api/internal/richtext"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
)

type processor struct {
	bounds media.Bounds
	fail   error
}

func (p *processor) ToWebP(_ context.Context, data []byte, bounds media.Bounds) (media.Encoded, error) {
	p.bounds = bounds
	if p.fail != nil {
		return media.Encoded{}, p.fail
	}
	return media.Encoded{Data: append([]byte("webp:"), data...), ContentType: "image/webp", Extension: ".webp", Width: 640, Height: 360}, nil
}

type object struct {
	key         string
	data        string
	contentType string
	metadata    map[string]string
}

type store struct {
	objects []object
}

func (s *store) PutBytes(_ context.Context, key string, data []byte, contentType string, metadata map[string]string) error {
	s.objects = append(s.objects, object{key: key, data: string(data), contentType: contentType, metadata: maps.Clone(metadata)})
	return nil
}

func TestStoreUsesLegacyKeysBoundsAndMetadata(t *testing.T) {
	ctx := context.Background()
	p, s := &processor{}, &store{}
	service := media.NewService(p, s, func() string { return "uuid" })
	upload := &media.Upload{ContentType: "image/jpeg", Data: []byte("raw")}

	key, err := service.StoreAvatar(ctx, 7, upload)
	if err != nil || key != "user/7/avatar/uuid.webp" || p.bounds != (media.Bounds{MaxWidth: 233, MaxHeight: 233}) {
		t.Fatalf("avatar: %s %v %+v", key, err, p.bounds)
	}
	key, err = service.StoreCover(ctx, 7, upload)
	if err != nil || key != "user/7/cover/uuid.webp" || p.bounds != (media.Bounds{MaxWidth: 1500}) {
		t.Fatalf("cover: %s %v %+v", key, err, p.bounds)
	}
	key, err = service.StoreAdImage(ctx, 2, upload)
	if err != nil || key != "ad/image/uuid.webp" || p.bounds != (media.Bounds{}) {
		t.Fatalf("ad: %s %v %+v", key, err, p.bounds)
	}
	if s.objects[0].metadata["user_id"] != "7" || s.objects[2].metadata["uploader_id"] != "2" || s.objects[0].contentType != "image/webp" || s.objects[0].data != "webp:raw" {
		t.Fatalf("unexpected objects %+v", s.objects)
	}
}

func TestRichTextImagesKeepTheirSizeAndNameTheirOwner(t *testing.T) {
	ctx := context.Background()
	p, s := &processor{}, &store{}
	const id = "0b6f8a52-3c1d-4e8a-9f47-2d5a6c7b8e90"
	service := media.NewService(p, s, func() string { return id })
	picture, err := service.StoreRichTextImage(ctx, 7, &media.Upload{ContentType: "image/png", Data: []byte("raw")})
	if err != nil {
		t.Fatal(err)
	}
	if picture != (media.Picture{Key: "richtext/7/" + id + ".webp", Width: 640, Height: 360}) || !richtext.IsImageKey(picture.Key) {
		t.Fatalf("picture %+v", picture)
	}
	if p.bounds != (media.Bounds{MaxWidth: media.RichTextImageMaxWidth, KeepSmaller: true}) || s.objects[0].metadata["user_id"] != "7" {
		t.Fatalf("bounds %+v objects %+v", p.bounds, s.objects)
	}
	large := &media.Upload{ContentType: "image/png", Data: make([]byte, media.RichTextImageMaxBytes+1)}
	if _, err := service.StoreRichTextImage(ctx, 7, large); !errors.Is(err, upload.ErrSmallFileTooLarge) {
		t.Fatalf("oversized picture: %v", err)
	}
}

func TestStoreValidatesUploads(t *testing.T) {
	ctx := context.Background()
	service := media.NewService(&processor{}, &store{}, nil)
	cases := []struct {
		upload *media.Upload
		want   error
	}{
		{nil, upload.ErrSmallFileMissing},
		{&media.Upload{ContentType: "image/png"}, upload.ErrSmallFileMissing},
		{&media.Upload{ContentType: "image/gif", Data: []byte{1}}, upload.ErrSmallFileUnsupported},
		{&media.Upload{ContentType: "image/png", Data: make([]byte, media.ProfileImageMaxBytes+1)}, upload.ErrSmallFileTooLarge},
	}
	for _, tc := range cases {
		if _, err := service.StoreAvatar(ctx, 1, tc.upload); !errors.Is(err, tc.want) {
			t.Fatalf("got %v want %v", err, tc.want)
		}
	}
	if _, err := service.StoreAdImage(ctx, 1, &media.Upload{ContentType: "image/avif", Data: make([]byte, media.ProfileImageMaxBytes+1)}); err != nil {
		t.Fatalf("ad images allow up to 15 MiB: %v", err)
	}
	failing := media.NewService(&processor{fail: upload.ErrSmallFileUnsupported}, &store{}, nil)
	if _, err := failing.StoreCover(ctx, 1, &media.Upload{ContentType: "image/png", Data: []byte{1}}); !errors.Is(err, upload.ErrSmallFileUnsupported) {
		t.Fatalf("processor errors propagate: %v", err)
	}
}
