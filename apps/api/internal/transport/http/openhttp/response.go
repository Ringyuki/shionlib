package openhttp

import (
	"strconv"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/open"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
)

type openFileDTO struct {
	ID            int                  `json:"id"`
	FileName      string               `json:"file_name"`
	FileSize      int64                `json:"file_size" doc:"Size in bytes"`
	HashAlgorithm upload.HashAlgorithm `json:"hash_algorithm" enum:"sha256,blake3"`
	FileHash      string               `json:"file_hash" doc:"The hash taken when the file was uploaded, with hash_algorithm"`
	SHA256        *string              `json:"sha256" doc:"SHA-256 taken while the file was checked; null until then"`
}

type openTranslatorDTO struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

type openUserDTO struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

type openResourceDTO struct {
	ID           int                   `json:"id"`
	URL          string                `json:"url" doc:"The page of the resource, where it is downloaded"`
	Platform     []string              `json:"platform"`
	Language     []string              `json:"language"`
	Translation  *download.Translation `json:"translation" enum:"none,official,group,machine" doc:"Where the text in a language other than Japanese comes from; null when nobody has said"`
	Translators  []openTranslatorDTO   `json:"translators" doc:"The translators credited, in the order they were given"`
	PatchVersion *string               `json:"patch_version"`
	ReleaseURL   *string               `json:"release_url"`
	Edition      *download.Edition     `json:"edition" enum:"download,package,steam"`
	EditionName  *string               `json:"edition_name"`
	Form         *download.Form        `json:"form" enum:"disc,installer,portable"`
	Extras       []string              `json:"extras" enum:"save,bonus"`
	Note         *string               `json:"note"`
	Downloads    int                   `json:"downloads"`
	Creator      openUserDTO           `json:"creator"`
	PublishedAt  *time.Time            `json:"published_at"`
	Updated      time.Time             `json:"updated"`
	Files        []openFileDTO         `json:"files" doc:"The files that can be downloaded, the volumes of a set together and in their order"`
}

type openGameDTO struct {
	ID        int               `json:"id"`
	HID       *int              `json:"hid"`
	BID       *string           `json:"bid"`
	VID       *string           `json:"vid"`
	TitleJP   string            `json:"title_jp"`
	TitleZH   string            `json:"title_zh"`
	TitleEN   string            `json:"title_en"`
	NSFW      bool              `json:"nsfw"`
	URL       string            `json:"url"`
	Resources []openResourceDTO `json:"resources" doc:"Published resources, the most recently updated first"`
}

type openLookupDTO struct {
	Games   []openGameDTO `json:"games" doc:"The games found, in the order of the IDs asked for"`
	Missing []string      `json:"missing" doc:"The IDs asked for that match no game, as they were written"`
}

func (h *Handler) toLookupDTO(result open.Result) openLookupDTO {
	out := openLookupDTO{Games: make([]openGameDTO, len(result.Games)), Missing: result.Missing}
	for i, game := range result.Games {
		out.Games[i] = openGameDTO{
			ID:        game.ID,
			HID:       game.HID,
			BID:       game.BID,
			VID:       game.VID,
			TitleJP:   game.TitleJP,
			TitleZH:   game.TitleZH,
			TitleEN:   game.TitleEN,
			NSFW:      game.NSFW,
			URL:       h.site + "/game/" + strconv.Itoa(game.ID),
			Resources: make([]openResourceDTO, len(game.Resources)),
		}
		for j, resource := range game.Resources {
			out.Games[i].Resources[j] = h.toResourceDTO(resource)
		}
	}
	return out
}

func (h *Handler) toResourceDTO(r download.GameResource) openResourceDTO {
	out := openResourceDTO{
		ID:           r.ID,
		URL:          h.site + "/resource/" + strconv.Itoa(r.ID),
		Platform:     nonNil(r.Platforms),
		Language:     nonNil(r.Languages),
		Translation:  r.Info.Translation,
		Translators:  make([]openTranslatorDTO, len(r.Info.Translators)),
		PatchVersion: r.Info.PatchVersion,
		ReleaseURL:   r.Info.ReleaseURL,
		Edition:      r.Info.Edition,
		EditionName:  r.Info.EditionName,
		Form:         r.Info.Form,
		Extras:       nonNil(r.Info.Extras),
		Note:         r.Note,
		Downloads:    r.Downloads,
		Creator:      openUserDTO{ID: r.Creator.ID, Name: r.Creator.Name},
		PublishedAt:  r.PublishedAt,
		Updated:      r.Updated,
		Files:        make([]openFileDTO, len(r.Files)),
	}
	for i, credited := range r.Info.Translators {
		out.Translators[i] = openTranslatorDTO{ID: credited.ID, Name: credited.Name}
	}
	for i, file := range r.Files {
		out.Files[i] = openFileDTO{ID: file.ID, FileName: file.Name, FileSize: file.Size, HashAlgorithm: file.HashAlgorithm, FileHash: file.Hash, SHA256: file.SHA256}
	}
	return out
}

func nonNil(values []string) []string {
	if values == nil {
		return []string{}
	}
	return values
}
