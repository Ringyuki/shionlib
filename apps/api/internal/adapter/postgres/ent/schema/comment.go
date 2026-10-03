package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type Comment struct {
	ent.Schema
}

func (Comment) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("comments")}
}

func (Comment) Fields() []ent.Field {
	return []ent.Field{
		serialID(),
		field.JSON("content", rawJSON).SchemaType(jsonbType),
		field.String("html").MaxLen(100000).SchemaType(varchar(100000)).Optional().Nillable(),
		field.Int("game_id").SchemaType(pg("integer")),
		field.Int("parent_id").SchemaType(pg("integer")).Optional().Nillable(),
		field.Int("root_id").SchemaType(pg("integer")).Optional().Nillable(),
		field.Int("reply_count").SchemaType(pg("integer")).Default(0),
		field.Int("creator_id").SchemaType(pg("integer")),
		field.Int("status").SchemaType(pg("integer")).Default(1),
		field.Bool("edited").Default(false),
		created(),
		updated(),
	}
}

func (Comment) Edges() []ent.Edge {
	return []ent.Edge{
		edge.To("activities", Activity.Type).StorageKey(edge.Symbol("activities_comment_id_fkey")).Annotations(entsql.OnDelete(entsql.Cascade)),
		edge.From("game", Game.Type).Ref("comments").Field("game_id").Unique().Required(),
		edge.To("children", Comment.Type).StorageKey(edge.Symbol("comments_parent_id_fkey")).Annotations(entsql.OnDelete(entsql.SetNull)),
		edge.From("parent", Comment.Type).Ref("children").Field("parent_id").Unique(),
		edge.To("root_descendants", Comment.Type).StorageKey(edge.Symbol("comments_root_id_fkey")).Annotations(entsql.OnDelete(entsql.SetNull)),
		edge.From("root", Comment.Type).Ref("root_descendants").Field("root_id").Unique(),
		edge.From("creator", User.Type).Ref("comments").Field("creator_id").Unique().Required(),
		edge.To("liked_users", User.Type).Through("likes", CommentLike.Type),
		edge.To("messages", Message.Type).StorageKey(edge.Symbol("messages_comment_id_fkey")).Annotations(entsql.OnDelete(entsql.Cascade)),
		edge.To("moderates", ModerationEvent.Type).StorageKey(edge.Symbol("moderation_events_comment_id_fkey")).Annotations(entsql.OnDelete(entsql.Cascade)),
	}
}

func (Comment) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("game_id", "created").StorageKey("comments_game_id_created_idx"),
		index.Fields("parent_id", "created").StorageKey("comments_parent_id_created_idx"),
		index.Fields("creator_id", "created").StorageKey("comments_creator_id_created_idx"),
	}
}
