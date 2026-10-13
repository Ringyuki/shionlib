package llm

import (
	"bufio"
	"errors"
	"io"
	"strings"
	"testing"
)

func TestSSEReaderJoinsDataLinesAndSkipsComments(t *testing.T) {
	input := ": keep-alive\n\nevent: first\ndata: a\ndata: b\n\ndata: second\r\n\r\ndata: tail"
	touched := 0
	reader := &sseReader{reader: bufio.NewReader(strings.NewReader(input)), touch: func() { touched++ }}
	var events []sseEvent
	for {
		event, err := reader.next()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			t.Fatal(err)
		}
		events = append(events, event)
	}
	want := []sseEvent{{Name: "first", Data: "a\nb"}, {Data: "second"}, {Data: "tail"}}
	if len(events) != len(want) {
		t.Fatalf("events %+v", events)
	}
	for i := range want {
		if events[i] != want[i] {
			t.Fatalf("event %d: %+v", i, events[i])
		}
	}
	if touched == 0 {
		t.Fatal("reading lines must reset the idle timer")
	}
}

func TestSSEReaderRejectsHugeLines(t *testing.T) {
	reader := &sseReader{reader: bufio.NewReaderSize(strings.NewReader("data: "+strings.Repeat("x", maxLine+1)), 16), touch: func() {}}
	if _, err := reader.next(); !errors.Is(err, errLineTooLong) {
		t.Fatalf("err %v", err)
	}
}
