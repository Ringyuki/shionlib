package main

import (
	"fmt"
	"os"
	"path/filepath"

	"entgo.io/ent/entc"
	"entgo.io/ent/entc/gen"
)

const entDir = "internal/adapter/postgres/ent"

func generateEnt(root string) error {
	config := &gen.Config{
		Target:  filepath.Join(root, entDir),
		Package: "github.com/Ringyuki/shionlib/apps/api/" + entDir,
		Features: []gen.Feature{
			gen.FeatureUpsert,
			gen.FeatureExecQuery,
			gen.FeatureModifier,
			gen.FeatureLock,
			gen.FeatureVersionedMigration,
		},
	}
	if err := entc.Generate(filepath.Join(root, entDir, "schema"), config); err != nil {
		return fmt.Errorf("generate ent: %w", err)
	}
	return nil
}

func main() {
	root, err := os.Getwd()
	if err != nil {
		fmt.Fprintln(os.Stderr, "entgen:", err)
		os.Exit(1)
	}
	if err := generateEnt(root); err != nil {
		fmt.Fprintln(os.Stderr, "entgen:", err)
		os.Exit(1)
	}
}
