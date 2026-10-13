package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type TranslatorDistinction struct {
	ent.Schema
}

func (TranslatorDistinction) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("translator_distinctions")}
}

func (TranslatorDistinction) Fields() []ent.Field {
	return []ent.Field{
		serialID(),
		field.Int("low_id").SchemaType(pg("integer")),
		field.Int("high_id").SchemaType(pg("integer")),
		created(),
	}
}

func (TranslatorDistinction) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("low_id", "high_id").Unique().StorageKey("translator_distinctions_low_id_high_id_key"),
	}
}
