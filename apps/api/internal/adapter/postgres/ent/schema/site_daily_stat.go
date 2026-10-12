package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/field"
)

type SiteDailyStat struct {
	ent.Schema
}

func (SiteDailyStat) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("site_daily_stats")}
}

func (SiteDailyStat) Fields() []ent.Field {
	return []ent.Field{
		serialID(),
		field.Time("day").SchemaType(pg("date")).Unique(),
		field.Int("views").SchemaType(pg("integer")).Default(0),
		field.Int("downloads").SchemaType(pg("integer")).Default(0),
	}
}
