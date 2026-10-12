package scan

import (
	"context"
	"math"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/Ringyuki/shionlib/apps/api/internal/download"
)

const (
	listedTimeLayout = "2006-01-02 15:04:05"
	escapedByteBase  = 0xEF00
	escapedByteFirst = 0xEF80
	escapedByteLast  = 0xEFFF
)

type ToolRun struct {
	Stdout   string
	Stderr   string
	Failed   bool
	Message  string
	ExitCode int
	Killed   bool
	Overflow bool
}

func (r ToolRun) blob() string {
	return r.Stdout + "\n" + r.Stderr + "\n" + r.Message
}

func (r ToolRun) failure() string {
	told := strings.TrimSpace(r.Stderr)
	if told == "" {
		told = strings.TrimSpace(r.Stdout)
	}
	return strings.TrimSpace(told + "\n" + r.Message)
}

var wrongPassword = regexp.MustCompile(`(?i)Wrong password|Can not open encrypted archive|Can not decrypt`)

var listBroken = regexp.MustCompile(`(?i)Headers Error|Data Error|Unexpected end of (?:file|data)|CRC Failed|Data is corrupted|Can not open file as archive`)

var testBroken = regexp.MustCompile(`(?i)Headers Error|Data Error|Unexpected end of (?:file|data)|CRC Failed|Data is corrupted`)

var rarType = regexp.MustCompile(`(?i)\bType\s*=\s*Rar`)

var multivolume = regexp.MustCompile(`(?i)\bMultivolume\s*=\s*\+`)

var volumeCount = regexp.MustCompile(`(?i)\bVolumes\s*=\s*(\d+)`)

var headersError = regexp.MustCompile(`(?i)Headers Error`)

var encryptedFlag = regexp.MustCompile(`\bEncrypted\s*=\s*\+`)

var aesMethod = regexp.MustCompile(`(?i)\bMethod\s*=\s*AES`)

var unsupported = regexp.MustCompile(`(?i)Unsupported Method|Method not supported`)

var bufferOverflow = regexp.MustCompile(`(?i)maxBuffer|stdout maxBuffer exceeded`)

var timedOut = regexp.MustCompile(`(?i)ETIMEDOUT|timeout`)

type Archive struct {
	Status      download.CheckStatus
	Facts       ArchiveFacts
	Entries     []ArchiveEntry
	Verified    bool
	Unsupported bool
}

type ArchiveFacts struct {
	Format          string
	Solid           bool
	Volumes         int
	Recovery        bool
	RecoveryPercent int
}

type ArchiveEntry struct {
	Path      string
	Size      int64
	Folder    bool
	Modified  *time.Time
	Encrypted bool
}

func InspectArchive(ctx context.Context, tool ArchiveTool, path string) (Archive, error) {
	listing, err := tool.List(ctx, path)
	if err != nil {
		return Archive{}, err
	}
	if status, decided := classifyListing(listing); decided {
		return Archive{Status: status}, nil
	}
	test, err := tool.Test(ctx, path)
	if err != nil {
		return Archive{}, err
	}
	status, verified := classifyTest(test)
	return Archive{
		Status:      status,
		Facts:       listedFacts(listing.Stdout),
		Entries:     listedEntries(listing.Stdout),
		Verified:    verified,
		Unsupported: status == download.CheckOK && test.Failed && (unsupported.MatchString(test.Stdout) || unsupported.MatchString(test.Stderr)),
	}, nil
}

func InspectNested(ctx context.Context, tool ArchiveTool, path string) (Archive, error) {
	listing, err := tool.List(ctx, path)
	if err != nil {
		return Archive{}, err
	}
	if status, decided := classifyListing(listing); decided {
		return Archive{Status: status}, nil
	}
	return Archive{Status: download.CheckOK, Facts: listedFacts(listing.Stdout), Entries: listedEntries(listing.Stdout)}, nil
}

func InspectDisc(ctx context.Context, tool ArchiveTool, path string) (Archive, error) {
	listing, err := tool.List(ctx, path)
	if err != nil {
		return Archive{}, err
	}
	entries := listedEntries(listing.Stdout)
	if status, decided := classifyListing(listing); decided && (status == download.CheckEncrypted || len(entries) == 0) {
		return Archive{Status: status}, nil
	}
	return Archive{Status: download.CheckOK, Facts: listedFacts(listing.Stdout), Entries: entries}, nil
}

func properties(block string) func(yield func(key, value string) bool) {
	return func(yield func(key, value string) bool) {
		for line := range strings.SplitSeq(block, "\n") {
			key, value, found := strings.Cut(strings.TrimRight(line, "\r"), " = ")
			if found && !yield(key, value) {
				return
			}
		}
	}
}

