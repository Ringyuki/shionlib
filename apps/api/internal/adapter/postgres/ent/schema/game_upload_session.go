package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type GameUploadSession struct {
	ent.Schema
}

func (GameUploadSession) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("game_upload_sessions")}
}

func (GameUploadSession) Fields() []ent.Field {
	return []ent.Field{
		serialID(),
		field.Text("file_name"),
		field.Text("mime_type").Optional().Nillable(),
		field.Int64("total_size"),
		field.Int("chunk_size").SchemaType(pg("integer")),
		field.Int("total_chunks").SchemaType(pg("integer")),
		field.Other("uploaded_chunks", intsType).SchemaType(intArray).Optional().Annotations(emptyArray("integer[]")),
		field.Enum("hash_algorithm").Values("sha256", "blake3").SchemaType(pgEnum("hash_algorithm")).Default("sha256"),
		field.Text("file_sha256"),
		field.Enum("status").Values("INITIATED", "UPLOADING", "COMPLETED", "ABORTED", "EXPIRED").SchemaType(pgEnum("game_upload_session_status")),
		field.Text("storage_path"),
		field.Time("expires_at").SchemaType(timestamp3),
		field.Int("creator_id").SchemaType(pg("integer")),
		created(),
		updated(),
	}
}

func (GameUploadSession) Edges() []ent.Edge {
	return []ent.Edge{
		edge.To("game_download_resources", GameDownloadResource.Type).StorageKey(edge.Symbol("game_download_resources_upload_session_id_fkey")).Annotations(entsql.OnDelete(entsql.SetNull)),
		edge.To("game_download_resource_file", GameDownloadResourceFile.Type).Unique().StorageKey(edge.Symbol("game_download_resource_files_upload_session_id_fkey")).Annotations(entsql.OnDelete(entsql.SetNull)),
		edge.To("game_upload_chunks", GameUploadChunk.Type).StorageKey(edge.Symbol("game_upload_chunks_game_upload_session_id_fkey")).Annotations(entsql.OnDelete(entsql.Restrict)),
		edge.To("user_upload_quota_record", UserUploadQuotaRecord.Type).Unique().StorageKey(edge.Symbol("user_upload_quota_records_upload_session_id_fkey")).Annotations(entsql.OnDelete(entsql.SetNull)),
		edge.From("creator", User.Type).Ref("game_upload_sessions").Field("creator_id").Unique().Required(),
	}
}

func (GameUploadSession) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("expires_at").StorageKey("game_upload_sessions_expires_at_idx"),
		index.Fields("status").StorageKey("game_upload_sessions_status_idx"),
	}
}
