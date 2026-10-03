package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type GameDownloadResourceReport struct {
	ent.Schema
}

func (GameDownloadResourceReport) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("game_download_resource_reports")}
}

func (GameDownloadResourceReport) Fields() []ent.Field {
	return []ent.Field{
		serialID(),
		field.Int("resource_id").SchemaType(pg("integer")),
		field.Int("reporter_id").SchemaType(pg("integer")),
		field.Int("reported_user_id").SchemaType(pg("integer")),
		field.Enum("reason").Values("MALWARE", "IRRELEVANT", "BROKEN_LINK", "MISLEADING_CONTENT", "OTHER").SchemaType(pgEnum("game_download_resource_report_reason")),
		field.String("detail").MaxLen(500).SchemaType(varchar(500)).Optional().Nillable(),
		field.Enum("status").Values("PENDING", "VALID", "INVALID").SchemaType(pgEnum("game_download_resource_report_status")).Default("PENDING"),
		field.Enum("malicious_level").Values("LOW", "MEDIUM", "HIGH", "CRITICAL").SchemaType(pgEnum("report_malicious_level")),
		field.Int("processed_by").SchemaType(pg("integer")).Optional().Nillable(),
		field.Time("processed_at").SchemaType(timestamp3).Optional().Nillable(),
		field.String("process_note").MaxLen(500).SchemaType(varchar(500)).Optional().Nillable(),
		field.Bool("reporter_penalty_applied").Default(false),
		field.Bool("reported_penalty_applied").Default(false),
		created(),
		updated(),
	}
}

func (GameDownloadResourceReport) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("resource", GameDownloadResource.Type).Ref("reports").Field("resource_id").Unique().Required(),
		edge.From("reporter", User.Type).Ref("game_download_resource_reports").Field("reporter_id").Unique().Required(),
		edge.From("reported_user", User.Type).Ref("game_download_resource_reported").Field("reported_user_id").Unique().Required(),
		edge.From("processor", User.Type).Ref("game_download_resource_report_process").Field("processed_by").Unique(),
	}
}

func (GameDownloadResourceReport) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("resource_id", "status").StorageKey("game_download_resource_reports_resource_id_status_idx"),
		index.Fields("reporter_id", "status", "created").StorageKey("game_download_resource_reports_reporter_id_status_created_idx"),
		index.Fields("reported_user_id", "status", "created").StorageKey("game_download_resource_reports_reported_user_id_status_crea_idx"),
		index.Fields("status", "created").StorageKey("game_download_resource_reports_status_created_idx"),
	}
}
