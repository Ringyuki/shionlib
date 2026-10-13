package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type InspectionEntry struct {
	ent.Schema
}

func (InspectionEntry) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("file_inspection_entries")}
}

func (InspectionEntry) Fields() []ent.Field {
	return []ent.Field{
		serialID(),
		field.Int("inspection_id").SchemaType(pg("integer")),
		field.Int("parent_id").SchemaType(pg("integer")).Optional().Nillable(),
		field.Int("position").SchemaType(pg("integer")).Default(0),
		field.Text("name"),
		field.String("kind").MaxRuneLen(16).SchemaType(varchar(16)),
		field.Int64("size").Default(0),
		field.Time("modified").SchemaType(timestamp3).Optional().Nillable(),
		field.Int("items").SchemaType(pg("integer")).Default(0),
		field.Int("children").SchemaType(pg("integer")).Default(0),
		field.Bool("encrypted").Default(false),
		field.Bool("unreadable").Default(false),
		field.String("preview").MaxRuneLen(8).SchemaType(varchar(8)).Default(""),
		field.JSON("detail", rawJSON).SchemaType(jsonbType).Optional(),
	}
}

func (InspectionEntry) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("inspection", Inspection.Type).Ref("entries").Field("inspection_id").Unique().Required(),
	}
}

func (InspectionEntry) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("inspection_id", "parent_id", "position").StorageKey("file_inspection_entries_inspection_id_parent_id_position_idx"),
	}
}
