package discimage_test

import (
	"context"
	"encoding/binary"
	"path/filepath"
	"slices"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/discimage"
	"github.com/Ringyuki/shionlib/apps/api/internal/scan"
)

func sheet(t *testing.T, name string, content []byte, imageBytes int64) scan.DiscSheet {
	t.Helper()
	got, err := discimage.NewReader().Sheet(context.Background(), stored(t, name, content), imageBytes)
	if err != nil {
		t.Fatal(err)
	}
	return got
}

const mixedCue = "\xef\xbb\xbfFILE \"GAME.bin\" BINARY\r\n" +
	"  TRACK 01 MODE1/2352\r\n    INDEX 01 00:00:00\r\n" +
	"  TRACK 02 AUDIO\r\n    PREGAP 00:02:00\r\n    INDEX 00 09:10:00\r\n    INDEX 01 09:12:00\r\n" +
	"  TRACK 03 AUDIO\r\n    INDEX 01 13:43:15\r\n"

func TestSheetReadsTheTracksOfACueSheet(t *testing.T) {
	const imageFrames = 78_000
	got := sheet(t, "GAME.cue", []byte(mixedCue), imageFrames*2352)
	want := []scan.DiscTrack{
		{Number: 1, Frames: 41_400},
		{Number: 2, Audio: true, Frames: 20_340},
		{Number: 3, Audio: true, Frames: 16_260},
	}
	if !slices.Equal(got.Tracks, want) || got.DPM {
		t.Fatalf("got %+v", got)
	}
	if seconds := got.Tracks[1].Seconds(); seconds != 271 {
		t.Fatalf("track 2 lasts %d seconds", seconds)
	}
}

func TestSheetGivesNoLengthToATrackWhoseFileItCannotMeasure(t *testing.T) {
	perTrack := "FILE \"GAME (Track 1).bin\" BINARY\n  TRACK 01 MODE1/2352\n    INDEX 01 00:00:00\n" +
		"FILE \"GAME (Track 2).bin\" BINARY\n  TRACK 02 AUDIO\n    INDEX 00 00:00:00\n    INDEX 01 00:02:00\n"
	got := sheet(t, "GAME.cue", []byte(perTrack), 1000*2352)
	want := []scan.DiscTrack{{Number: 1}, {Number: 2, Audio: true}}
	if !slices.Equal(got.Tracks, want) {
		t.Fatalf("got %+v", got.Tracks)
	}
	single := "FILE \"GAME.bin\" BINARY\n  TRACK 01 AUDIO\n    INDEX 01 00:00:00\n"
	if only := sheet(t, "ONE.cue", []byte(single), 1000*2352); !slices.Equal(only.Tracks, []scan.DiscTrack{{Number: 1, Audio: true, Frames: 1000}}) {
		t.Fatalf("the last track of a single file runs to its end: %+v", only.Tracks)
	}
}

func TestSheetReadsTheTracksOfACloneCDControlFile(t *testing.T) {
	ccd := "[CloneCD]\r\nVersion=3\r\n[Disc]\r\nTocEntries=5\r\nSessions=1\r\n" +
		"[Session 1]\r\nPreGapMode=1\r\n" +
		"[Entry 0]\r\nSession=1\r\nPoint=0xa0\r\nADR=0x01\r\nControl=0x04\r\nPLBA=4350\r\n" +
		"[Entry 1]\r\nSession=1\r\nPoint=0xa2\r\nADR=0x01\r\nControl=0x04\r\nPLBA=78000\r\n" +
		"[Entry 2]\r\nSession=1\r\nPoint=0x01\r\nADR=0x01\r\nControl=0x04\r\nPLBA=0\r\n" +
		"[Entry 3]\r\nSession=1\r\nPoint=0x02\r\nADR=0x01\r\nControl=0x00\r\nPLBA=41400\r\n" +
		"[Entry 4]\r\nSession=1\r\nPoint=0x03\r\nADR=0x01\r\nControl=0x00\r\nPLBA=61740\r\n" +
		"[TRACK 1]\r\nMODE=1\r\nINDEX 1=0\r\n[TRACK 2]\r\nMODE=0\r\nINDEX 1=41400\r\n"
	got := sheet(t, "GAME.ccd", []byte(ccd), 0)
	want := []scan.DiscTrack{
		{Number: 1, Frames: 41_400},
		{Number: 2, Audio: true, Frames: 20_340},
		{Number: 3, Audio: true, Frames: 16_260},
	}
	if !slices.Equal(got.Tracks, want) {
		t.Fatalf("got %+v", got.Tracks)
	}
}

