package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type User struct {
	ent.Schema
}

func (User) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("users")}
}

func (User) Fields() []ent.Field {
	return []ent.Field{
		serialID(),
		field.String("name").MaxLen(20).SchemaType(varchar(20)).Unique(),
		field.String("email").MaxLen(255).SchemaType(varchar(255)).Unique(),
		field.String("password").MaxLen(255).SchemaType(varchar(255)).Sensitive().Optional().Nillable(),
		field.Text("avatar").Optional().Nillable(),
		field.Text("cover").Optional().Nillable(),
		field.Text("bio").Optional().Nillable(),
		field.Enum("lang").Values("en", "zh", "ja").SchemaType(pgEnum("user_lang")).Default("en"),
		field.Int("content_limit").SchemaType(pg("integer")).Default(2),
		field.Bool("only_games_with_resources").Default(true),
		field.Int("role").SchemaType(pg("integer")).Default(1),
		field.Int("status").SchemaType(pg("integer")).Default(1),
		field.Int("upload_injected_file_times").SchemaType(pg("integer")).Default(0),
		field.Time("email_verified_at").SchemaType(timestamp3).Optional().Nillable(),
		field.Time("last_login_at").SchemaType(timestamp3).Optional().Nillable(),
		field.Bool("two_factor_enabled").Default(false),
		field.Time("sponsor_expires_at").SchemaType(timestamp3).Optional().Nillable(),
		created(),
		updated(),
	}
}

func (User) Edges() []ent.Edge {
	return []ent.Edge{
		edge.To("activities", Activity.Type).StorageKey(edge.Symbol("activities_user_id_fkey")).Annotations(entsql.OnDelete(entsql.Restrict)),
		edge.To("comments", Comment.Type).StorageKey(edge.Symbol("comments_creator_id_fkey")).Annotations(entsql.OnDelete(entsql.Restrict)),
		edge.From("liked_comments", Comment.Type).Ref("liked_users").Through("comment_likes", CommentLike.Type),
		edge.To("game_download_resources", GameDownloadResource.Type).StorageKey(edge.Symbol("game_download_resources_creator_id_fkey")).Annotations(entsql.OnDelete(entsql.Restrict)),
		edge.To("game_download_resource_reports", GameDownloadResourceReport.Type).StorageKey(edge.Symbol("game_download_resource_reports_reporter_id_fkey")).Annotations(entsql.OnDelete(entsql.Cascade)),
		edge.To("game_download_resource_reported", GameDownloadResourceReport.Type).StorageKey(edge.Symbol("game_download_resource_reports_reported_user_id_fkey")).Annotations(entsql.OnDelete(entsql.Cascade)),
		edge.To("game_download_resource_report_process", GameDownloadResourceReport.Type).StorageKey(edge.Symbol("game_download_resource_reports_processed_by_fkey")).Annotations(entsql.OnDelete(entsql.SetNull)),
		edge.To("malware_scan_cases", MalwareScanCase.Type).StorageKey(edge.Symbol("malware_scan_cases_uploader_id_fkey")).Annotations(entsql.OnDelete(entsql.Cascade)),
		edge.To("malware_scan_case_reviews", MalwareScanCase.Type).StorageKey(edge.Symbol("malware_scan_cases_reviewed_by_fkey")).Annotations(entsql.OnDelete(entsql.SetNull)),
		edge.To("game_download_resource_files", GameDownloadResourceFile.Type).StorageKey(edge.Symbol("game_download_resource_files_creator_id_fkey")).Annotations(entsql.OnDelete(entsql.Restrict)),
		edge.To("game_download_resource_file_histories", GameDownloadResourceFileHistory.Type).StorageKey(edge.Symbol("game_download_resource_file_histories_operator_id_fkey")).Annotations(entsql.OnDelete(entsql.Restrict)),
		edge.To("field_permissions", UserFieldPermission.Type).StorageKey(edge.Symbol("user_field_permissions_user_id_fkey")).Annotations(entsql.OnDelete(entsql.Cascade)),
		edge.To("edit_records", EditRecord.Type).StorageKey(edge.Symbol("edit_records_actor_id_fkey")).Annotations(entsql.OnDelete(entsql.Cascade)),
		edge.To("favorites", Favorite.Type).StorageKey(edge.Symbol("favorites_user_id_fkey")).Annotations(entsql.OnDelete(entsql.Cascade)),
		edge.To("games", Game.Type).StorageKey(edge.Symbol("games_creator_id_fkey")).Annotations(entsql.OnDelete(entsql.Restrict)),
		edge.To("messages_sent", Message.Type).StorageKey(edge.Symbol("messages_sender_id_fkey")).Annotations(entsql.OnDelete(entsql.Cascade)),
		edge.To("messages", Message.Type).StorageKey(edge.Symbol("messages_receiver_id_fkey")).Annotations(entsql.OnDelete(entsql.Restrict)),
		edge.To("sponsor_orders", SponsorOrder.Type).StorageKey(edge.Symbol("sponsor_orders_user_id_fkey")).Annotations(entsql.OnDelete(entsql.SetNull)),
		edge.To("game_pvn_mappings", UserGamePvnMapping.Type).StorageKey(edge.Symbol("user_game_pvn_mappings_user_id_fkey")).Annotations(entsql.OnDelete(entsql.Cascade)),
		edge.To("potatovn_binding", UserPvnBinding.Type).Unique().StorageKey(edge.Symbol("user_pvn_bindings_user_id_fkey")).Annotations(entsql.OnDelete(entsql.Cascade)),
		edge.To("game_upload_sessions", GameUploadSession.Type).StorageKey(edge.Symbol("game_upload_sessions_creator_id_fkey")).Annotations(entsql.OnDelete(entsql.Restrict)),
		edge.To("upload_quota", UserUploadQuota.Type).Unique().StorageKey(edge.Symbol("user_upload_quotas_user_id_fkey")).Annotations(entsql.OnDelete(entsql.Cascade)),
		edge.To("walkthroughs", Walkthrough.Type).StorageKey(edge.Symbol("walkthroughs_creator_id_fkey")).Annotations(entsql.OnDelete(entsql.Cascade)),
		edge.To("banned_records", UserBannedRecord.Type).StorageKey(edge.Symbol("user_banned_records_user_id_fkey")).Annotations(entsql.OnDelete(entsql.Restrict)),
		edge.To("banned_by_records", UserBannedRecord.Type).StorageKey(edge.Symbol("user_banned_records_banned_by_fkey")).Annotations(entsql.OnDelete(entsql.SetNull)),
		edge.To("sessions", UserLoginSession.Type).StorageKey(edge.Symbol("user_login_sessions_user_id_fkey")).Annotations(entsql.OnDelete(entsql.Restrict)),
		edge.To("passkeys", UserPasskeyCredential.Type).StorageKey(edge.Symbol("user_passkey_credentials_user_id_fkey")).Annotations(entsql.OnDelete(entsql.Restrict)),
		edge.To("oidc_identities", OidcIdentity.Type).StorageKey(edge.Symbol("oidc_identities_user_id_fkey")).Annotations(entsql.OnDelete(entsql.Restrict)),
	}
}

func (User) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("email").StorageKey("users_email_idx"),
		index.Fields("name").StorageKey("users_name_idx"),
		index.Fields("created").StorageKey("users_created_idx"),
		index.Fields("role").StorageKey("users_role_idx"),
	}
}
