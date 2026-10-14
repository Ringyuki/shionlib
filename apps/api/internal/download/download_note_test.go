package download_test

import (
	"encoding/json"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/richtext"
)

func document(t *testing.T, text string, marks ...string) *richtext.Document {
	t.Helper()
	leaf := map[string]any{"type": "text", "text": text}
	if len(marks) > 0 {
		kinds := make([]any, len(marks))
		for i, mark := range marks {
			kinds[i] = map[string]any{"type": mark}
		}
		leaf["marks"] = kinds
	}
	raw, err := json.Marshal(map[string]any{"type": "doc", "content": []any{
		map[string]any{"type": "paragraph", "content": []any{leaf}},
	}})
	if err != nil {
		t.Fatal(err)
	}
	doc, err := richtext.Parse(raw, richtext.Comment)
	if err != nil {
		t.Fatal(err)
	}
	return &doc
}

func noted(t *testing.T, text string, marks ...string) *download.Note {
	t.Helper()
	return download.NoteOf(document(t, text, marks...))
}

func TestNoteOfKeepsTheDocumentAndItsText(t *testing.T) {
	if download.NoteOf(nil) != nil {
		t.Fatal("no document is no note")
	}
	written := document(t, "汉化组发布页", "bold")
	note := download.NoteOf(written)
	if note == nil || string(note.Content) != string(written.Raw()) || note.Text != "汉化组发布页" {
		t.Fatalf("note %+v", note)
	}
}