func listedFacts(stdout string) ArchiveFacts {
	head, _, _ := strings.Cut(stdout, "\n----------\n")
	_, block, found := strings.Cut("\n"+head, "\n--\n")
	if !found {
		return ArchiveFacts{}
	}
	var facts ArchiveFacts
	var size int64
	var characteristics string
	for key, value := range properties(block) {
		switch key {
		case "Type":
			facts.Format = strings.ToLower(value)
		case "Solid":
			facts.Solid = value == "+"
		case "Volumes":
			facts.Volumes, _ = strconv.Atoi(value)
		case "Physical Size":
			size, _ = strconv.ParseInt(value, 10, 64)
		case "Characteristics":
			characteristics = value
		}
	}
	for flag := range strings.FieldsSeq(characteristics) {
		name, offset, located := strings.Cut(flag, ":")
		if name != "Recovery" {
			continue
		}
		facts.Recovery = true
		if start, err := strconv.ParseInt(offset, 10, 64); located && err == nil && start > 0 && size > start {
			facts.RecoveryPercent = int(math.Round(float64(size-start) * 100 / float64(start)))
		}
	}
	return facts
}

func writtenName(listed string) string {
	var out strings.Builder
	for at := 0; at < len(listed); {
		char, size := utf8.DecodeRuneInString(listed[at:])
		if char >= escapedByteFirst && char <= escapedByteLast {
			out.WriteByte(byte(char - escapedByteBase))
		} else {
			out.WriteString(listed[at : at+size])
		}
		at += size
	}
	return out.String()
}

func listedEntries(stdout string) []ArchiveEntry {
	_, body, found := strings.Cut(stdout, "\n----------\n")
	if !found {
		return nil
	}
	var entries []ArchiveEntry
	for block := range strings.SplitSeq(body, "\n\n") {
		var entry ArchiveEntry
		for key, value := range properties(block) {
			switch key {
			case "Path":
				entry.Path = value
			case "Size":
				entry.Size, _ = strconv.ParseInt(value, 10, 64)
			case "Folder":
				entry.Folder = entry.Folder || value == "+"
			case "Attributes":
				entry.Folder = entry.Folder || strings.HasPrefix(value, "D")
			case "Encrypted":
				entry.Encrypted = value == "+"
			case "Modified":
				if modified, err := time.Parse(listedTimeLayout, value); err == nil {
					utc := modified.UTC()
					entry.Modified = &utc
				}
			}
		}
		if entry.Path != "" {
			entries = append(entries, entry)
		}
	}
	return entries
}

func classifyListing(run ToolRun) (download.CheckStatus, bool) {
	if run.Failed {
		blob := strings.TrimSpace(run.blob())
		switch {
		case wrongPassword.MatchString(blob):
			return download.CheckEncrypted, true
		case listBroken.MatchString(blob):
			return download.CheckBrokenOrTruncated, true
		default:
			return download.CheckBrokenOrUnsupported, true
		}
	}
	if rarType.MatchString(run.Stdout) && isMultiVolume(run.Stdout) && (headersError.MatchString(run.Stdout) || headersError.MatchString(run.Stderr)) {
		return download.CheckBrokenOrTruncated, true
	}
	if encryptedFlag.MatchString(run.Stdout) || aesMethod.MatchString(run.Stdout) {
		return download.CheckEncrypted, true
	}
	return download.CheckOK, false
}

func isMultiVolume(stdout string) bool {
	if multivolume.MatchString(stdout) {
		return true
	}
	match := volumeCount.FindStringSubmatch(stdout)
	if match == nil {
		return false
	}
	count, err := strconv.Atoi(match[1])
	return err == nil && count > 1
}

func classifyTest(run ToolRun) (download.CheckStatus, bool) {
	if !run.Failed {
		if testBroken.MatchString(run.Stdout) {
			return download.CheckBrokenOrTruncated, false
		}
		return download.CheckOK, true
	}
	blob := run.blob()
	switch {
	case wrongPassword.MatchString(blob):
		return download.CheckEncrypted, false
	case listBroken.MatchString(blob):
		return download.CheckBrokenOrTruncated, false
	case unsupported.MatchString(run.Stdout) || unsupported.MatchString(run.Stderr):
		return download.CheckOK, false
	case run.Overflow || run.Killed || bufferOverflow.MatchString(blob) || timedOut.MatchString(blob) || run.ExitCode == 1:
		return download.CheckOK, false
	default:
		return download.CheckBrokenOrUnsupported, false
	}
}
