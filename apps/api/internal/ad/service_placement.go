package ad

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"slices"
	"strconv"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/setting"
)

type PlacementDeps struct {
	Repo     Repository
	Sponsors Sponsors
	Cache    Cache
	Guard    ClickGuard
	Settings setting.Source
	Now      func() time.Time
	Random   func() float64
	Options  Options
}

type PlacementService struct {
	repo     Repository
	sponsors Sponsors
	cache    Cache
	guard    ClickGuard
	settings setting.Source
	now      func() time.Time
	random   func() float64
	options  Options
}

func NewPlacementService(deps PlacementDeps) *PlacementService {
	return &PlacementService{
		repo:     deps.Repo,
		sponsors: deps.Sponsors,
		cache:    deps.Cache,
		guard:    deps.Guard,
		settings: deps.Settings,
		now:      deps.Now,
		random:   deps.Random,
		options:  deps.Options,
	}
}

func (s *PlacementService) Place(ctx context.Context, viewer actor.Actor, locale string, slots []Slot) ([]Placed, error) {
	placed := []Placed{}
	for _, slot := range slots {
		if _, ok := slot.Spec(); ok && !slices.ContainsFunc(placed, func(p Placed) bool { return p.Slot == slot }) {
			placed = append(placed, Placed{Slot: slot, Ads: []Shown{}})
		}
	}
	quiet, err := s.quiet(ctx, viewer)
	if err != nil || quiet {
		return placed, err
	}
	now := s.now()
	for i := range placed {
		spec, _ := placed[i].Slot.Spec()
		enabled, err := s.enabled(ctx, spec.Slot)
		if err != nil {
			return nil, err
		}
		candidates := slices.DeleteFunc(enabled, func(item Ad) bool {
			return item.Status(now) != StatusRunning || !item.ShownTo(viewer, locale, spec.Material)
		})
		for _, item := range Pick(candidates, spec, s.random) {
			placed[i].Ads = append(placed[i].Ads, shown(item, spec.Material))
		}
	}
	return placed, nil
}

func (s *PlacementService) RecordViews(ctx context.Context, views []View) error {
	counted := map[View]int{}
	known := map[Slot][]int{}
	for _, view := range views[:min(len(views), MaxViewsPerReport)] {
		ids, ok := known[view.Slot]
		if !ok {
			if _, valid := view.Slot.Spec(); !valid {
				continue
			}
			enabled, err := s.enabled(ctx, view.Slot)
			if err != nil {
				return err
			}
			ids = idsOf(enabled)
			known[view.Slot] = ids
		}
		if slices.Contains(ids, view.AdID) {
			counted[view]++
		}
	}
	if len(counted) == 0 {
		return nil
	}
	return s.repo.AddViews(ctx, DayOf(s.now(), s.options.ClockOffset), counted)
}

func (s *PlacementService) Click(ctx context.Context, id int, slot Slot, visitor Visitor) (string, error) {
	if _, valid := slot.Spec(); valid {
		enabled, err := s.enabled(ctx, slot)
		if err != nil {
			return "", err
		}
		if index := slices.IndexFunc(enabled, func(item Ad) bool { return item.ID == id }); index >= 0 {
			first, err := s.guard.First(ctx, clickKey(id, visitor), ClickWindow)
			if err != nil {
				return "", err
			}
			if first {
				if err := s.repo.AddClick(ctx, DayOf(s.now(), s.options.ClockOffset), View{AdID: id, Slot: slot}); err != nil {
					return "", err
				}
			}
			return enabled[index].Link, nil
		}
	}
	item, err := s.repo.Get(ctx, id)
	if err != nil {
		return "", err
	}
	return item.Link, nil
}

func (s *PlacementService) quiet(ctx context.Context, viewer actor.Actor) (bool, error) {
	if !Enabled.Read(s.settings) {
		return true, nil
	}
	if !viewer.Authenticated() {
		return false, nil
	}
	return s.sponsors.IsSponsor(ctx, viewer.UserID, s.now())
}

func (s *PlacementService) enabled(ctx context.Context, slot Slot) ([]Ad, error) {
	key := SlotCachePrefix + string(slot)
	var cached []Ad
	if found, err := s.cache.Get(ctx, key, &cached); err == nil && found {
		return cached, nil
	}
	ads, err := s.repo.Enabled(ctx, slot)
	if err != nil {
		return nil, err
	}
	_ = s.cache.Set(ctx, key, ads, SlotCacheTTL)
	return ads, nil
}

func shown(item Ad, material Material) Shown {
	if material == MaterialSide {
		return Shown{ID: item.ID, Name: item.Name, Image: *item.SideImage, Icon: item.SideIcon}
	}
	return Shown{ID: item.ID, Name: item.Name, Image: *item.Banner}
}

func clickKey(id int, visitor Visitor) string {
	sum := sha256.Sum256([]byte(visitor.IP + "\x00" + visitor.UserAgent))
	return "ad:click:" + strconv.Itoa(id) + ":" + hex.EncodeToString(sum[:12])
}
