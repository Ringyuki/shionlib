package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type Activity struct {
	ent.Schema
}

func (Activity) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("activities")}
}

func (Activity) Fields() []ent.Field {
	return []ent.Field{
		serialID(),
		field.Enum("type").Values("COMMENT", "FILE_UPLOAD_TO_SERVER", "FILE_UPLOAD_TO_S3", "FILE_REUPLOAD", "FILE_CHECK_OK", "FILE_CHECK_BROKEN_OR_TRUNCATED", "FILE_CHECK_BROKEN_OR_UNSUPPORTED", "FILE_CHECK_ENCRYPTED", "FILE_CHECK_HARMFUL", "GAME_CREATE", "WALKTHROUGH_CREATE", "GAME_EDIT", "DEVELOPER_EDIT", "CHARACTER_EDIT").SchemaType(pgEnum("activity_type")),
		field.Int("user_id").SchemaType(pg("integer")),
		field.Int("game_id").SchemaType(pg("integer")).Optional().Nillable(),
		field.Int("walkthrough_id").SchemaType(pg("integer")).Optional().Nillable(),
		field.Int("edit_record_id").SchemaType(pg("integer")).Optional().Nillable(),
		field.Int("comment_id").SchemaType(pg("integer")).Optional().Nillable(),
		field.Int("developer_id").SchemaType(pg("integer")).Optional().Nillable(),
		field.Int("character_id").SchemaType(pg("integer")).Optional().Nillable(),
		field.Int("file_id").SchemaType(pg("integer")).Optional().Nillable(),
		field.Int("file_status").SchemaType(pg("integer")).Default(1).Optional().Nillable(),
		field.Int("file_check_status").SchemaType(pg("integer")).Default(0).Optional().Nillable(),
		field.Int64("file_size").Optional().Nillable(),
		field.Text("file_name").Optional().Nillable(),
		created(),
		updated(),
	}
}

func (Activity) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("user", User.Type).Ref("activities").Field("user_id").Unique().Required(),
		edge.From("game", Game.Type).Ref("activities").Field("game_id").Unique(),
		edge.From("walkthrough", Walkthrough.Type).Ref("activities").Field("walkthrough_id").Unique(),
		edge.From("edit_record", EditRecord.Type).Ref("activities").Field("edit_record_id").Unique(),
		edge.From("comment", Comment.Type).Ref("activities").Field("comment_id").Unique(),
		edge.From("developer", GameDeveloper.Type).Ref("activities").Field("developer_id").Unique(),
		edge.From("character", GameCharacter.Type).Ref("activities").Field("character_id").Unique(),
		edge.From("file", GameDownloadResourceFile.Type).Ref("activities").Field("file_id").Unique(),
	}
}

func (Activity) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("created").StorageKey("activities_created_idx"),
		index.Fields("walkthrough_id", "created").StorageKey("activities_walkthrough_id_created_idx"),
	}
}
