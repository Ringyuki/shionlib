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
		field.String("source").MaxLen(32).SchemaType(varchar(32)).Unique(),
		field.String("cursor").MaxLen(255).SchemaType(varchar(255)),
		created(),
		updated(),
	}
}
