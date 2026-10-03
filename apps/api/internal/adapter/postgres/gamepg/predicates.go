package gamepg

import (
	"strings"

	"entgo.io/ent/dialect/sql"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/predicate"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgvalue"
)

var likeEscaper = strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`)

func AnyElementContainsFold(column, needle string) *sql.Predicate {
	pattern := "%" + likeEscaper.Replace(needle) + "%"
	return sql.P(func(b *sql.Builder) {
		b.WriteString("EXISTS (SELECT 1 FROM unnest(").WriteString(column).WriteString(") AS element(value) WHERE element.value ILIKE ").Arg(pattern).WriteString(")")
	})
}

func overlaps(column string, values []string) *sql.Predicate {
	return sql.P(func(b *sql.Builder) {
		b.WriteString(column).WriteString(" && ").Arg(pgvalue.Strings(values)).WriteString("::text[]")
	})
}

func releasedIn(column string, periods []string) *sql.Predicate {
	return sql.P(func(b *sql.Builder) {
		b.WriteString("(to_char(").WriteString(column).WriteString(", 'YYYY-MM') = ANY(").Arg(pgvalue.Strings(periods)).WriteString("::text[])")
		b.WriteString(" OR to_char(").WriteString(column).WriteString(", 'YYYY') = ANY(").Arg(pgvalue.Strings(periods)).WriteString("::text[]))")
	})
}

func gameWhere(build func(s *sql.Selector) *sql.Predicate) predicate.Game {
	return predicate.Game(func(s *sql.Selector) {
		s.Where(build(s))
	})
}
