package i18n

import (
	"embed"
	"encoding/json"
	"fmt"
	"io/fs"
	"path"
	"strings"
)

//go:embed locales
var localesFS embed.FS

type Catalog struct {
	messages map[Locale]map[string]string
	fallback Locale
}

func Load(fallback Locale) (*Catalog, error) {
	if !fallback.Supported() {
		return nil, fmt.Errorf("i18n: unsupported fallback locale %q", fallback)
	}
	catalog := &Catalog{messages: map[Locale]map[string]string{}, fallback: fallback}
	for _, locale := range Supported() {
		messages := map[string]string{}
		dir := path.Join("locales", string(locale))
		entries, err := fs.ReadDir(localesFS, dir)
		if err != nil {
			return nil, fmt.Errorf("i18n: read %s: %w", dir, err)
		}
		for _, entry := range entries {
			if entry.IsDir() || path.Ext(entry.Name()) != ".json" {
				continue
			}
			namespace := strings.TrimSuffix(entry.Name(), ".json")
			raw, err := fs.ReadFile(localesFS, path.Join(dir, entry.Name()))
			if err != nil {
				return nil, fmt.Errorf("i18n: read %s/%s: %w", dir, entry.Name(), err)
			}
			var tree map[string]any
			if err := json.Unmarshal(raw, &tree); err != nil {
				return nil, fmt.Errorf("i18n: decode %s/%s: %w", dir, entry.Name(), err)
			}
			flatten(namespace, tree, messages)
		}
		catalog.messages[locale] = messages
	}
	return catalog, nil
}

func (c *Catalog) Fallback() Locale {
	return c.fallback
}

func (c *Catalog) Has(locale Locale, key string) bool {
	_, ok := c.messages[locale][key]
	return ok
}

func (c *Catalog) T(locale Locale, key string, args map[string]any) string {
	message, ok := c.messages[locale][key]
	if !ok {
		message, ok = c.messages[c.fallback][key]
	}
	if !ok {
		return key
	}
	return format(message, args)
}

func flatten(prefix string, tree map[string]any, out map[string]string) {
	for key, value := range tree {
		full := prefix + "." + key
		switch typed := value.(type) {
		case string:
			out[full] = typed
		case map[string]any:
			flatten(full, typed, out)
		}
	}
}
