package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type APIKeyDailyUsage struct {
	ent.Schema
}

func (APIKeyDailyUsage) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("api_key_daily_usages")}
}

func (APIKeyDailyUsage) Fields() []ent.Field {
	return []ent.Field{
		serialID(),
		field.Int("key_id").SchemaType(pg("integer")),
		field.Time("day").SchemaType(pg("date")),
		field.Int("requests").SchemaType(pg("integer")).Default(0),
		field.Int("throttled").SchemaType(pg("integer")).Default(0),
	}
}

func (APIKeyDailyUsage) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("key", UserAPIKey.Type).Ref("usages").Field("key_id").Unique().Required(),
	}
}

func (APIKeyDailyUsage) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("key_id", "day").Unique().StorageKey("api_key_daily_usages_key_id_day_key"),
		index.Fields("day").StorageKey("api_key_daily_usages_day_idx"),
	}
}
