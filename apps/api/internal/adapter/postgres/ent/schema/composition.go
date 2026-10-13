package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type Composition struct {
	ent.Schema
}

func (Composition) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("resource_compositions")}
}

func (Composition) Fields() []ent.Field {
	return []ent.Field{
		serialID(),
		field.Int("game_id").SchemaType(pg("integer")),
		field.Int("creator_id").SchemaType(pg("integer")),
		field.Int("resource_id").SchemaType(pg("integer")).Optional().Nillable(),
		field.Int("target_file_id").SchemaType(pg("integer")).Optional().Nillable(),
		field.JSON("base", rawJSON).SchemaType(jsonbType),
		field.JSON("patch", rawJSON).SchemaType(jsonbType).Optional(),
		field.JSON("save", rawJSON).SchemaType(jsonbType).Optional(),
		field.JSON("patch_entries", rawJSON).SchemaType(jsonbType).Optional(),
		field.JSON("save_entries", rawJSON).SchemaType(jsonbType).Optional(),
		field.JSON("details", rawJSON).SchemaType(jsonbType),
		field.Text("game_dir").Optional().Nillable(),
		field.Text("patch_dir").Optional().Nillable(),
		field.Bool("keep_patch").Default(true),
		field.Text("note").Optional().Nillable(),
		field.JSON("patch_match", rawJSON).SchemaType(jsonbType).Optional(),
		field.JSON("plan", rawJSON).SchemaType(jsonbType).Optional(),
		field.String("state").MaxRuneLen(16).SchemaType(varchar(16)),
		field.String("step").MaxRuneLen(16).SchemaType(varchar(16)).Optional().Nillable(),
		field.Int("percent").SchemaType(pg("integer")).Default(0),
		field.JSON("runs", rawJSON).SchemaType(jsonbType).Optional(),
		field.String("failure").MaxRuneLen(32).SchemaType(varchar(32)).Optional().Nillable(),
		field.Text("failure_detail").Optional().Nillable(),
		field.Text("output_name").Default(""),
		field.Int64("output_size").Optional().Nillable(),
		field.Time("queued_at").SchemaType(timestamp3).Optional().Nillable(),
		field.Time("started_at").SchemaType(timestamp3).Optional().Nillable(),
		field.Time("finished_at").SchemaType(timestamp3).Optional().Nillable(),
		created(),
		updated(),
	}
}

func (Composition) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("resource", GameDownloadResource.Type).Ref("compositions").Field("resource_id").Unique(),
	}
}

func (Composition) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("resource_id").StorageKey("resource_compositions_resource_id_idx"),
		index.Fields("creator_id", "state").StorageKey("resource_compositions_creator_id_state_idx"),
		index.Fields("state", "queued_at").StorageKey("resource_compositions_state_queued_at_idx"),
	}
}
