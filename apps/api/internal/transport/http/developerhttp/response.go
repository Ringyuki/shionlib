package developerhttp

type developerListItemDTO struct {
	ID         int      `json:"id"`
	Name       string   `json:"name"`
	Aliases    []string `json:"aliases"`
	Logo       *string  `json:"logo"`
	WorksCount int      `json:"works_count"`
}

type developerExtraInfoDTO struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

type developerDetailDTO struct {
	ID        int                     `json:"id"`
	HID       *int                    `json:"h_id"`
	Name      string                  `json:"name"`
	Aliases   []string                `json:"aliases"`
	Logo      *string                 `json:"logo"`
	IntroJP   string                  `json:"intro_jp"`
	IntroZH   string                  `json:"intro_zh"`
	IntroEN   string                  `json:"intro_en"`
	Website   *string                 `json:"website"`
	ExtraInfo []developerExtraInfoDTO `json:"extra_info"`
}
