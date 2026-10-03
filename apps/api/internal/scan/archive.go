package scan

import (
	"context"
	"regexp"
	"strconv"
	"strings"

	"github.com/Ringyuki/shionlib/apps/api/internal/download"
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

var (
	wrongPassword  = regexp.MustCompile(`(?i)Wrong password|Can not open encrypted archive|Can not decrypt`)
	listBroken     = regexp.MustCompile(`(?i)Headers Error|Data Error|Unexpected end of (?:file|data)|CRC Failed|Data is corrupted|Can not open file as archive`)
	testBroken     = regexp.MustCompile(`(?i)Headers Error|Data Error|Unexpected end of (?:file|data)|CRC Failed|Data is corrupted`)
	rarType        = regexp.MustCompile(`(?i)\bType\s*=\s*Rar`)
	multivolume    = regexp.MustCompile(`(?i)\bMultivolume\s*=\s*\+`)
	volumeCount    = regexp.MustCompile(`(?i)\bVolumes\s*=\s*(\d+)`)
	headersError   = regexp.MustCompile(`(?i)Headers Error`)
	encryptedFlag  = regexp.MustCompile(`\bEncrypted\s*=\s*\+`)
	aesMethod      = regexp.MustCompile(`(?i)\bMethod\s*=\s*AES`)
	unsupported    = regexp.MustCompile(`(?i)Unsupported Method|Method not supported`)
	bufferOverflow = regexp.MustCompile(`(?i)maxBuffer|stdout maxBuffer exceeded`)
	timedOut       = regexp.MustCompile(`(?i)ETIMEDOUT|timeout`)
)

func InspectArchive(ctx context.Context, tool ArchiveTool, path string) (download.CheckStatus, error) {
	listing, err := tool.List(ctx, path)
	if err != nil {
		return 0, err
	}
	if status, decided := classifyListing(listing); decided {
		return status, nil
	}
	test, err := tool.Test(ctx, path)
	if err != nil {
		return 0, err
	}
	return classifyTest(test), nil
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

func classifyTest(run ToolRun) download.CheckStatus {
	if !run.Failed {
		if testBroken.MatchString(run.Stdout) {
			return download.CheckBrokenOrTruncated
		}
		return download.CheckOK
	}
	blob := run.blob()
	switch {
	case wrongPassword.MatchString(blob):
		return download.CheckEncrypted
	case listBroken.MatchString(blob):
		return download.CheckBrokenOrTruncated
	case unsupported.MatchString(run.Stdout) || unsupported.MatchString(run.Stderr):
		return download.CheckOK
	case run.Overflow || run.Killed || bufferOverflow.MatchString(blob) || timedOut.MatchString(blob) || run.ExitCode == 1:
		return download.CheckOK
	default:
		return download.CheckBrokenOrUnsupported
	}
}

func checkReason(status download.CheckStatus) string {
	switch status {
	case download.CheckOK:
		return "OK"
	case download.CheckBrokenOrTruncated:
		return "BROKEN_OR_TRUNCATED"
	case download.CheckBrokenOrUnsupported:
		return "BROKEN_OR_UNSUPPORTED"
	case download.CheckEncrypted:
		return "ENCRYPTED"
	default:
		return "HARMFUL"
	}
}
