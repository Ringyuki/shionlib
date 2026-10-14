package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type AdDailyStat struct {
	ent.Schema
}

func (AdDailyStat) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("ad_daily_stats")}
}

func (AdDailyStat) Fields() []ent.Field {
	return []ent.Field{
		serialID(),
		field.Int("ad_id").SchemaType(pg("integer")),
		field.String("slot").MaxRuneLen(16).SchemaType(varchar(16)),
		field.Time("day").SchemaType(pg("date")),
		field.Int("views").SchemaType(pg("integer")).Default(0),
		field.Int("clicks").SchemaType(pg("integer")).Default(0),
	}
}

func (AdDailyStat) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("ad", Ad.Type).Ref("stats").Field("ad_id").Unique().Required(),
	}
}

func (AdDailyStat) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("ad_id", "slot", "day").Unique().StorageKey("ad_daily_stats_ad_id_slot_day_key"),
		index.Fields("day").StorageKey("ad_daily_stats_day_idx"),
	}
}
