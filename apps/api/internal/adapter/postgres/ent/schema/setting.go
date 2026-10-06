package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/field"
)

type Setting struct {
	ent.Schema
}

func (Setting) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("settings")}
}

func (Setting) Fields() []ent.Field {
	return []ent.Field{
		serialID(),
		field.String("name").MaxLen(128).SchemaType(varchar(128)).Unique(),
		field.JSON("value", rawJSON).SchemaType(jsonbType),
		created(),
		updated(),
	}
}
