package apperror

import "strconv"

type Range struct {
	Prefix int
	Owner  string
	Domain string
}

var Ranges = []Range{
	{Prefix: 100, Owner: "internal/apperror", Domain: "common"},
	{Prefix: 200, Owner: "internal/auth", Domain: "authentication"},
	{Prefix: 300, Owner: "internal/user", Domain: "user"},
	{Prefix: 400, Owner: "internal/game", Domain: "game"},
	{Prefix: 410, Owner: "internal/developer", Domain: "developer"},
	{Prefix: 420, Owner: "internal/character", Domain: "character"},
	{Prefix: 440, Owner: "internal/download", Domain: "download resource"},
	{Prefix: 4402, Owner: "internal/report", Domain: "download resource report"},
	{Prefix: 440206, Owner: "internal/scan", Domain: "malware scan case"},
	{Prefix: 440207, Owner: "internal/scan", Domain: "malware scan case"},
	{Prefix: 450, Owner: "internal/download", Domain: "download file"},
	{Prefix: 460, Owner: "internal/favorite", Domain: "favorite"},
	{Prefix: 470, Owner: "internal/comment", Domain: "comment"},
	{Prefix: 480, Owner: "internal/upload", Domain: "large file upload"},
	{Prefix: 490, Owner: "internal/upload", Domain: "small file upload"},
	{Prefix: 500, Owner: "internal/upload", Domain: "upload quota"},
	{Prefix: 510, Owner: "internal/edit", Domain: "field permission"},
	{Prefix: 520, Owner: "internal/edit", Domain: "edit record"},
	{Prefix: 530, Owner: "internal/message", Domain: "message"},
	{Prefix: 540, Owner: "internal/potatovn", Domain: "PotatoVN binding"},
	{Prefix: 550, Owner: "internal/potatovn", Domain: "PotatoVN game mapping"},
	{Prefix: 560, Owner: "internal/walkthrough", Domain: "walkthrough"},
	{Prefix: 570, Owner: "internal/sponsor", Domain: "sponsor"},
	{Prefix: 580, Owner: "internal/ad", Domain: "advertisement"},
	{Prefix: 590, Owner: "internal/analysis", Domain: "analysis"},
	{Prefix: 610, Owner: "internal/moyu", Domain: "translation patches"},
	{Prefix: 620, Owner: "internal/catalog", Domain: "catalog sources"},
}

func OwnerOf(code int) (Range, bool) {
	digits := strconv.Itoa(code)
	var best Range
	found := false
	for _, r := range Ranges {
		prefix := strconv.Itoa(r.Prefix)
		if len(prefix) > len(digits) || digits[:len(prefix)] != prefix {
			continue
		}
		if !found || len(prefix) > len(strconv.Itoa(best.Prefix)) {
			best, found = r, true
		}
	}
	return best, found
}
