package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
)

type UserUploadQuotaRecord struct {
	ent.Schema
}

func (UserUploadQuotaRecord) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("user_upload_quota_records")}
}

func (UserUploadQuotaRecord) Fields() []ent.Field {
	return []ent.Field{
		serialID(),
		field.Enum("field").Values("SIZE", "USED").SchemaType(pgEnum("user_upload_quota_record_field")),
		field.Int64("amount"),
		field.Enum("action").Values("ADD", "SUB", "USE").SchemaType(pgEnum("user_upload_quota_record_action")),
		field.String("action_reason").MaxLen(255).SchemaType(varchar(255)).Optional().Nillable(),
		field.Enum("status").Values("COMPLETED", "WITHDRAWN").SchemaType(pgEnum("user_upload_quota_record_status")).Default("COMPLETED"),
		field.Int("upload_session_id").SchemaType(pg("integer")).Unique().Optional().Nillable(),
		field.Int("user_upload_quota_id").SchemaType(pg("integer")),
		created(),
		updated(),
	}
}

func (UserUploadQuotaRecord) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("upload_session", GameUploadSession.Type).Ref("user_upload_quota_record").Field("upload_session_id").Unique(),
		edge.From("user_upload_quota", UserUploadQuota.Type).Ref("records").Field("user_upload_quota_id").Unique().Required(),
	}
}

func (UserUploadQuotaRecord) Indexes() []ent.Index {
	return []ent.Index{}
}
