package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type UserLoginSession struct {
	ent.Schema
}

func (UserLoginSession) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("user_login_sessions")}
}

func (UserLoginSession) Fields() []ent.Field {
	return []ent.Field{
		serialID(),
		field.Int("user_id").SchemaType(pg("integer")),
		field.String("refresh_token_hash").MaxLen(255).SchemaType(varchar(255)),
		field.String("refresh_token_prefix").MaxLen(32).SchemaType(varchar(32)),
		field.Int("status").SchemaType(pg("integer")).Default(1),
		field.String("family_id").SchemaType(pg("uuid")).DefaultFunc(newUUID).Annotations(entsql.DefaultExpr("gen_random_uuid()")),
		field.Int("replaced_by_id").SchemaType(pg("integer")).Optional().Nillable(),
		field.Time("expires_at").SchemaType(timestamp3),
		field.Time("last_used_at").SchemaType(timestamp3).Optional().Nillable(),
		field.Time("rotated_at").SchemaType(timestamp3).Optional().Nillable(),
		field.Time("reused_at").SchemaType(timestamp3).Optional().Nillable(),
		field.Time("blocked_at").SchemaType(timestamp3).Optional().Nillable(),
		field.String("blocked_reason").MaxLen(255).SchemaType(varchar(255)).Optional().Nillable(),
		field.Text("ip").Optional().Nillable(),
		field.Text("user_agent").Optional().Nillable(),
		field.Text("device_info").Optional().Nillable(),
		created(),
		updated(),
	}
}

func (UserLoginSession) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("user", User.Type).Ref("sessions").Field("user_id").Unique().Required(),
		edge.To("replaced_sessions", UserLoginSession.Type).StorageKey(edge.Symbol("user_login_sessions_replaced_by_id_fkey")).Annotations(entsql.OnDelete(entsql.SetNull)),
		edge.From("replaced_by", UserLoginSession.Type).Ref("replaced_sessions").Field("replaced_by_id").Unique(),
	}
}

func (UserLoginSession) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("refresh_token_prefix").Unique().StorageKey("user_login_sessions_refresh_token_prefix_key"),
		index.Fields("family_id").StorageKey("user_login_sessions_family_id_idx"),
		index.Fields("user_id", "status").StorageKey("user_login_sessions_user_id_status_idx"),
		index.Fields("status", "expires_at").StorageKey("user_login_sessions_status_expires_at_idx"),
	}
}
