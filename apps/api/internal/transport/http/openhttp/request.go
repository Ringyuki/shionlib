package openhttp

import "github.com/Ringyuki/shionlib/apps/api/internal/open"

type lookupInput struct {
	ID  string `query:"id" maxLength:"2000" doc:"Shionlib game IDs, up to 50, separated by commas"`
	HID string `query:"hid" maxLength:"2000" doc:"Hikarinagi IDs, up to 50, separated by commas"`
	BID string `query:"bid" maxLength:"2000" doc:"Bangumi subject IDs, up to 50, separated by commas"`
	VID string `query:"vid" maxLength:"2000" doc:"VNDB IDs, up to 50, separated by commas; the leading v may be left out"`
}

func (in *lookupInput) lookup() (open.Kind, string, error) {
	given := map[open.Kind]string{open.KindID: in.ID, open.KindHID: in.HID, open.KindBID: in.BID, open.KindVID: in.VID}
	var kind open.Kind
	count := 0
	for candidate, value := range given {
		if value != "" {
			kind = candidate
			count++
		}
	}
	if count != 1 {
		return "", "", open.ErrOneKind
	}
	return kind, given[kind], nil
}
