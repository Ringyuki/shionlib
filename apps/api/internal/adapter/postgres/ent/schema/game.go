package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type Game struct {
	ent.Schema
}

func (Game) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("games")}
}

func (Game) Fields() []ent.Field {
	return []ent.Field{
		serialID(),
		field.Text("v_id").Optional().Nillable(),
		field.Text("b_id").Optional().Nillable(),
		field.Int("h_id").SchemaType(pg("integer")).Unique().Optional().Nillable(),
		field.String("title_jp").MaxLen(255).SchemaType(varchar(255)).Default(""),
		field.String("title_zh").MaxLen(255).SchemaType(varchar(255)).Default(""),
		field.String("title_en").MaxLen(255).SchemaType(varchar(255)).Default(""),
		field.Other("aliases", stringsType).SchemaType(textArray).Optional().Annotations(emptyArray("text[]")),
		field.String("intro_jp").MaxLen(20000).SchemaType(varchar(20000)).Default(""),
		field.String("intro_zh").MaxLen(20000).SchemaType(varchar(20000)).Default(""),
		field.String("intro_en").MaxLen(20000).SchemaType(varchar(20000)).Default(""),
		field.Time("release_date").SchemaType(timestamp3).Optional().Nillable(),
		field.Bool("release_date_tba").Default(false),
		field.JSON("extra_info", rawJSON).SchemaType(jsonbType).Annotations(entsql.DefaultExpr("'[]'::jsonb")).Optional(),
		field.JSON("staffs", rawJSON).SchemaType(jsonbType).Annotations(entsql.DefaultExpr("'[]'::jsonb")).Optional(),
		field.Bool("nsfw").Default(false),
		field.Text("type").Optional().Nillable(),
		field.Other("platform", stringsType).SchemaType(textArray).Optional().Annotations(emptyArray("text[]")),
		field.Int("downloads").SchemaType(pg("integer")).Default(0),
		field.Int("views").SchemaType(pg("integer")).Default(0),
		field.Float("hot_score").Default(0),
		field.Int("creator_id").SchemaType(pg("integer")),
		field.Int("status").SchemaType(pg("integer")).Default(1),
		created(),
		updated(),
	}
}

func (Game) Edges() []ent.Edge {
	return []ent.Edge{
		edge.To("activities", Activity.Type).StorageKey(edge.Symbol("activities_game_id_fkey")).Annotations(entsql.OnDelete(entsql.Cascade)),
		edge.To("characters", GameCharacterRelation.Type).StorageKey(edge.Symbol("game_character_relations_game_id_fkey")).Annotations(entsql.OnDelete(entsql.Cascade)),
		edge.To("comments", Comment.Type).StorageKey(edge.Symbol("comments_game_id_fkey")).Annotations(entsql.OnDelete(entsql.Cascade)),
		edge.To("developers", GameDeveloperRelation.Type).StorageKey(edge.Symbol("game_developer_relations_game_id_fkey")).Annotations(entsql.OnDelete(entsql.Cascade)),
		edge.To("download_resources", GameDownloadResource.Type).StorageKey(edge.Symbol("game_download_resources_game_id_fkey")).Annotations(entsql.OnDelete(entsql.Cascade)),
		edge.To("malware_scan_cases", MalwareScanCase.Type).StorageKey(edge.Symbol("malware_scan_cases_game_id_fkey")).Annotations(entsql.OnDelete(entsql.SetNull)),
		edge.To("favorite_items", FavoriteItem.Type).StorageKey(edge.Symbol("favorite_items_game_id_fkey")).Annotations(entsql.OnDelete(entsql.Cascade)),
		edge.To("covers", GameCover.Type).StorageKey(edge.Symbol("game_covers_game_id_fkey")).Annotations(entsql.OnDelete(entsql.Cascade)),
		edge.To("images", GameImage.Type).StorageKey(edge.Symbol("game_images_game_id_fkey")).Annotations(entsql.OnDelete(entsql.Cascade)),
		edge.To("tags", Tag.Type).Through("tag_relations", GameTagRelation.Type).StorageKey(edge.Table("game_tag_relations"), edge.Columns("game_id", "tag_id"), edge.Symbols("game_tag_relations_game_id_fkey", "game_tag_relations_tag_id_fkey")),
		edge.To("link", GameLink.Type).StorageKey(edge.Symbol("game_links_game_id_fkey")).Annotations(entsql.OnDelete(entsql.Cascade)),
		edge.From("creator", User.Type).Ref("games").Field("creator_id").Unique().Required(),
		edge.To("messages", Message.Type).StorageKey(edge.Symbol("messages_game_id_fkey")).Annotations(entsql.OnDelete(entsql.Cascade)),
		edge.To("pvn_mappings", UserGamePvnMapping.Type).StorageKey(edge.Symbol("user_game_pvn_mappings_game_id_fkey")).Annotations(entsql.OnDelete(entsql.Cascade)),
		edge.To("walkthroughs", Walkthrough.Type).StorageKey(edge.Symbol("walkthroughs_game_id_fkey")).Annotations(entsql.OnDelete(entsql.Cascade)),
		edge.To("relations_from", GameRelation.Type).StorageKey(edge.Symbol("game_relations_from_game_id_fkey")).Annotations(entsql.OnDelete(entsql.Cascade)),
		edge.To("relations_to", GameRelation.Type).StorageKey(edge.Symbol("game_relations_to_game_id_fkey")).Annotations(entsql.OnDelete(entsql.Cascade)),
	}
}

func (Game) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("b_id", "v_id").Unique().StorageKey("games_b_id_v_id_key"),
		index.Fields("b_id", "v_id").StorageKey("games_b_id_v_id_idx"),
		index.Fields("b_id").StorageKey("games_b_id_idx"),
		index.Fields("v_id").StorageKey("games_v_id_idx"),
		index.Fields("hot_score").StorageKey("games_hot_score_idx"),
		index.Fields("downloads").StorageKey("games_downloads_idx"),
	}
}
