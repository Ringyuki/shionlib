package moyuhttp

type adminPatchPagesInput struct {
	ID int `path:"id" minimum:"1"`
}

type adminPatchPagesAssignInput struct {
	ID   int `path:"id" minimum:"1"`
	Body struct {
		Manual bool     `json:"manual" doc:"true lists only the pages given; false finds the pages by the game's VNDB and Bangumi ids"`
		Pages  []string `json:"pages" maxItems:"20" doc:"Page numbers on 鲲 Galgame 补丁, in the order they are listed; ignored unless manual"`
	}
}

type adminPatchPageLookupInput struct {
	Body struct {
		Address string `json:"address" minLength:"1" maxLength:"500" doc:"The address of a page or of a resource on 鲲 Galgame 补丁, or a page number"`
	}
}
