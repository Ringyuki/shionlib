package download_test

import (
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/download"
)

func TestFileStage(t *testing.T) {
	cases := []struct {
		name string
		file download.File
		want download.Stage
	}{
		{"waiting for its check", download.File{Type: download.FileTypeObjectStore, Status: download.FileOnServer, CheckStatus: download.CheckPending}, download.StageChecking},
		{"passed, not stored yet", download.File{Type: download.FileTypeObjectStore, Status: download.FileOnServer, CheckStatus: download.CheckOK}, download.StageStoring},
		{"stored", download.File{Type: download.FileTypeObjectStore, Status: download.FileInObjectStore, CheckStatus: download.CheckOK}, download.StageStored},
		{"stored before checks existed", download.File{Type: download.FileTypeObjectStore, Status: download.FileInObjectStore, CheckStatus: download.CheckPending}, download.StageStored},
		{"held for review", download.File{Type: download.FileTypeObjectStore, Status: download.FileOnServer, CheckStatus: download.CheckHarmfulPendingReview}, download.StageUnderReview},
		{"held for review although stored", download.File{Type: download.FileTypeObjectStore, Status: download.FileInObjectStore, CheckStatus: download.CheckHarmfulPendingReview}, download.StageUnderReview},
		{"encrypted", download.File{Type: download.FileTypeObjectStore, Status: download.FileOnServer, CheckStatus: download.CheckEncrypted}, download.StageRejected},
		{"waited too long for its volumes", download.File{Type: download.FileTypeObjectStore, Status: download.FileOnServer, CheckStatus: download.CheckIncompleteSet}, download.StageRejected},
		{"a link, which is never processed", download.File{Type: download.FileTypeDirectLink, Status: download.FilePending}, download.StageStored},
	}
	for _, c := range cases {
		if got := c.file.Stage(); got != c.want {
			t.Errorf("%s: got %s, want %s", c.name, got, c.want)
		}
	}
}

func TestRejectionNamesEveryRejectedCheck(t *testing.T) {
	want := map[download.CheckStatus]download.Rejection{
		download.CheckBrokenOrTruncated:   download.RejectionTruncated,
		download.CheckBrokenOrUnsupported: download.RejectionUnsupported,
		download.CheckEncrypted:           download.RejectionEncrypted,
		download.CheckHarmful:             download.RejectionHarmful,
		download.CheckIncompleteSet:       download.RejectionIncompleteSet,
	}
	for status := download.CheckPending; status <= download.CheckIncompleteSet; status++ {
		rejection, rejected := status.Rejection()
		if rejected != status.Rejected() || rejection != want[status] {
			t.Errorf("check %d: got %q %v, want %q %v", status, rejection, rejected, want[status], status.Rejected())
		}
	}
}

func TestOwnScopesPartitionResources(t *testing.T) {
	published := time.Date(2026, 10, 3, 12, 0, 0, 0, time.UTC)
	stored := download.GameFile{File: download.File{Type: download.FileTypeObjectStore, Status: download.FileInObjectStore, CheckStatus: download.CheckOK}}
	checking := download.GameFile{File: download.File{Type: download.FileTypeObjectStore, Status: download.FileOnServer}}
	cases := []struct {
		name     string
		resource download.GameResource
		want     download.OwnScope
	}{
		{"published with every file stored", download.GameResource{Resource: download.Resource{PublishedAt: &published}, Files: []download.GameFile{stored}}, download.OwnPublished},
		{"not published yet", download.GameResource{Files: []download.GameFile{checking}}, download.OwnProcessing},
		{"published with a file added later", download.GameResource{Resource: download.Resource{PublishedAt: &published}, Files: []download.GameFile{stored, checking}}, download.OwnProcessing},
	}
	for _, c := range cases {
		for _, scope := range []download.OwnScope{download.OwnProcessing, download.OwnPublished} {
			if got := c.resource.In(scope); got != (scope == c.want) {
				t.Errorf("%s in %s: got %v", c.name, scope, got)
			}
		}
		if !c.resource.In(download.OwnAll) {
			t.Errorf("%s belongs to every resource", c.name)
		}
	}
}
