package download

import (
	"encoding/json"

	"github.com/Ringyuki/shionlib/apps/api/internal/richtext"
)

const MaxNoteLength = 255

type Note struct {
	Content json.RawMessage
	Text    string
}

func NoteOf(document *richtext.Document) *Note {
	if document == nil {
		return nil
	}
	return &Note{Content: document.Raw(), Text: document.Text()}
}

func (n *Note) said() []string {
	if n == nil {
		return []string{}
	}
	return optional(&n.Text)
}
