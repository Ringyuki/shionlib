package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type GameDeveloper struct {
	ent.Schema
}

func (GameDeveloper) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("game_developers")}
}

func (GameDeveloper) Fields() []ent.Field {
	return []ent.Field{
		serialID(),
		field.Text("b_id").Optional().Nillable(),
		field.Text("v_id").Optional().Nillable(),
		field.Int("h_id").SchemaType(pg("integer")).Unique().Optional().Nillable(),
		field.String("name").MaxLen(255).SchemaType(varchar(255)).Default(""),
		field.Other("aliases", stringsType).SchemaType(textArray).Optional().Annotations(emptyArray("text[]")),
		field.Text("logo").Optional().Nillable(),
		field.String("intro_jp").MaxLen(20000).SchemaType(varchar(20000)).Default(""),
		field.String("intro_zh").MaxLen(20000).SchemaType(varchar(20000)).Default(""),
		field.String("intro_en").MaxLen(20000).SchemaType(varchar(20000)).Default(""),
		field.Text("website").Optional().Nillable(),
		field.JSON("extra_info", rawJSON).SchemaType(jsonbType).Annotations(entsql.DefaultExpr("'[]'::jsonb")).Optional(),
		field.Int("parent_developer_id").SchemaType(pg("integer")).Optional().Nillable(),
		created(),
		updated(),
	}
}

func (GameDeveloper) Edges() []ent.Edge {
	return []ent.Edge{
		edge.To("activities", Activity.Type).StorageKey(edge.Symbol("activities_developer_id_fkey")).Annotations(entsql.OnDelete(entsql.Cascade)),
		edge.To("games", GameDeveloperRelation.Type).StorageKey(edge.Symbol("game_developer_relations_developer_id_fkey")).Annotations(entsql.OnDelete(entsql.Restrict)),
		edge.To("child_developers", GameDeveloper.Type).StorageKey(edge.Symbol("game_developers_parent_developer_id_fkey")).Annotations(entsql.OnDelete(entsql.SetNull)),
		edge.From("parent_developer", GameDeveloper.Type).Ref("child_developers").Field("parent_developer_id").Unique(),
	}
}

func (GameDeveloper) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("b_id", "v_id").Unique().StorageKey("game_developers_b_id_v_id_key"),
		index.Fields("b_id", "v_id").StorageKey("game_developers_b_id_v_id_idx"),
		index.Fields("b_id").StorageKey("game_developers_b_id_idx"),
		index.Fields("v_id").StorageKey("game_developers_v_id_idx"),
		index.Fields("name").Annotations(entsql.IndexType("GIN"), entsql.OpClass("gin_trgm_ops")).StorageKey("game_developers_name_trgm_idx"),
		index.Fields("parent_developer_id").StorageKey("game_developers_parent_developer_id_idx"),
	}
}
