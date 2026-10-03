package main

import (
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"regexp"
	"slices"
	"strings"

	"github.com/Ringyuki/shionlib/apps/api/internal/platform/config"
)

const (
	composePath      = "../../infra/compose.app.yml"
	environmentBlock = "x-api-environment:"
)

var passthrough = regexp.MustCompile(`^\s+([A-Z][A-Z0-9_]*):\s*\$\{([A-Z][A-Z0-9_]*)`)

func configEnvNames() []string {
	var names []string
	collectEnvNames(reflect.TypeFor[config.Config](), "", &names)
	slices.Sort(names)
	return slices.Compact(names)
}

func collectEnvNames(t reflect.Type, prefix string, names *[]string) {
	for field := range t.Fields() {
		if tag, ok := field.Tag.Lookup("env"); ok {
			if name := strings.Split(tag, ",")[0]; name != "" {
				*names = append(*names, prefix+name)
				continue
			}
		}
		fieldType := field.Type
		if fieldType.Kind() == reflect.Pointer {
			fieldType = fieldType.Elem()
		}
		if fieldType.Kind() == reflect.Struct {
			collectEnvNames(fieldType, prefix+field.Tag.Get("envPrefix"), names)
		}
	}
}

func printDeployEnv() error {
	for _, name := range configEnvNames() {
		if _, err := fmt.Fprintf(os.Stdout, "  %s: ${%s:-}\n", name, name); err != nil {
			return err
		}
	}
	return nil
}

func checkDeployEnv(root string) error {
	raw, err := os.ReadFile(filepath.Join(root, composePath))
	if err != nil {
		return err
	}
	passed, err := composeEnvironment(string(raw))
	if err != nil {
		return err
	}
	known := configEnvNames()
	var problems []string
	for _, name := range known {
		if !slices.Contains(passed, name) {
			problems = append(problems, fmt.Sprintf("%s is read by the API but not passed through by %s", name, composePath))
		}
	}
	for _, name := range passed {
		if !slices.Contains(known, name) {
			problems = append(problems, fmt.Sprintf("%s is passed through by %s but the API does not read it", name, composePath))
		}
	}
	if len(problems) > 0 {
		return fmt.Errorf("deploy environment drift:\n  %s", strings.Join(problems, "\n  "))
	}
	return nil
}

func composeEnvironment(compose string) ([]string, error) {
	lines := strings.Split(compose, "\n")
	start := slices.IndexFunc(lines, func(line string) bool { return strings.HasPrefix(line, environmentBlock) })
	if start < 0 {
		return nil, fmt.Errorf("%s has no %s block", composePath, environmentBlock)
	}
	var names []string
	for _, line := range lines[start+1:] {
		if line != "" && !strings.HasPrefix(line, " ") {
			break
		}
		match := passthrough.FindStringSubmatch(line)
		if match == nil {
			continue
		}
		if match[1] != match[2] {
			return nil, fmt.Errorf("%s: %s must pass through ${%s}", composePath, match[1], match[1])
		}
		names = append(names, match[1])
	}
	return names, nil
}
