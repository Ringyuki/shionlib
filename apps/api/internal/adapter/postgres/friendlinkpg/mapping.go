package friendlinkpg

import (
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/friendlink"
)

func toLinks(rows []*ent.FriendLink) []friendlink.Link {
	links := make([]friendlink.Link, len(rows))
	for i, row := range rows {
		links[i] = toLink(row)
	}
	return links
}

func toLink(row *ent.FriendLink) friendlink.Link {
	return friendlink.Link{
		ID:          row.ID,
		Name:        row.Name,
		URL:         row.URL,
		Logo:        row.Logo,
		Description: row.Description,
		Visible:     row.Visible,
		Position:    row.Position,
		Created:     row.Created,
		Updated:     row.Updated,
	}
}
