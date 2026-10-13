package ai

import "testing"

func TestExtractJSONToleratesFencesProseAndReasoning(t *testing.T) {
	cases := map[string]string{
		`{"a": 1}`:                                `{"a":1}`,
		"```json\n{\"a\": 1}\n```":                `{"a":1}`,
		"<think>{\"no\":1}</think>\n{\"a\": 1}":   `{"a":1}`,
		"Here you go: {\"a\": {\"b\": 2}} thanks": `{"a":{"b":2}}`,
	}
	for input, want := range cases {
		got, ok := extractJSON(input)
		if !ok || string(got) != want {
			t.Fatalf("%q: %s %v", input, got, ok)
		}
	}
	for _, input := range []string{"", "[1,2]", "{broken", "<think>unterminated"} {
		if _, ok := extractJSON(input); ok {
			t.Fatalf("%q must not parse", input)
		}
	}
}
