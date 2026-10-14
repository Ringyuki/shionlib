package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
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
		field.String("name").MaxRuneLen(100).SchemaType(varchar(100)),
		field.String("link").MaxRuneLen(500).SchemaType(varchar(500)),
		field.String("banner").MaxRuneLen(500).SchemaType(varchar(500)).Optional().Nillable(),
		field.Bool("banner_adult").Default(false),
		field.String("side_image").MaxRuneLen(500).SchemaType(varchar(500)).Optional().Nillable(),
		field.String("side_icon").MaxRuneLen(500).SchemaType(varchar(500)).Optional().Nillable(),
		field.Bool("side_adult").Default(false),
		field.Other("placement", stringsType).SchemaType(textArray).Optional().Annotations(emptyArray("text[]")),
		field.Other("languages", stringsType).SchemaType(textArray).Optional().Annotations(emptyArray("text[]")),
		field.Int("weight").SchemaType(pg("integer")).Default(5),
		field.Bool("enabled").Default(true),
		field.Time("start_at").SchemaType(timestamp3).Optional().Nillable(),
		field.Time("end_at").SchemaType(timestamp3).Optional().Nillable(),
		created(),
		updated(),
	}
}

func (Ad) Edges() []ent.Edge {
	return []ent.Edge{
		edge.To("stats", AdDailyStat.Type).StorageKey(edge.Symbol("ad_daily_stats_ad_id_fkey")).Annotations(entsql.OnDelete(entsql.Cascade)),
	}
}

func (Ad) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("placement").Annotations(entsql.IndexType("GIN")).StorageKey("ads_placement_idx"),
		index.Fields("enabled").StorageKey("ads_enabled_idx"),
	}
}
