package hips_test

import (
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/hips"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
)

var _ game.PictureMasker = (*hips.Masker)(nil)

func TestMaskAsksTheProcessorForABlurredPictureOfItsBucket(t *testing.T) {
	masker := hips.NewMasker("https://imagesp.example/", "https://images.example")
	if url, ok := masker.Mask("https://images.example/images/a.webp"); !ok || url != "https://imagesp.example/images/a.webp?w=320&blur=48&q=60&f=webp" {
		t.Fatalf("unexpected mask %q %v", url, ok)
	}
	for _, url := range []string{"https://elsewhere.example/a.webp", "https://images.example/a.webp?w=1", "https://images.example/", "user/1/cover.webp"} {
		if masked, ok := masker.Mask(url); ok {
			t.Fatalf("%s cannot be masked, got %q", url, masked)
		}
	}
	if _, ok := hips.NewMasker("", "https://images.example").Mask("https://images.example/a.webp"); ok {
		t.Fatal("without a processor nothing is masked")
	}
}
