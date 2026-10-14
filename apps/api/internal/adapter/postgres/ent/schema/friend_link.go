package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type FriendLink struct {
	ent.Schema
}

func (FriendLink) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("friend_links")}
}

func (FriendLink) Fields() []ent.Field {
	return []ent.Field{
		serialID(),
		field.String("name").MaxRuneLen(50).SchemaType(varchar(50)),
		field.String("url").MaxRuneLen(500).SchemaType(varchar(500)),
		field.String("logo").MaxRuneLen(500).SchemaType(varchar(500)).Optional().Nillable(),
		field.String("description").MaxRuneLen(200).SchemaType(varchar(200)).Default(""),
		field.Bool("visible").Default(true),
		field.Int("position").SchemaType(pg("integer")).Default(0),
		created(),
		updated(),
	}
}

func (FriendLink) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("position").StorageKey("friend_links_position_idx"),
	}
}
