package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type SettingChange struct {
	ent.Schema
}

func (SettingChange) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("setting_changes")}
}

func (SettingChange) Fields() []ent.Field {
	return []ent.Field{
		serialID(),
		field.String("name").MaxLen(128).SchemaType(varchar(128)),
		field.JSON("previous", rawJSON).SchemaType(jsonbType).Optional(),
		field.JSON("value", rawJSON).SchemaType(jsonbType).Optional(),
		field.Int("actor_id").SchemaType(pg("integer")).Optional().Nillable(),
		created(),
	}
}

func (SettingChange) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("actor", User.Type).Ref("setting_changes").Field("actor_id").Unique(),
	}
}

func (SettingChange) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("name", "created").StorageKey("setting_changes_name_created_idx"),
	}
}
