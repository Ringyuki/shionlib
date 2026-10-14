package media_test

import (
	"context"
	"errors"
	"maps"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/media"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
)

type processor struct {
	bounds media.Bounds
	width  int
	height int
	fail   error
}

func (p *processor) ToWebP(_ context.Context, data []byte, bounds media.Bounds) (media.Encoded, error) {
	p.bounds = bounds
	if p.fail != nil {
		return media.Encoded{}, p.fail
	}
	return media.Encoded{Data: append([]byte("webp:"), data...), ContentType: "image/webp", Extension: ".webp", Width: p.width, Height: p.height}, nil
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
	key, err = service.StoreBackground(ctx, 7, upload)
	if err != nil || key != "user/7/background/uuid.webp" || p.bounds != (media.Bounds{MaxWidth: 2560}) {
		t.Fatalf("background: %s %v %+v", key, err, p.bounds)
	}
	p.width, p.height = 1920, 320
	key, err = service.StoreAdBanner(ctx, 2, upload)
	if err != nil || key != "spotlight/banner/uuid.webp" || p.bounds != (media.Bounds{}) {
		t.Fatalf("ad banner: %s %v %+v", key, err, p.bounds)
	}
	key, err = service.StoreFriendLinkLogo(ctx, 3, upload)
	if err != nil || key != "friend-link/logo/uuid.webp" || p.bounds != (media.Bounds{MaxWidth: 256, MaxHeight: 256}) {
		t.Fatalf("friend link logo: %s %v %+v", key, err, p.bounds)
	}
	if s.objects[0].metadata["user_id"] != "7" || s.objects[2].metadata["user_id"] != "7" || s.objects[3].metadata["uploader_id"] != "2" || s.objects[4].metadata["uploader_id"] != "3" || s.objects[0].contentType != "image/webp" || s.objects[0].data != "webp:raw" {
		t.Fatalf("unexpected objects %+v", s.objects)
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
	sized := media.NewService(&processor{width: 1200, height: 200}, &store{}, nil)
	if _, err := sized.StoreAdBanner(ctx, 1, &media.Upload{ContentType: "image/avif", Data: make([]byte, media.ProfileImageMaxBytes+1)}); err != nil {
		t.Fatalf("ad images allow up to 15 MiB: %v", err)
	}
	failing := media.NewService(&processor{fail: upload.ErrSmallFileUnsupported}, &store{}, nil)
	if _, err := failing.StoreCover(ctx, 1, &media.Upload{ContentType: "image/png", Data: []byte{1}}); !errors.Is(err, upload.ErrSmallFileUnsupported) {
		t.Fatalf("processor errors propagate: %v", err)
	}
}

func TestAdImagesKeepTheirShape(t *testing.T) {
	ctx := context.Background()
	file := &media.Upload{ContentType: "image/png", Data: []byte("raw")}
	cases := []struct {
		width, height int
		store         func(*media.Service) (string, error)
		bounds        media.Bounds
		want          error
	}{
		{1200, 200, func(s *media.Service) (string, error) { return s.StoreAdBanner(ctx, 1, file) }, media.Bounds{}, nil},
		{1260, 200, func(s *media.Service) (string, error) { return s.StoreAdBanner(ctx, 1, file) }, media.Bounds{}, nil},
		{1500, 200, func(s *media.Service) (string, error) { return s.StoreAdBanner(ctx, 1, file) }, media.Bounds{}, upload.ErrAdBannerShape},
		{1194, 199, func(s *media.Service) (string, error) { return s.StoreAdBanner(ctx, 1, file) }, media.Bounds{}, upload.ErrAdBannerShape},
		{500, 193, func(s *media.Service) (string, error) { return s.StoreAdSideImage(ctx, 1, file) }, media.Bounds{}, nil},
		{300, 79, func(s *media.Service) (string, error) { return s.StoreAdSideImage(ctx, 1, file) }, media.Bounds{}, upload.ErrAdSideImageShape},
		{128, 128, func(s *media.Service) (string, error) { return s.StoreAdSideIcon(ctx, 1, file) }, media.Bounds{MaxWidth: 128, MaxHeight: 128}, nil},
		{128, 110, func(s *media.Service) (string, error) { return s.StoreAdSideIcon(ctx, 1, file) }, media.Bounds{MaxWidth: 128, MaxHeight: 128}, upload.ErrAdSideIconShape},
	}
	for _, c := range cases {
		p, s := &processor{width: c.width, height: c.height}, &store{}
		_, err := c.store(media.NewService(p, s, func() string { return "uuid" }))
		if !errors.Is(err, c.want) || p.bounds != c.bounds || (c.want == nil) != (len(s.objects) == 1) {
			t.Fatalf("%dx%d: %v want %v, bounds %+v, stored %d", c.width, c.height, err, c.want, p.bounds, len(s.objects))
		}
	}
}
