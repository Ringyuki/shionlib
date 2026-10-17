package moyuhttp

import (
	"github.com/Ringyuki/shionlib/apps/api/internal/moyu"
)

type patchPageViaDTO struct {
	Source moyu.Source `json:"source" enum:"vndb,bangumi"`
	ID     string      `json:"id"`
}

type PatchPageDTO struct {
	ID        string           `json:"id"`
	URL       string           `json:"url" doc:"The page on 鲲 Galgame 补丁"`
	Title     *string          `json:"title" doc:"The name of the work the page is about; null when the page is filed under no work"`
	Resources int              `json:"resources"`
	Via       *patchPageViaDTO `json:"via" doc:"The id of the game that found the page; null for pages assigned by hand"`
}

type adminPatchPagesDTO struct {
	Manual    bool           `json:"manual"`
	VNDBID    *string        `json:"vndb_id"`
	BangumiID *string        `json:"bangumi_id"`
	Matched   []PatchPageDTO `json:"matched" doc:"The pages the game's ids find, whether or not they are listed"`
	Assigned  []PatchPageDTO `json:"assigned" doc:"The pages assigned by hand that the other site still lists"`
}

func toPatchPageDTO(page moyu.Page) PatchPageDTO {
	dto := PatchPageDTO{ID: page.ID, URL: page.URL, Title: filled(page.Title), Resources: page.Resources}
	if page.Via != nil {
		dto.Via = &patchPageViaDTO{Source: page.Via.Source, ID: page.Via.ID}
	}
	return dto
}

func toAdminPatchPagesDTO(assignment moyu.Assignment) adminPatchPagesDTO {
	dto := adminPatchPagesDTO{Manual: assignment.Game.Assigned, Matched: toPatchPageDTOs(assignment.Matched), Assigned: toPatchPageDTOs(assignment.Assigned)}
	for _, anchor := range assignment.Game.Anchors {
		id := anchor.ID
		switch anchor.Source {
		case moyu.SourceVNDB:
			dto.VNDBID = &id
		case moyu.SourceBangumi:
			dto.BangumiID = &id
		}
	}
	return dto
}

func toPatchPageDTOs(pages []moyu.Page) []PatchPageDTO {
	dtos := make([]PatchPageDTO, len(pages))
	for i, page := range pages {
		dtos[i] = toPatchPageDTO(page)
	}
	return dtos
}
