package download

import (
	"path"
	"regexp"
	"strconv"

	"golang.org/x/text/unicode/norm"
)

var unsafeKeyCharacters = regexp.MustCompile(`[^\p{L}\p{N}._-]+`)

func StorageKey(gameID, fileID int, fileName string) string {
	safe := unsafeKeyCharacters.ReplaceAllString(norm.NFKC.String(path.Base(fileName)), "_")
	return "games/" + strconv.Itoa(gameID) + "/" + strconv.Itoa(fileID) + "/" + safe
}

const cleanupBatch = 200
