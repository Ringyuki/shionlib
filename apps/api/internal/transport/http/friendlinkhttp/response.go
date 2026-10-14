package friendlinkhttp

import (
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/friendlink"
)

type friendLinkDTO struct {
	ID          int     `json:"id"`
	Name        string  `json:"name"`
	URL         string  `json:"url"`
	Logo        *string `json:"logo" doc:"A key in the image bucket, or an address of an image elsewhere; null when the link has none"`
	Description string  `json:"description"`
}

type friendLinkAdminDTO struct {
	ID          int       `json:"id"`
	Name        string    `json:"name"`
	URL         string    `json:"url"`
	Logo        *string   `json:"logo" doc:"A key in the image bucket, or an address of an image elsewhere; null when the link has none"`
	Description string    `json:"description"`
	Visible     bool      `json:"visible"`
	Created     time.Time `json:"created"`
	Updated     time.Time `json:"updated"`
}

func toDTO(link friendlink.Link) friendLinkDTO {
	return friendLinkDTO{ID: link.ID, Name: link.Name, URL: link.URL, Logo: link.Logo, Description: link.Description}
}

func toAdminDTO(link friendlink.Link) friendLinkAdminDTO {
	return friendLinkAdminDTO{ID: link.ID, Name: link.Name, URL: link.URL, Logo: link.Logo, Description: link.Description, Visible: link.Visible, Created: link.Created, Updated: link.Updated}
}
