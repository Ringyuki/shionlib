package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/field"
)

type CatalogSyncCursor struct {
	ent.Schema
}

func (CatalogSyncCursor) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("catalog_sync_cursors")}
}

func (CatalogSyncCursor) Fields() []ent.Field {
	return []ent.Field{
		serialID(),
		field.String("source").MaxRuneLen(32).SchemaType(varchar(32)).Unique(),
		field.String("cursor").MaxRuneLen(255).SchemaType(varchar(255)),
		field.Time("pulled_at").SchemaType(timestamp3).Optional().Nillable(),
		field.Int("changes").SchemaType(pg("integer")).Default(0),
		field.Time("failed_at").SchemaType(timestamp3).Optional().Nillable(),
		field.String("last_error").MaxRuneLen(500).SchemaType(varchar(500)).Optional().Nillable(),
		created(),
		updated(),
	}
}
