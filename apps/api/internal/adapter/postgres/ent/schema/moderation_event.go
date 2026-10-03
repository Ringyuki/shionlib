package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type ModerationEvent struct {
	ent.Schema
}

func (ModerationEvent) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("moderation_events")}
}

func (ModerationEvent) Fields() []ent.Field {
	return []ent.Field{
		serialID(),
		field.Int("audit_by").SchemaType(pg("integer")).Default(1),
		field.Text("model").Default("omni-moderation-latest"),
		field.Enum("decision").Values("ALLOW", "BLOCK", "REVIEW").SchemaType(pgEnum("moderation_decision")).Default("REVIEW"),
		field.Enum("top_category").Values("HARASSMENT", "HARASSMENT_THREATENING", "SEXUAL", "SEXUAL_MINORS", "HATE", "HATE_THREATENING", "ILLICIT", "ILLICIT_VIOLENT", "SELF_HARM", "SELF_HARM_INTENT", "SELF_HARM_INSTRUCTIONS", "VIOLENCE", "VIOLENCE_GRAPHIC", "SPAM", "MEANINGLESS").SchemaType(pgEnum("moderate_category_key")),
		field.JSON("categories_json", rawJSON).SchemaType(jsonbType),
		field.String("max_score").SchemaType(pg("numeric(6,5)")).Optional().Nillable(),
		field.JSON("scores_json", rawJSON).SchemaType(jsonbType).Optional(),
		field.String("reason").MaxLen(2550).SchemaType(varchar(2550)).Optional().Nillable(),
		field.String("evidence").MaxLen(1000).SchemaType(varchar(1000)).Optional().Nillable(),
		field.Int("comment_id").SchemaType(pg("integer")).Optional().Nillable(),
		field.Int("walkthrough_id").SchemaType(pg("integer")).Optional().Nillable(),
		field.Time("created_at").SchemaType(timestamp3).Default(now).Annotations(entsql.DefaultExpr("CURRENT_TIMESTAMP")),
		field.Time("updated_at").SchemaType(timestamp3).Default(now).UpdateDefault(now),
	}
}

func (ModerationEvent) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("comment", Comment.Type).Ref("moderates").Field("comment_id").Unique(),
		edge.From("walkthrough", Walkthrough.Type).Ref("moderates").Field("walkthrough_id").Unique(),
	}
}

func (ModerationEvent) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("comment_id", "created_at").StorageKey("moderation_events_comment_id_created_at_idx"),
		index.Fields("walkthrough_id", "created_at").StorageKey("moderation_events_walkthrough_id_created_at_idx"),
	}
}
