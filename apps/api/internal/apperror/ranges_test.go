package apperror

import "testing"

func TestOwnerOfUsesTheLongestPrefix(t *testing.T) {
	cases := map[int]string{
		440101: "internal/download",
		440201: "internal/report",
		440206: "internal/scan",
		450101: "internal/download",
		100101: "internal/apperror",
	}
	for code, owner := range cases {
		got, ok := OwnerOf(code)
		if !ok || got.Owner != owner {
			t.Fatalf("code %d: got %+v, want owner %s", code, got, owner)
		}
	}
	if _, ok := OwnerOf(999999); ok {
		t.Fatal("unregistered codes must not resolve")
	}
}

func TestRangesAreUnique(t *testing.T) {
	seen := map[int]bool{}
	for _, r := range Ranges {
		if seen[r.Prefix] {
			t.Fatalf("prefix %d registered twice", r.Prefix)
		}
		seen[r.Prefix] = true
	}
}
