package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type GameUploadChunk struct {
	ent.Schema
}

func (GameUploadChunk) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("game_upload_chunks")}
}

func (GameUploadChunk) Fields() []ent.Field {
	return []ent.Field{
		serialID(),
		field.Int("game_upload_session_id").SchemaType(pg("integer")),
		field.Int("index").SchemaType(pg("integer")),
		field.Int("size").SchemaType(pg("integer")),
		field.Text("sha256"),
		created(),
		updated(),
	}
}

func (GameUploadChunk) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("game_upload_session", GameUploadSession.Type).Ref("game_upload_chunks").Field("game_upload_session_id").Unique().Required(),
	}
}

func (GameUploadChunk) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("game_upload_session_id", "index").Unique().StorageKey("game_upload_chunks_game_upload_session_id_index_key"),
		index.Fields("game_upload_session_id", "index").StorageKey("game_upload_chunks_game_upload_session_id_index_idx"),
		index.Fields("game_upload_session_id").StorageKey("game_upload_chunks_game_upload_session_id_idx"),
	}
}
