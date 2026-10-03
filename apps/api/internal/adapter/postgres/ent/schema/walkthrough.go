package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type Walkthrough struct {
	ent.Schema
}

func (Walkthrough) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("walkthroughs")}
}

func (Walkthrough) Fields() []ent.Field {
	return []ent.Field{
		serialID(),
		field.Int("game_id").SchemaType(pg("integer")),
		field.String("title").MaxLen(255).SchemaType(varchar(255)),
		field.JSON("content", rawJSON).SchemaType(jsonbType),
		field.String("html").MaxLen(100000).SchemaType(varchar(100000)),
		field.String("lang").MaxLen(16).SchemaType(varchar(16)).Optional().Nillable(),
		created(),
		updated(),
		field.Bool("edited").Default(false),
		field.Enum("status").Values("DRAFT", "PUBLISHED", "HIDDEN", "DELETED").SchemaType(pgEnum("walkthrough_status")).Default("DRAFT"),
		field.Int("creator_id").SchemaType(pg("integer")),
		field.Bool("review_pending").Default(false),
	}
}

func (Walkthrough) Edges() []ent.Edge {
	return []ent.Edge{
		edge.To("activities", Activity.Type).StorageKey(edge.Symbol("activities_walkthrough_id_fkey")).Annotations(entsql.OnDelete(entsql.Cascade)),
		edge.From("game", Game.Type).Ref("walkthroughs").Field("game_id").Unique().Required(),
		edge.To("moderates", ModerationEvent.Type).StorageKey(edge.Symbol("moderation_events_walkthrough_id_fkey")).Annotations(entsql.OnDelete(entsql.Cascade)),
		edge.From("creator", User.Type).Ref("walkthroughs").Field("creator_id").Unique().Required(),
	}
}

func (Walkthrough) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("game_id", "created").StorageKey("walkthroughs_game_id_created_idx"),
		index.Fields("creator_id", "created").StorageKey("walkthroughs_creator_id_created_idx"),
	}
}
