package paging_test

import (
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/paging"
)

func TestOffsetSkipsThePreviousPages(t *testing.T) {
	for page, want := range map[paging.Page]int{
		{Number: 1, Size: 10}: 0,
		{Number: 3, Size: 20}: 40,
	} {
		if got := page.Offset(); got != want {
			t.Fatalf("%+v: got %d want %d", page, got, want)
		}
	}
}
