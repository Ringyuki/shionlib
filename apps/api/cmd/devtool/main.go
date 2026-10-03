package main

import (
	"context"
	"fmt"
	"os"
)

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, "devtool:", err)
		os.Exit(1)
	}
}

func run(args []string) error {
	if len(args) == 2 && args[0] == "e2e" {
		return runE2E(context.Background(), args[1])
	}
	root, err := moduleRoot()
	if err != nil {
		return err
	}
	if len(args) < 2 {
		return usage()
	}
	switch args[0] + " " + args[1] {
	case "migrate diff":
		if len(args) < 3 {
			return fmt.Errorf("usage: devtool migrate diff <name>")
		}
		return diffMigration(context.Background(), root, args[2])
	case "feature create":
		if len(args) < 4 {
			return fmt.Errorf("usage: devtool feature create <name> <range-prefix>")
		}
		return createFeature(root, args[2], args[3])
	case "bizcode check":
		return checkBizCodes(root)
	case "bizcode docs":
		return writeBizCodeDocs(root)
	case "migrate check":
		return checkMigrationDrift(context.Background(), root)
	case "deploy env":
		return printDeployEnv()
	case "deploy check":
		return checkDeployEnv(root)
	default:
		return usage()
	}
}

func usage() error {
	return fmt.Errorf("usage: devtool <migrate diff <name> | migrate check | bizcode check | bizcode docs | feature create <name> <range> | deploy env | deploy check | e2e reset|seed|prepare>")
}

func moduleRoot() (string, error) {
	dir, err := os.Getwd()
	if err != nil {
		return "", err
	}
	for {
		if _, err := os.Stat(dir + "/go.mod"); err == nil {
			return dir, nil
		}
		parent := dir[:max(0, lastSlash(dir))]
		if parent == dir || parent == "" {
			return "", fmt.Errorf("go.mod not found from working directory")
		}
		dir = parent
	}
}

func lastSlash(path string) int {
	for i := len(path) - 1; i >= 0; i-- {
		if path[i] == '/' {
			return i
		}
	}
	return -1
}
