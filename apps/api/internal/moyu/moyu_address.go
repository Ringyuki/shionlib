package moyu

import (
	"regexp"
	"strings"
)

var (
	pageNumber      = regexp.MustCompile(`^[0-9]{1,12}$`)
	pageAddress     = regexp.MustCompile(`(?i)^(?:https?://)?(?:www\.)?moyu\.moe/galgame/([0-9]{1,12})/?(?:[?#].*)?$`)
	resourceAddress = regexp.MustCompile(`(?i)^(?:https?://)?(?:www\.)?moyu\.moe/resource/([0-9]{1,12})/?(?:[?#].*)?$`)
)

type Address struct {
	Page     string
	Resource string
}

func ParseAddress(raw string) (Address, bool) {
	text := strings.TrimSpace(raw)
	switch {
	case pageNumber.MatchString(text):
		return Address{Page: canonicalNumber(text)}, true
	case pageAddress.MatchString(text):
		return Address{Page: canonicalNumber(pageAddress.FindStringSubmatch(text)[1])}, true
	case resourceAddress.MatchString(text):
		return Address{Resource: canonicalNumber(resourceAddress.FindStringSubmatch(text)[1])}, true
	}
	return Address{}, false
}

func IsPageID(id string) bool {
	return pageNumber.MatchString(id) && canonicalNumber(id) == id
}

func canonicalNumber(digits string) string {
	if trimmed := strings.TrimLeft(digits, "0"); trimmed != "" {
		return trimmed
	}
	return "0"
}
