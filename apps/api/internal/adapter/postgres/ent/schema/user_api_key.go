package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type UserAPIKey struct {
	ent.Schema
}

func (UserAPIKey) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("user_api_keys")}
}

func (UserAPIKey) Fields() []ent.Field {
	return []ent.Field{
		serialID(),
		field.Int("user_id").SchemaType(pg("integer")),
		field.String("name").MaxRuneLen(50).SchemaType(varchar(50)),
		field.String("prefix").MaxRuneLen(16).SchemaType(varchar(16)),
		field.String("secret_hash").MaxRuneLen(64).SchemaType(varchar(64)).Unique(),
		field.Int("status").SchemaType(pg("integer")).Default(1),
		field.String("suspended_reason").MaxRuneLen(200).SchemaType(varchar(200)).Optional().Nillable(),
		field.Time("suspended_at").SchemaType(timestamp3).Optional().Nillable(),
		field.Int("suspended_by").SchemaType(pg("integer")).Optional().Nillable(),
		field.Time("last_used_at").SchemaType(timestamp3).Optional().Nillable(),
		field.Text("last_used_ip").Optional().Nillable(),
		created(),
		updated(),
	}
}

func (UserAPIKey) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("user", User.Type).Ref("api_keys").Field("user_id").Unique().Required(),
		edge.To("usages", APIKeyDailyUsage.Type).StorageKey(edge.Symbol("api_key_daily_usages_key_id_fkey")).Annotations(entsql.OnDelete(entsql.Cascade)),
	}
}

func (UserAPIKey) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("user_id").StorageKey("user_api_keys_user_id_idx"),
	}
}
