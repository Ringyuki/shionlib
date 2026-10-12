package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type Inspection struct {
	ent.Schema
}

func (Inspection) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("file_inspections")}
}

func (Inspection) Fields() []ent.Field {
	return []ent.Field{
		serialID(),
		field.Int("resource_id").SchemaType(pg("integer")),
		field.String("status").MaxRuneLen(16).SchemaType(varchar(16)),
		field.String("archive_format").MaxRuneLen(32).SchemaType(varchar(32)).Default(""),
		field.Bool("solid").Default(false),
		field.Int("volumes").SchemaType(pg("integer")).Default(0),
		field.Bool("recovery").Default(false),
		field.Int("recovery_percent").SchemaType(pg("integer")).Default(0),
		field.String("name_encoding").MaxRuneLen(32).SchemaType(varchar(32)).Default(""),
		field.Bool("unsupported_method").Default(false),
		field.Int("file_count").SchemaType(pg("integer")).Default(0),
		field.Int("folder_count").SchemaType(pg("integer")).Default(0),
		field.Int64("unpacked_size").Default(0),
		field.Int("disc_count").SchemaType(pg("integer")).Default(0),
		field.Int("disc_file_count").SchemaType(pg("integer")).Default(0),
		field.Bool("truncated").Default(false),
		field.Bool("verified").Default(false),
		field.String("scan_engine").MaxRuneLen(64).SchemaType(varchar(64)).Default(""),
		field.Time("signatures_at").SchemaType(timestamp3).Optional().Nillable(),
		field.Int("scanned_count").SchemaType(pg("integer")).Default(0),
		field.Other("scan_skipped", stringsType).SchemaType(textArray).Optional().Annotations(emptyArray("text[]")),
		field.Int64("scan_limit").Default(0),
		field.JSON("detections", rawJSON).SchemaType(jsonbType).Optional(),
		field.Time("scanned_at").SchemaType(timestamp3).Optional().Nillable(),
		field.Time("cleared_at").SchemaType(timestamp3).Optional().Nillable(),
		created(),
		updated(),
	}
}

func (Inspection) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("resource", GameDownloadResource.Type).Ref("inspections").Field("resource_id").Unique().Required(),
		edge.To("entries", InspectionEntry.Type).StorageKey(edge.Symbol("file_inspection_entries_inspection_id_fkey")).Annotations(entsql.OnDelete(entsql.Cascade)),
		edge.To("files", GameDownloadResourceFile.Type).StorageKey(edge.Symbol("game_download_resource_files_inspection_id_fkey")).Annotations(entsql.OnDelete(entsql.SetNull)),
	}
}

func (Inspection) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("resource_id").StorageKey("file_inspections_resource_id_idx"),
	}
}
