package main

import (
	atlasschema "ariga.io/atlas/sql/schema"
	"entgo.io/ent/dialect/sql/schema"
)

func schemaDiffOptions() []atlasschema.DiffOption {
	return []atlasschema.DiffOption{
		atlasschema.DiffSkipChanges(&atlasschema.DropObject{}),
	}
}

func conventionHook(next schema.Differ) schema.Differ {
	return schema.DiffFunc(func(current, desired *atlasschema.Schema) ([]atlasschema.Change, error) {
		for _, table := range desired.Tables {
			for _, fk := range table.ForeignKeys {
				fk.OnUpdate = atlasschema.Cascade
			}
		}
		return next.Diff(current, desired)
	})
}
