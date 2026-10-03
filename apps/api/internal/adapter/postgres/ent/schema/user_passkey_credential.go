package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type UserPasskeyCredential struct {
	ent.Schema
}

func (UserPasskeyCredential) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("user_passkey_credentials")}
}

func (UserPasskeyCredential) Fields() []ent.Field {
	return []ent.Field{
		serialID(),
		field.Int("user_id").SchemaType(pg("integer")),
		field.String("credential_id").MaxLen(512).SchemaType(varchar(512)).Unique(),
		field.Text("public_key"),
		field.Int("counter").SchemaType(pg("integer")).Default(0),
		field.Other("transports", stringsType).SchemaType(textArray).Optional().Annotations(emptyArray("text[]")),
		field.String("aaguid").MaxLen(64).SchemaType(varchar(64)).Optional().Nillable(),
		field.String("device_type").MaxLen(32).SchemaType(varchar(32)).Optional().Nillable(),
		field.Bool("credential_backed_up").Default(false),
		field.String("name").MaxLen(128).SchemaType(varchar(128)).Optional().Nillable(),
		field.Time("last_used_at").SchemaType(timestamp3).Optional().Nillable(),
		field.Time("revoked_at").SchemaType(timestamp3).Optional().Nillable(),
		created(),
		updated(),
	}
}

func (UserPasskeyCredential) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("user", User.Type).Ref("passkeys").Field("user_id").Unique().Required(),
	}
}

func (UserPasskeyCredential) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("user_id", "revoked_at").StorageKey("user_passkey_credentials_user_id_revoked_at_idx"),
		index.Fields("last_used_at").StorageKey("user_passkey_credentials_last_used_at_idx"),
	}
}
