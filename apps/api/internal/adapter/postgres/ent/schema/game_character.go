package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type GameCharacter struct {
	ent.Schema
}

func (GameCharacter) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("game_characters")}
}

func (GameCharacter) Fields() []ent.Field {
	return []ent.Field{
		serialID(),
		field.Text("b_id").Optional().Nillable(),
		field.Text("v_id").Optional().Nillable(),
		field.Int("h_id").SchemaType(pg("integer")).Unique().Optional().Nillable(),
		field.Text("image").Optional().Nillable(),
		field.Text("name_jp").Default(""),
		field.Text("name_zh").Optional().Nillable(),
		field.Text("name_en").Optional().Nillable(),
		field.Other("aliases", stringsType).SchemaType(textArray).Optional().Annotations(emptyArray("text[]")),
		field.String("intro_jp").MaxLen(20000).SchemaType(varchar(20000)).Default(""),
		field.String("intro_zh").MaxLen(20000).SchemaType(varchar(20000)).Default(""),
		field.String("intro_en").MaxLen(20000).SchemaType(varchar(20000)).Default(""),
		field.Enum("blood_type").Values("a", "b", "ab", "o").SchemaType(pgEnum("game_character_blood_type")).Optional().Nillable(),
		field.Int("height").SchemaType(pg("integer")).Optional().Nillable(),
		field.Int("weight").SchemaType(pg("integer")).Optional().Nillable(),
		field.Int("bust").SchemaType(pg("integer")).Optional().Nillable(),
		field.Int("waist").SchemaType(pg("integer")).Optional().Nillable(),
		field.Int("hips").SchemaType(pg("integer")).Optional().Nillable(),
		field.Text("cup").Optional().Nillable(),
		field.Int("age").SchemaType(pg("integer")).Optional().Nillable(),
		field.Other("birthday", intsType).SchemaType(intArray).Optional(),
		field.Other("gender", stringsType).SchemaType(pgEnumArray("game_character_gender")).Optional().Annotations(emptyArray("game_character_gender[]")),
		created(),
		updated(),
	}
}

func (GameCharacter) Edges() []ent.Edge {
	return []ent.Edge{
		edge.To("activities", Activity.Type).StorageKey(edge.Symbol("activities_character_id_fkey")).Annotations(entsql.OnDelete(entsql.Cascade)),
		edge.To("games", GameCharacterRelation.Type).StorageKey(edge.Symbol("game_character_relations_character_id_fkey")).Annotations(entsql.OnDelete(entsql.Restrict)),
	}
}

func (GameCharacter) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("b_id", "v_id").Unique().StorageKey("game_characters_b_id_v_id_key"),
		index.Fields("b_id", "v_id").StorageKey("game_characters_b_id_v_id_idx"),
		index.Fields("b_id").StorageKey("game_characters_b_id_idx"),
		index.Fields("v_id").StorageKey("game_characters_v_id_idx"),
		index.Fields("name_jp").Annotations(entsql.IndexType("GIN"), entsql.OpClass("gin_trgm_ops")).StorageKey("game_characters_name_jp_trgm_idx"),
		index.Fields("name_zh").Annotations(entsql.IndexType("GIN"), entsql.OpClass("gin_trgm_ops")).StorageKey("game_characters_name_zh_trgm_idx"),
		index.Fields("name_en").Annotations(entsql.IndexType("GIN"), entsql.OpClass("gin_trgm_ops")).StorageKey("game_characters_name_en_trgm_idx"),
	}
}
