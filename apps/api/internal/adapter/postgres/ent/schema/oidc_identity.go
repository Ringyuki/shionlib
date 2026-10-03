package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type OidcIdentity struct {
	ent.Schema
}

func (OidcIdentity) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("oidc_identities")}
}

func (OidcIdentity) Fields() []ent.Field {
	return []ent.Field{
		serialID(),
		field.Int("user_id").SchemaType(pg("integer")),
		field.String("provider").MaxLen(32).SchemaType(varchar(32)),
		field.String("subject").MaxLen(255).SchemaType(varchar(255)),
		field.String("email_at_link").MaxLen(255).SchemaType(varchar(255)).Optional().Nillable(),
		field.Time("last_login_at").SchemaType(timestamp3).Optional().Nillable(),
		created(),
		updated(),
	}
}

func (OidcIdentity) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("user", User.Type).Ref("oidc_identities").Field("user_id").Unique().Required(),
	}
}

func (OidcIdentity) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("provider", "subject").Unique().StorageKey("oidc_identities_provider_subject_key"),
		index.Fields("user_id").StorageKey("oidc_identities_user_id_idx"),
	}
}
