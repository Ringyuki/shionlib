package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type GameDownloadResource struct {
	ent.Schema
}

func (GameDownloadResource) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("game_download_resources")}
}

func (GameDownloadResource) Fields() []ent.Field {
	return []ent.Field{
		field.Int("status").SchemaType(pg("integer")).Default(1),
		serialID(),
		field.Int("game_id").SchemaType(pg("integer")),
		field.Other("platform", stringsType).SchemaType(textArray).Optional().Annotations(emptyArray("text[]")),
		field.Enum("simulator").Values("KRKR", "ONS", "ARTEMIS", "OTHER").SchemaType(pgEnum("game_download_resource_simulator")).Optional().Nillable(),
		field.Other("language", stringsType).SchemaType(textArray).Optional().Annotations(emptyArray("text[]")),
		field.String("note").MaxLen(255).SchemaType(varchar(255)).Optional().Nillable(),
		field.Int("downloads").SchemaType(pg("integer")).Default(0),
		field.Int("upload_session_id").SchemaType(pg("integer")).Optional().Nillable(),
		field.Int("creator_id").SchemaType(pg("integer")),
		created(),
		updated(),
	}
}

func (GameDownloadResource) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("game", Game.Type).Ref("download_resources").Field("game_id").Unique().Required(),
		edge.To("files", GameDownloadResourceFile.Type).StorageKey(edge.Symbol("game_download_resource_files_game_download_resource_id_fkey")).Annotations(entsql.OnDelete(entsql.Cascade)),
		edge.To("reports", GameDownloadResourceReport.Type).StorageKey(edge.Symbol("game_download_resource_reports_resource_id_fkey")).Annotations(entsql.OnDelete(entsql.Cascade)),
		edge.To("malware_scan_cases", MalwareScanCase.Type).StorageKey(edge.Symbol("malware_scan_cases_resource_id_fkey")).Annotations(entsql.OnDelete(entsql.SetNull)),
		edge.From("upload_session", GameUploadSession.Type).Ref("game_download_resources").Field("upload_session_id").Unique(),
		edge.From("creator", User.Type).Ref("game_download_resources").Field("creator_id").Unique().Required(),
	}
}

func (GameDownloadResource) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("game_id", "status").StorageKey("game_download_resources_game_id_status_idx"),
	}
}
