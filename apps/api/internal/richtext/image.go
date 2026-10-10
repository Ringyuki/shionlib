package richtext

import (
	"fmt"
	"regexp"
)

const (
	MaxImageSide         = 10000
	MaxAltLength         = 200
	MaxCaptionLength     = 500
	MinImageWidthPercent = 20
	MaxImageWidthPercent = 100
)

var imageKey = regexp.MustCompile(`^richtext/[1-9][0-9]*/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$`)

func ImageKey(ownerID int, name string) string {
	return fmt.Sprintf("richtext/%d/%s", ownerID, name)
}

func IsImageKey(key string) bool {
	return imageKey.MatchString(key)
}
