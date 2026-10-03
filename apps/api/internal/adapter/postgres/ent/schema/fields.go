package schema

import (
	"encoding/json"
	"fmt"
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema/field"
	"github.com/google/uuid"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgvalue"
)

var (
	timestamp3 = pg("timestamp(3) without time zone")
	textArray  = pg("text[]")
	intArray   = pg("integer[]")
	jsonbType  = pg("jsonb")
)

func pg(t string) map[string]string {
	return map[string]string{dialect.Postgres: t}
}

func pgEnum(typeName string) map[string]string {
	return pg(typeName)
}

func pgEnumArray(typeName string) map[string]string {
	return pg(typeName + "[]")
}

func varchar(size int) map[string]string {
	return pg(fmt.Sprintf("character varying(%d)", size))
}

func now() time.Time {
	return time.Now().UTC()
}

func newUUID() string {
	return uuid.NewString()
}

func serialID() ent.Field {
	return field.Int("id").SchemaType(pg("serial")).Immutable()
}

func created() ent.Field {
	return field.Time("created").SchemaType(timestamp3).Default(now).Immutable().Annotations(entsql.DefaultExpr("CURRENT_TIMESTAMP"))
}

func updated() ent.Field {
	return field.Time("updated").SchemaType(timestamp3).Default(now).UpdateDefault(now)
}

func emptyArray(sqlType string) *entsql.Annotation {
	return entsql.DefaultExpr(fmt.Sprintf("ARRAY[]::%s", sqlType))
}

var (
	stringsType = pgvalue.Strings{}
	intsType    = pgvalue.Ints{}
	rawJSON     = json.RawMessage{}
)
