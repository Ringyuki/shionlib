package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type UserPvnBinding struct {
	ent.Schema
}

func (UserPvnBinding) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("user_pvn_bindings")}
}

func (UserPvnBinding) Fields() []ent.Field {
	return []ent.Field{
		serialID(),
		field.Int("user_id").SchemaType(pg("integer")).Unique(),
		field.Int("pvn_user_id").SchemaType(pg("integer")),
		field.String("pvn_user_name").MaxLen(255).SchemaType(varchar(255)),
		field.String("pvn_user_avatar").MaxLen(255).SchemaType(varchar(255)).Optional().Nillable(),
		field.Text("pvn_token"),
		field.Time("pvn_token_expires").SchemaType(timestamp3),
		created(),
		updated(),
	}
}

func (UserPvnBinding) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("user", User.Type).Ref("potatovn_binding").Field("user_id").Unique().Required(),
	}
}

func (UserPvnBinding) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("pvn_user_id").StorageKey("user_pvn_bindings_pvn_user_id_idx"),
	}
}
