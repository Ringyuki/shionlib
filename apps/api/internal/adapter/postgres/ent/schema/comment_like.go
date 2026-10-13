package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type CommentLike struct {
	ent.Schema
}

func (CommentLike) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("comment_likes"), field.ID("comment_id", "user_id")}
}

func (CommentLike) Fields() []ent.Field {
	return []ent.Field{
		field.Int("comment_id").SchemaType(pg("integer")),
		field.Int("user_id").SchemaType(pg("integer")),
	}
}

func (CommentLike) Edges() []ent.Edge {
	return []ent.Edge{
		edge.To("comment", Comment.Type).Unique().Required().Field("comment_id").StorageKey(edge.Symbol("comment_likes_comment_id_fkey")).Annotations(entsql.OnDelete(entsql.Cascade)),
		edge.To("user", User.Type).Unique().Required().Field("user_id").StorageKey(edge.Symbol("comment_likes_user_id_fkey")).Annotations(entsql.OnDelete(entsql.Cascade)),
	}
}

func (CommentLike) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("user_id").StorageKey("comment_likes_user_id_idx"),
	}
}
