package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type Message struct {
	ent.Schema
}

func (Message) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("messages")}
}

func (Message) Fields() []ent.Field {
	return []ent.Field{
		serialID(),
		field.Enum("type").Values("COMMENT_REPLY", "COMMENT_LIKE", "SYSTEM").SchemaType(pgEnum("message_type")),
		field.Enum("tone").Values("PRIMARY", "SECONDARY", "SUCCESS", "WARNING", "INFO", "DESTRUCTIVE", "NEUTRAL").SchemaType(pgEnum("message_tone")).Default("INFO"),
		field.String("title").MaxLen(255).SchemaType(varchar(255)),
		field.String("content").MaxLen(10240).SchemaType(varchar(10240)),
		field.String("link_text").MaxLen(255).SchemaType(varchar(255)).Optional().Nillable(),
		field.String("link_url").MaxLen(255).SchemaType(varchar(255)).Optional().Nillable(),
		field.Bool("external_link").Default(false),
		field.JSON("meta", rawJSON).SchemaType(jsonbType).Optional(),
		field.Int("comment_id").SchemaType(pg("integer")).Optional().Nillable(),
		field.Int("game_id").SchemaType(pg("integer")).Optional().Nillable(),
		field.Int("sender_id").SchemaType(pg("integer")).Optional().Nillable(),
		field.Int("receiver_id").SchemaType(pg("integer")),
		field.Bool("read").Default(false),
		field.Time("read_at").SchemaType(timestamp3).Optional().Nillable(),
		created(),
		updated(),
	}
}

func (Message) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("comment", Comment.Type).Ref("messages").Field("comment_id").Unique(),
		edge.From("game", Game.Type).Ref("messages").Field("game_id").Unique(),
		edge.From("sender", User.Type).Ref("messages_sent").Field("sender_id").Unique(),
		edge.From("receiver", User.Type).Ref("messages").Field("receiver_id").Unique().Required(),
	}
}

func (Message) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("receiver_id", "read", "created").StorageKey("messages_receiver_id_read_created_idx"),
	}
}
