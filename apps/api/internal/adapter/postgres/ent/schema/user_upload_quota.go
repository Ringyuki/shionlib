package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
)

type UserUploadQuota struct {
	ent.Schema
}

func (UserUploadQuota) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("user_upload_quotas")}
}

func (UserUploadQuota) Fields() []ent.Field {
	return []ent.Field{
		serialID(),
		field.Int64("size"),
		field.Int64("used"),
		field.Int("user_id").SchemaType(pg("integer")).Unique(),
		field.Bool("is_first_grant").Default(false),
		created(),
		updated(),
	}
}

func (UserUploadQuota) Edges() []ent.Edge {
	return []ent.Edge{
		edge.To("records", UserUploadQuotaRecord.Type).StorageKey(edge.Symbol("user_upload_quota_records_user_upload_quota_id_fkey")).Annotations(entsql.OnDelete(entsql.Restrict)),
		edge.From("user", User.Type).Ref("upload_quota").Field("user_id").Unique().Required(),
	}
}

func (UserUploadQuota) Indexes() []ent.Index {
	return []ent.Index{}
}
