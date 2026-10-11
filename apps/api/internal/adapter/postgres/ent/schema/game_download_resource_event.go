package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type GameDownloadResourceEvent struct {
	ent.Schema
}

func (GameDownloadResourceEvent) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("game_download_resource_events")}
}

func (GameDownloadResourceEvent) Fields() []ent.Field {
	return []ent.Field{
		serialID(),
		field.Int("resource_id").SchemaType(pg("integer")),
		field.String("kind").MaxRuneLen(32).SchemaType(varchar(32)),
		field.Int("actor_id").SchemaType(pg("integer")).Optional().Nillable(),
		field.JSON("data", rawJSON).SchemaType(jsonbType).Optional(),
		created(),
	}
}

func (GameDownloadResourceEvent) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("resource", GameDownloadResource.Type).Ref("events").Field("resource_id").Unique().Required(),
		edge.From("actor", User.Type).Ref("game_download_resource_events").Field("actor_id").Unique(),
	}
}

func (GameDownloadResourceEvent) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("resource_id", "created").StorageKey("game_download_resource_events_resource_id_created_idx"),
	}
}
