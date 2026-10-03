package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type UserBannedRecord struct {
	ent.Schema
}

func (UserBannedRecord) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("user_banned_records")}
}

func (UserBannedRecord) Fields() []ent.Field {
	return []ent.Field{
		serialID(),
		field.Int("user_id").SchemaType(pg("integer")),
		field.Time("banned_at").SchemaType(timestamp3).Default(now).Annotations(entsql.DefaultExpr("CURRENT_TIMESTAMP")),
		field.String("banned_reason").MaxLen(255).SchemaType(varchar(255)).Optional().Nillable(),
		field.Int("banned_by").SchemaType(pg("integer")).Optional().Nillable(),
		field.Int("banned_duration_days").SchemaType(pg("integer")).Optional().Nillable(),
		field.Bool("is_permanent").Default(false),
		field.Time("unbanned_at").SchemaType(timestamp3).Optional().Nillable(),
	}
}

func (UserBannedRecord) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("user", User.Type).Ref("banned_records").Field("user_id").Unique().Required(),
		edge.From("banned_by_user", User.Type).Ref("banned_by_records").Field("banned_by").Unique(),
	}
}

func (UserBannedRecord) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("user_id", "banned_at").StorageKey("user_banned_records_user_id_banned_at_idx"),
		index.Fields("user_id", "unbanned_at").StorageKey("user_banned_records_user_id_unbanned_at_idx"),
	}
}
