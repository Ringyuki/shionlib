package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type CatalogSourceLink struct {
	ent.Schema
}

func (CatalogSourceLink) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("catalog_source_links")}
}

func (CatalogSourceLink) Fields() []ent.Field {
	return []ent.Field{
		serialID(),
		field.String("source").MaxLen(32).SchemaType(varchar(32)),
		field.String("entity").MaxLen(16).SchemaType(varchar(16)),
		field.String("external_id").MaxLen(64).SchemaType(varchar(64)),
		field.Int("local_id").SchemaType(pg("integer")),
		field.String("revision").MaxLen(64).SchemaType(varchar(64)).Optional().Nillable(),
		field.Time("synced_at").SchemaType(timestamp3).Optional().Nillable(),
		field.Time("missing_at").SchemaType(timestamp3).Optional().Nillable(),
		field.Int("failures").SchemaType(pg("integer")).Default(0),
		field.String("last_error").MaxLen(500).SchemaType(varchar(500)).Optional().Nillable(),
		created(),
		updated(),
	}
}

func (CatalogSourceLink) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("source", "entity", "external_id").Unique().StorageKey("catalog_source_links_source_entity_external_id_key"),
		index.Fields("source", "entity", "local_id").Unique().StorageKey("catalog_source_links_source_entity_local_id_key"),
		index.Fields("source", "synced_at").StorageKey("catalog_source_links_source_synced_at_idx"),
	}
}
