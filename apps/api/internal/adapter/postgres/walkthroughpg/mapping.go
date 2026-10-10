package walkthroughpg

import (
	"encoding/json"
	"fmt"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/moderationpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/userpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/walkthrough"
)

const routeCount = "route_count"

type stepRecord struct {
	Kind   string `json:"kind"`
	Text   string `json:"text,omitempty"`
	Remark string `json:"remark,omitempty"`
	Slot   string `json:"slot,omitempty"`
}

type routeRecord struct {
	Key        string       `json:"key"`
	Name       string       `json:"name"`
	Characters []int        `json:"characters"`
	Requires   []string     `json:"requires"`
	Condition  string       `json:"condition,omitempty"`
	Ending     string       `json:"ending,omitempty"`
	Steps      []stepRecord `json:"steps"`
}

func encodeRoutes(routes []walkthrough.Route) (json.RawMessage, error) {
	records := make([]routeRecord, len(routes))
	for i, route := range routes {
		steps := make([]stepRecord, len(route.Steps))
		for j, step := range route.Steps {
			steps[j] = stepRecord{Kind: string(step.Kind), Text: step.Text, Remark: step.Remark, Slot: step.Slot}
		}
		records[i] = routeRecord{
			Key:        route.Key,
			Name:       route.Name,
			Characters: append([]int{}, route.Characters...),
			Requires:   append([]string{}, route.Requires...),
			Condition:  route.Condition,
			Ending:     route.Ending,
			Steps:      steps,
		}
	}
	raw, err := json.Marshal(records)
	if err != nil {
		return nil, fmt.Errorf("encode routes: %w", err)
	}
	return raw, nil
}

func decodeRoutes(raw json.RawMessage) ([]walkthrough.Route, error) {
	var records []routeRecord
	if err := json.Unmarshal(raw, &records); err != nil {
		return nil, fmt.Errorf("decode routes: %w", err)
	}
	routes := make([]walkthrough.Route, len(records))
	for i, record := range records {
		steps := make([]walkthrough.Step, len(record.Steps))
		for j, step := range record.Steps {
			steps[j] = walkthrough.Step{Kind: walkthrough.StepKind(step.Kind), Text: step.Text, Remark: step.Remark, Slot: step.Slot}
		}
		routes[i] = walkthrough.Route{
			Key:        record.Key,
			Name:       record.Name,
			Characters: append([]int{}, record.Characters...),
			Requires:   append([]string{}, record.Requires...),
			Condition:  record.Condition,
			Ending:     record.Ending,
			Steps:      steps,
		}
	}
	return routes, nil
}

func toAdminEntry(row *ent.Walkthrough) (walkthrough.AdminEntry, error) {
	stored, err := toWalkthrough(row)
	if err != nil {
		return walkthrough.AdminEntry{}, err
	}
	entry := walkthrough.AdminEntry{Walkthrough: stored, Creator: userpg.ToSummary(row.Edges.Creator)}
	if row.Edges.Creator != nil {
		entry.CreatorEmail = row.Edges.Creator.Email
	}
	if g := row.Edges.Game; g != nil {
		entry.Game = walkthrough.GameRef{ID: g.ID, TitleJP: g.TitleJp, TitleZH: g.TitleZh, TitleEN: g.TitleEn}
	}
	if len(row.Edges.Moderates) > 0 {
		latest := moderationpg.ToEvent(row.Edges.Moderates[0])
		entry.Moderation = &latest
	}
	return entry, nil
}

func toWalkthrough(row *ent.Walkthrough) (walkthrough.Walkthrough, error) {
	routes, err := decodeRoutes(row.Routes)
	if err != nil {
		return walkthrough.Walkthrough{}, fmt.Errorf("walkthrough %d: %w", row.ID, err)
	}
	return walkthrough.Walkthrough{
		ID:            row.ID,
		GameID:        row.GameID,
		Note:          row.Note,
		Routes:        routes,
		Text:          row.Text,
		Lang:          row.Lang,
		Created:       row.Created,
		Updated:       row.Updated,
		Edited:        row.Edited,
		Status:        walkthrough.Status(row.Status),
		CreatorID:     row.CreatorID,
		ReviewPending: row.ReviewPending,
	}, nil
}

func toSummary(row *ent.Walkthrough) (walkthrough.Summary, error) {
	value, err := row.Value(routeCount)
	if err != nil {
		return walkthrough.Summary{}, fmt.Errorf("walkthrough %d: %w", row.ID, err)
	}
	count, ok := value.(int64)
	if !ok {
		return walkthrough.Summary{}, fmt.Errorf("walkthrough %d: route count is %T", row.ID, value)
	}
	return walkthrough.Summary{
		ID:            row.ID,
		GameID:        row.GameID,
		RouteCount:    int(count),
		Lang:          row.Lang,
		Created:       row.Created,
		Updated:       row.Updated,
		Status:        walkthrough.Status(row.Status),
		ReviewPending: row.ReviewPending,
		Creator:       userpg.ToSummary(row.Edges.Creator),
	}, nil
}
