package apperror

type Range struct {
	Prefix int
	Owner  string
	Domain string
}

var Ranges = []Range{
	{Prefix: 100, Owner: "internal/apperror", Domain: "common"},
	{Prefix: 200, Owner: "internal/auth", Domain: "authentication"},
	{Prefix: 400, Owner: "internal/game", Domain: "game"},
	{Prefix: 460, Owner: "internal/favorite", Domain: "favorite"},
	{Prefix: 530, Owner: "internal/message", Domain: "message"},
}

func PrefixOf(code int) int {
	return code / 1000
}