type mdsTrack struct {
	mode   byte
	point  byte
	start  uint32
	length uint32
}

func mediaDescriptor(dpm bool, tracks ...mdsTrack) []byte {
	const header, session, track, extra = 88, 24, 80, 8
	tracksAt := header + session
	extrasAt := tracksAt + track*len(tracks)
	out := make([]byte, extrasAt+extra*len(tracks))
	copy(out, "MEDIA DESCRIPTOR")
	out[16], out[17] = 1, 3
	binary.LittleEndian.PutUint32(out[80:], header)
	if dpm {
		binary.LittleEndian.PutUint32(out[84:], uint32(len(out)))
	}
	out[header+10] = byte(len(tracks))
	binary.LittleEndian.PutUint32(out[header+20:], uint32(tracksAt))
	for i, described := range tracks {
		block := out[tracksAt+i*track:]
		block[0], block[4] = described.mode, described.point
		if described.point < 0xA0 {
			binary.LittleEndian.PutUint32(block[12:], uint32(extrasAt+i*extra))
			binary.LittleEndian.PutUint16(block[16:], 2352)
			binary.LittleEndian.PutUint32(block[36:], described.start)
			binary.LittleEndian.PutUint32(out[extrasAt+i*extra+4:], described.length)
		}
	}
	return out
}

func TestSheetReadsTheTracksAndThePhysicalSignatureOfAMediaDescriptor(t *testing.T) {
	descriptor := mediaDescriptor(true,
		mdsTrack{mode: 0x00, point: 0xA0},
		mdsTrack{mode: 0x00, point: 0xA1},
		mdsTrack{mode: 0x00, point: 0xA2},
		mdsTrack{mode: 0xAA, point: 1, start: 0, length: 41_400},
		mdsTrack{mode: 0xA9, point: 2, start: 41_550, length: 20_190},
	)
	got := sheet(t, "GAME.mds", descriptor, 0)
	want := []scan.DiscTrack{{Number: 1, Frames: 41_400}, {Number: 2, Audio: true, Frames: 20_190}}
	if !slices.Equal(got.Tracks, want) || !got.DPM {
		t.Fatalf("got %+v", got)
	}
	plain := sheet(t, "DATA.mds", mediaDescriptor(false, mdsTrack{mode: 0xAA, point: 1, length: 1000}), 0)
	if plain.DPM || len(plain.Tracks) != 1 || plain.Tracks[0].Audio {
		t.Fatalf("got %+v", plain)
	}
}

func TestSheetTrustsNoDescriptorThatDoesNotAddUp(t *testing.T) {
	overlapping := mediaDescriptor(false,
		mdsTrack{mode: 0xAA, point: 1, start: 0, length: 5000},
		mdsTrack{mode: 0xA9, point: 2, start: 100, length: 500},
	)
	truncated := mediaDescriptor(true, mdsTrack{mode: 0xAA, point: 1, length: 1000})[:120]
	empty := mediaDescriptor(false, mdsTrack{mode: 0xAA, point: 1, start: 0, length: 0})
	for name, content := range map[string][]byte{"overlapping": overlapping, "truncated": truncated, "without a length": empty} {
		if got := sheet(t, name+".mds", content, 0); len(got.Tracks) != 0 {
			t.Errorf("%s: got %+v", name, got.Tracks)
		}
	}
	if got := sheet(t, "other.mds", []byte("not a descriptor at all, only some text that is long enough to hold a header of 88 bytes....."), 0); got.DPM || len(got.Tracks) != 0 {
		t.Fatalf("got %+v", got)
	}
}

func TestSheetHasNothingToSayAboutAMissingOrUnknownFile(t *testing.T) {
	missing, err := discimage.NewReader().Sheet(context.Background(), filepath.Join(t.TempDir(), "GAME.cue"), 0)
	if err != nil || len(missing.Tracks) != 0 {
		t.Fatalf("missing sheet: %+v %v", missing, err)
	}
	if got := sheet(t, "GAME.txt", []byte(mixedCue), 0); len(got.Tracks) != 0 {
		t.Fatalf("got %+v", got)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := discimage.NewReader().Sheet(ctx, "GAME.cue", 0); err == nil {
		t.Fatal("a cancelled request must stop")
	}
}
