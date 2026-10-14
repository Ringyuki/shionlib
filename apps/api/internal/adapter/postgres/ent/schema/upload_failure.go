package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type UploadFailure struct {
	ent.Schema
}

func (UploadFailure) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("upload_failures")}
}

func (UploadFailure) Fields() []ent.Field {
	return []ent.Field{
		serialID(),
		field.Int("user_id").SchemaType(pg("integer")),
		field.Int("session_id").SchemaType(pg("integer")).Optional().Nillable(),
		field.String("stage").MaxRuneLen(16).SchemaType(varchar(16)),
		field.String("reason").MaxRuneLen(32).SchemaType(varchar(32)),
		field.String("error_name").MaxRuneLen(100).SchemaType(varchar(100)),
		field.Text("error_message"),
		field.Int("status").SchemaType(pg("integer")).Optional().Nillable(),
		field.Int("code").SchemaType(pg("integer")).Optional().Nillable(),
		field.String("request_id").MaxRuneLen(100).SchemaType(varchar(100)).Optional().Nillable(),
		field.String("ray").MaxRuneLen(100).SchemaType(varchar(100)).Optional().Nillable(),
		field.Int("chunk").SchemaType(pg("integer")).Optional().Nillable(),
		field.Text("file_name"),
		field.Int64("file_size").SchemaType(pg("bigint")),
		field.JSON("attempts", rawJSON).SchemaType(jsonbType).Annotations(entsql.DefaultExpr("'[]'::jsonb")),
		field.String("client").MaxRuneLen(64).SchemaType(varchar(64)),
		field.Text("ip"),
		field.Text("user_agent"),
		created(),
	}
}

func (UploadFailure) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("user", User.Type).Ref("upload_failures").Field("user_id").Unique().Required(),
		edge.From("session", GameUploadSession.Type).Ref("failures").Field("session_id").Unique(),
	}
}

func (UploadFailure) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("user_id").StorageKey("upload_failures_user_id_idx"),
		index.Fields("created").StorageKey("upload_failures_created_idx"),
	}
}
