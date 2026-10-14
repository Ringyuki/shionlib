package ad

import (
	"context"
	"slices"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/setting"
)

type Options struct {
	ClockOffset time.Duration
}

type Deps struct {
	Repo     Repository
	Cache    Cache
	Settings setting.Source
	Now      func() time.Time
	Options  Options
}

type Service struct {
	repo     Repository
	cache    Cache
	settings setting.Source
	now      func() time.Time
	options  Options
}

func NewService(deps Deps) *Service {
	return &Service{repo: deps.Repo, cache: deps.Cache, settings: deps.Settings, now: deps.Now, options: deps.Options}
}

func (s *Service) List(ctx context.Context, filter ListFilter, page Page) ([]Listed, int, error) {
	ads, total, err := s.repo.List(ctx, filter, s.now(), page)
	if err != nil {
		return nil, 0, err
	}
	from, to := window(s.now(), s.options.ClockOffset, WeekDays)
	rows, err := s.repo.Counts(ctx, idsOf(ads), from, to)
	if err != nil {
		return nil, 0, err
	}
	totals := TotalsByAd(rows)
	listed := make([]Listed, len(ads))
	for i, item := range ads {
		listed[i] = Listed{Ad: item, Week: totals[item.ID]}
	}
	return listed, total, nil
}

func (s *Service) Get(ctx context.Context, id int) (Ad, error) {
	return s.repo.Get(ctx, id)
}

func (s *Service) Report(ctx context.Context, id, days int) (Report, error) {
	if _, err := s.repo.Get(ctx, id); err != nil {
		return Report{}, err
	}
	from, to := window(s.now(), s.options.ClockOffset, days)
	rows, err := s.repo.Counts(ctx, []int{id}, from, to)
	if err != nil {
		return Report{}, err
	}
	return Summarize(rows, from, days), nil
}

func (s *Service) Overview(ctx context.Context) (Overview, error) {
	running, err := s.repo.Running(ctx, s.now())
	if err != nil {
		return Overview{}, err
	}
	from, to := window(s.now(), s.options.ClockOffset, WeekDays)
	rows, err := s.repo.Counts(ctx, nil, from, to)
	if err != nil {
		return Overview{}, err
	}
	overview := Overview{Running: len(running), Enabled: Enabled.Read(s.settings)}
	for _, row := range rows {
		overview.Week = overview.Week.Add(row.Counts)
	}
	return overview, nil
}

func (s *Service) Slots(ctx context.Context) ([]SlotSummary, error) {
	running, err := s.repo.Running(ctx, s.now())
	if err != nil {
		return nil, err
	}
	from, to := window(s.now(), s.options.ClockOffset, WeekDays)
	rows, err := s.repo.Counts(ctx, nil, from, to)
	if err != nil {
		return nil, err
	}
	totals := TotalsBySlot(rows)
	summaries := make([]SlotSummary, len(slotSpecs))
	for i, spec := range slotSpecs {
		summary := SlotSummary{Spec: spec, Running: []Named{}, Week: totals[spec.Slot]}
		for _, item := range running {
			if slices.Contains(item.Slots, spec.Slot) && item.Has(spec.Material) {
				summary.Running = append(summary.Running, Named{ID: item.ID, Name: item.Name})
			}
		}
		summaries[i] = summary
	}
	return summaries, nil
}

func (s *Service) Create(ctx context.Context, draft Draft) (Ad, error) {
	draft = tidy(draft)
	if err := draft.Check(); err != nil {
		return Ad{}, err
	}
	created, err := s.repo.Create(ctx, draft)
	if err != nil {
		return Ad{}, err
	}
	s.invalidate(ctx)
	return created, nil
}

func (s *Service) Replace(ctx context.Context, id int, draft Draft) (Ad, error) {
	draft = tidy(draft)
	if err := draft.Check(); err != nil {
		return Ad{}, err
	}
	replaced, err := s.repo.Replace(ctx, id, draft)
	if err != nil {
		return Ad{}, err
	}
	s.invalidate(ctx)
	return replaced, nil
}

func (s *Service) Delete(ctx context.Context, id int) error {
	if err := s.repo.Delete(ctx, id); err != nil {
		return err
	}
	s.invalidate(ctx)
	return nil
}

func (s *Service) invalidate(ctx context.Context) {
	_ = s.cache.DeletePrefix(ctx, SlotCachePrefix)
}

func tidy(draft Draft) Draft {
	slots := []Slot{}
	for _, spec := range slotSpecs {
		if slices.Contains(draft.Slots, spec.Slot) {
			slots = append(slots, spec.Slot)
		}
	}
	for _, slot := range draft.Slots {
		if _, ok := slot.Spec(); !ok && !slices.Contains(slots, slot) {
			slots = append(slots, slot)
		}
	}
	languages := []string{}
	for _, language := range Languages {
		if slices.Contains(draft.Languages, language) {
			languages = append(languages, language)
		}
	}
	for _, language := range draft.Languages {
		if !slices.Contains(languages, language) {
			languages = append(languages, language)
		}
	}
	draft.Slots, draft.Languages = slots, languages
	return draft
}

func window(now time.Time, offset time.Duration, days int) (time.Time, time.Time) {
	to := DayOf(now, offset)
	return to.AddDate(0, 0, -(days - 1)), to
}

func idsOf(ads []Ad) []int {
	ids := make([]int, len(ads))
	for i, item := range ads {
		ids[i] = item.ID
	}
	return ids
}
