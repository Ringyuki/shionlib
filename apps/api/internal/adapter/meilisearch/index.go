package meilisearch

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/search"
)

const maxErrorBody = 1024

var (
	searchableAttributes = []string{
		"title_jp", "title_zh", "title_en", "aliases", "intro_jp", "intro_zh", "intro_en", "tags",
		"developers_names", "developers_aliases", "character_names_jp", "character_names_en", "character_names_zh",
		"character_aliases", "character_intros_jp", "character_intros_en", "character_intros_zh", "staffs",
	}
	filterableAttributes = []string{"nsfw", "max_cover_sexual", "platform", "tags", "developers.id"}
	sortableAttributes   = []string{"release_date", "id", "title_jp", "title_zh", "title_en"}
)

type Index struct {
	opts Options
}

func NewIndex(opts Options) *Index {
	return &Index{opts: NewEngine(opts).opts}
}

type indexSettings struct {
	SearchableAttributes []string `json:"searchableAttributes"`
	FilterableAttributes []string `json:"filterableAttributes"`
	SortableAttributes   []string `json:"sortableAttributes"`
}

type developerDocument struct {
	ID      int      `json:"id"`
	Name    string   `json:"name"`
	Role    *string  `json:"role,omitempty"`
	Aliases []string `json:"aliases"`
}

type staffDocument struct {
	Name string `json:"name"`
	Role string `json:"role"`
}

type document struct {
	ID                int                 `json:"id"`
	TitleJP           string              `json:"title_jp,omitempty"`
	TitleZH           string              `json:"title_zh,omitempty"`
	TitleEN           string              `json:"title_en,omitempty"`
	IntroJP           string              `json:"intro_jp,omitempty"`
	IntroZH           string              `json:"intro_zh,omitempty"`
	IntroEN           string              `json:"intro_en,omitempty"`
	Aliases           []string            `json:"aliases,omitempty"`
	Tags              []string            `json:"tags,omitempty"`
	Platform          []string            `json:"platform,omitempty"`
	NSFW              bool                `json:"nsfw"`
	MaxCoverSexual    int                 `json:"max_cover_sexual"`
	ReleaseDate       *string             `json:"release_date"`
	Developers        []developerDocument `json:"developers"`
	DevelopersNames   []string            `json:"developers_names"`
	DevelopersAliases []string            `json:"developers_aliases"`
	CharacterActors   []string            `json:"character_actors"`
	CharacterNamesJP  []string            `json:"character_names_jp"`
	CharacterNamesEN  []string            `json:"character_names_en"`
	CharacterNamesZH  []string            `json:"character_names_zh"`
	CharacterAliases  []string            `json:"character_aliases"`
	CharacterIntrosJP []string            `json:"character_intros_jp"`
	CharacterIntrosEN []string            `json:"character_intros_en"`
	CharacterIntrosZH []string            `json:"character_intros_zh"`
	Staffs            []staffDocument     `json:"staffs"`
}

func (i *Index) Configure(ctx context.Context) error {
	if err := i.send(ctx, http.MethodPost, "/indexes", map[string]string{"uid": i.opts.Index, "primaryKey": "id"}); err != nil {
		return err
	}
	return i.send(ctx, http.MethodPatch, i.indexPath("/settings"), indexSettings{
		SearchableAttributes: searchableAttributes,
		FilterableAttributes: filterableAttributes,
		SortableAttributes:   sortableAttributes,
	})
}

func (i *Index) Upsert(ctx context.Context, docs []search.Document) error {
	payload := make([]document, len(docs))
	for n, doc := range docs {
		payload[n] = toDocument(doc)
	}
	return i.send(ctx, http.MethodPost, i.indexPath("/documents?primaryKey=id"), payload)
}

func (i *Index) Delete(ctx context.Context, ids []int) error {
	return i.send(ctx, http.MethodPost, i.indexPath("/documents/delete-batch"), ids)
}

func (i *Index) Clear(ctx context.Context) error {
	return i.send(ctx, http.MethodDelete, i.indexPath("/documents"), nil)
}

func (i *Index) indexPath(suffix string) string {
	return "/indexes/" + url.PathEscape(i.opts.Index) + suffix
}

func (i *Index) send(ctx context.Context, method, path string, body any) error {
	var reader io.Reader
	if body != nil {
		payload, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("encode meilisearch request: %w", err)
		}
		reader = bytes.NewReader(payload)
	}
	req, err := http.NewRequestWithContext(ctx, method, i.opts.Host+path, reader)
	if err != nil {
		return fmt.Errorf("build meilisearch request: %w", err)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if i.opts.APIKey != "" {
		req.Header.Set("Authorization", "Bearer "+i.opts.APIKey)
	}
	resp, err := i.opts.HTTP.Do(req)
	if err != nil {
		return fmt.Errorf("meilisearch %s %s: %w", method, path, err)
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		detail, _ := io.ReadAll(io.LimitReader(resp.Body, maxErrorBody))
		return fmt.Errorf("meilisearch %s %s: status %d: %s", method, path, resp.StatusCode, bytes.TrimSpace(detail))
	}
	_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, maxBodyBytes))
	return nil
}

func toDocument(doc search.Document) document {
	out := document{
		ID:                doc.ID,
		TitleJP:           doc.TitleJP,
		TitleZH:           doc.TitleZH,
		TitleEN:           doc.TitleEN,
		IntroJP:           doc.IntroJP,
		IntroZH:           doc.IntroZH,
		IntroEN:           doc.IntroEN,
		Aliases:           doc.Aliases,
		Tags:              doc.Tags,
		Platform:          doc.Platform,
		NSFW:              doc.NSFW,
		MaxCoverSexual:    doc.MaxCoverSexual,
		Developers:        []developerDocument{},
		DevelopersNames:   []string{},
		DevelopersAliases: []string{},
		CharacterActors:   nonNil(doc.CharacterActors),
		CharacterNamesJP:  nonNil(doc.CharacterNamesJP),
		CharacterNamesEN:  nonNil(doc.CharacterNamesEN),
		CharacterNamesZH:  nonNil(doc.CharacterNamesZH),
		CharacterAliases:  nonNil(doc.CharacterAliases),
		CharacterIntrosJP: nonNil(doc.CharacterIntrosJP),
		CharacterIntrosEN: nonNil(doc.CharacterIntrosEN),
		CharacterIntrosZH: nonNil(doc.CharacterIntrosZH),
		Staffs:            []staffDocument{},
	}
	if doc.ReleaseDate != nil {
		formatted := doc.ReleaseDate.UTC().Format(time.RFC3339Nano)
		out.ReleaseDate = &formatted
	}
	for _, developer := range doc.Developers {
		out.Developers = append(out.Developers, developerDocument{ID: developer.ID, Name: developer.Name, Role: developer.Role, Aliases: nonNil(developer.Aliases)})
		if developer.Name != "" {
			out.DevelopersNames = append(out.DevelopersNames, developer.Name)
		}
		out.DevelopersAliases = append(out.DevelopersAliases, developer.Aliases...)
	}
	for _, staff := range doc.Staffs {
		out.Staffs = append(out.Staffs, staffDocument(staff))
	}
	return out
}

func nonNil(values []string) []string {
	if values == nil {
		return []string{}
	}
	return values
}
