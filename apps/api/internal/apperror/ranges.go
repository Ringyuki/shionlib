package apperror

type Range struct {
	Prefix int
	Owner  string
	Domain string
}

var Ranges = []Range{
	{Prefix: 100, Owner: "internal/apperror", Domain: "common"},
	{Prefix: 200, Owner: "internal/auth", Domain: "authentication"},
}

func PrefixOf(code int) int {
	return code / 1000
}
