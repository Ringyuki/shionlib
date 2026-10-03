package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type GameDownloadResourceFile struct {
	ent.Schema
}

func (GameDownloadResourceFile) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("game_download_resource_files")}
}

func (GameDownloadResourceFile) Fields() []ent.Field {
	return []ent.Field{
		serialID(),
		field.Int("type").SchemaType(pg("integer")),
		field.Text("file_name"),
		field.Text("file_path").Optional().Nillable(),
		field.Int64("file_size"),
		field.Text("file_url").Optional().Nillable(),
		field.Text("s3_file_key").Optional().Nillable(),
		field.Text("file_content_type").Optional().Nillable(),
		field.Enum("hash_algorithm").Values("sha256", "blake3").SchemaType(pgEnum("hash_algorithm")).Default("sha256"),
		field.Text("file_hash"),
		field.Int("upload_session_id").SchemaType(pg("integer")).Optional().Nillable(),
		field.Int("file_status").SchemaType(pg("integer")).Default(1),
		field.Int("file_check_status").SchemaType(pg("integer")).Default(0),
		field.Bool("is_virus_false_positive").Default(false),
		field.Int("game_download_resource_id").SchemaType(pg("integer")),
		field.Int("creator_id").SchemaType(pg("integer")),
		created(),
		updated(),
	}
}

func (GameDownloadResourceFile) Edges() []ent.Edge {
	return []ent.Edge{
		edge.To("activities", Activity.Type).StorageKey(edge.Symbol("activities_file_id_fkey")).Annotations(entsql.OnDelete(entsql.SetNull)),
		edge.From("game_download_resource", GameDownloadResource.Type).Ref("files").Field("game_download_resource_id").Unique().Required(),
		edge.To("malware_scan_cases", MalwareScanCase.Type).StorageKey(edge.Symbol("malware_scan_cases_file_id_fkey")).Annotations(entsql.OnDelete(entsql.SetNull)),
		edge.From("upload_session", GameUploadSession.Type).Ref("game_download_resource_file").Field("upload_session_id").Unique(),
		edge.From("creator", User.Type).Ref("game_download_resource_files").Field("creator_id").Unique().Required(),
		edge.To("histories", GameDownloadResourceFileHistory.Type).StorageKey(edge.Symbol("game_download_resource_file_histories_file_id_fkey")).Annotations(entsql.OnDelete(entsql.Cascade)),
	}
}

func (GameDownloadResourceFile) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("upload_session_id").Unique().StorageKey("game_download_resource_files_upload_session_id_key"),
		index.Fields("file_path").Unique().StorageKey("game_download_resource_files_file_path_key"),
		index.Fields("file_path").StorageKey("game_download_resource_files_file_path_idx"),
	}
}
