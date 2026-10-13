package pgvalue

import (
	"reflect"
	"testing"
)

func TestStringsRoundTrip(t *testing.T) {
	cases := [][]string{
		{},
		{"a"},
		{"a", "b c", `quote"d`, `back\slash`, "comma,inside", "NULL", "", "日本語", "{brace}"},
	}
	for _, input := range cases {
		encoded, err := Strings(input).Value()
		if err != nil {
			t.Fatal(err)
		}
		var decoded Strings
		if err := decoded.Scan(encoded); err != nil {
			t.Fatalf("scan %q: %v", encoded, err)
		}
		if !reflect.DeepEqual([]string(decoded), input) {
			t.Fatalf("round trip %q: got %q want %q", encoded, decoded, input)
		}
	}
}

func TestStringsScanPostgresOutput(t *testing.T) {
	var decoded Strings
	if err := decoded.Scan([]byte(`{plain,"with space","esc\"aped","back\\slash",NULL}`)); err == nil {
		t.Fatal("expected NULL element to be rejected")
	}
	if err := decoded.Scan(`{plain,"with space","esc\"aped","back\\slash"}`); err != nil {
		t.Fatal(err)
	}
	want := Strings{"plain", "with space", `esc"aped`, `back\slash`}
	if !reflect.DeepEqual(decoded, want) {
		t.Fatalf("got %q want %q", decoded, want)
	}
}

func TestStringsScanNull(t *testing.T) {
	decoded := Strings{"stale"}
	if err := decoded.Scan(nil); err != nil {
		t.Fatal(err)
	}
	if decoded != nil {
		t.Fatalf("expected nil, got %q", decoded)
	}
}

func TestIntsRoundTrip(t *testing.T) {
	input := Ints{0, -1, 42, 2147483647}
	encoded, err := input.Value()
	if err != nil {
		t.Fatal(err)
	}
	if encoded != "{0,-1,42,2147483647}" {
		t.Fatalf("unexpected encoding %q", encoded)
	}
	var decoded Ints
	if err := decoded.Scan(encoded); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(decoded, input) {
		t.Fatalf("got %v want %v", decoded, input)
	}
}

func TestDecodeRejectsMalformed(t *testing.T) {
	for _, raw := range []string{"", "a,b", "{\"unterminated}", "{a}b}"} {
		var decoded Strings
		if err := decoded.Scan(raw); err == nil {
			t.Fatalf("expected %q to be rejected", raw)
		}
	}
}

func TestDecodeDimensionPrefix(t *testing.T) {
	var decoded Ints
	if err := decoded.Scan("[1:2]={7,8}"); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(decoded, Ints{7, 8}) {
		t.Fatalf("got %v", decoded)
	}
}
