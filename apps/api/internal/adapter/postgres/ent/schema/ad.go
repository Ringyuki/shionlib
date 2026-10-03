package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type Ad struct {
	ent.Schema
}

func (Ad) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("ads")}
}

func (Ad) Fields() []ent.Field {
	return []ent.Field{
		serialID(),
		field.String("name").MaxLen(100).SchemaType(varchar(100)),
		field.Other("placement", stringsType).SchemaType(textArray).Optional().Annotations(emptyArray("text[]")),
		field.String("image_zh").MaxLen(500).SchemaType(varchar(500)),
		field.String("image_ja").MaxLen(500).SchemaType(varchar(500)).Optional().Nillable(),
		field.String("image_en").MaxLen(500).SchemaType(varchar(500)).Optional().Nillable(),
		field.String("aspect").MaxLen(20).SchemaType(varchar(20)),
		field.String("link").MaxLen(500).SchemaType(varchar(500)),
		field.Other("exclude_locales", stringsType).SchemaType(textArray).Optional().Annotations(emptyArray("text[]")),
		field.Bool("enabled").Default(true),
		field.Int("sort").SchemaType(pg("integer")).Default(0),
		field.Time("start_at").SchemaType(timestamp3).Optional().Nillable(),
		field.Time("end_at").SchemaType(timestamp3).Optional().Nillable(),
		created(),
		updated(),
	}
}

func (Ad) Edges() []ent.Edge {
	return []ent.Edge{}
}

func (Ad) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("placement").Annotations(entsql.IndexType("GIN")).StorageKey("ads_placement_idx"),
		index.Fields("enabled").StorageKey("ads_enabled_idx"),
	}
}
