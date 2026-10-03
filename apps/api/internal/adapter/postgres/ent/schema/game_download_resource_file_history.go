package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type GameDownloadResourceFileHistory struct {
	ent.Schema
}

func (GameDownloadResourceFileHistory) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("game_download_resource_file_histories")}
}

func (GameDownloadResourceFileHistory) Fields() []ent.Field {
	return []ent.Field{
		serialID(),
		field.Int("file_id").SchemaType(pg("integer")),
		field.Int64("file_size"),
		field.Enum("hash_algorithm").Values("sha256", "blake3").SchemaType(pgEnum("hash_algorithm")),
		field.Text("file_hash"),
		field.Text("s3_file_key").Optional().Nillable(),
		field.String("reason").MaxLen(500).SchemaType(varchar(500)).Optional().Nillable(),
		field.Int("upload_session_id").SchemaType(pg("integer")).Optional().Nillable(),
		field.Int("operator_id").SchemaType(pg("integer")),
		created(),
	}
}

func (GameDownloadResourceFileHistory) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("file", GameDownloadResourceFile.Type).Ref("histories").Field("file_id").Unique().Required(),
		edge.From("operator", User.Type).Ref("game_download_resource_file_histories").Field("operator_id").Unique().Required(),
	}
}

func (GameDownloadResourceFileHistory) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("file_id").StorageKey("game_download_resource_file_histories_file_id_idx"),
	}
}
