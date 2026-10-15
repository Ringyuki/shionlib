package walkthrough

import (
	"context"
	"errors"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/setting"
)

type FormatDeps struct {
	Games     GameCards
	Cast      Cast
	Formatter Formatter
	Tasks     FormatTasks
	Quota     FormatQuota
	Queue     Queue
	Settings  setting.Source
	Now       func() time.Time
	NewID     func() string
}

type FormatService struct {
	games     GameCards
	cast      Cast
	formatter Formatter
	tasks     FormatTasks
	quota     FormatQuota
	queue     Queue
	settings  setting.Source
	now       func() time.Time
	newID     func() string
}

func NewFormatService(deps FormatDeps) *FormatService {
	return &FormatService{
		games:     deps.Games,
		cast:      deps.Cast,
		formatter: deps.Formatter,
		tasks:     deps.Tasks,
		quota:     deps.Quota,
		queue:     deps.Queue,
		settings:  deps.Settings,
		now:       deps.Now,
		newID:     deps.NewID,
	}
}

func (s *FormatService) Available(ctx context.Context) (bool, error) {
	if FormatDailyLimit.Read(s.settings) == 0 {
		return false, nil
	}
	return s.formatter.Ready(ctx)
}

func (s *FormatService) Start(ctx context.Context, who actor.Actor, gameID int, text string) (FormatTask, error) {
	source := strings.TrimSpace(text)
	if source == "" {
		return FormatTask{}, ErrEmpty
	}
	if utf8.RuneCountInString(source) > MaxTextLength {
		return FormatTask{}, ErrContentTooLong
	}
	exists, err := s.games.Exists(ctx, gameID)
	if err != nil {
		return FormatTask{}, err
	}
	if !exists {
		return FormatTask{}, game.ErrNotFound
	}
	available, err := s.Available(ctx)
	if err != nil {
		return FormatTask{}, err
	}
	if !available {
		return FormatTask{}, ErrFormatFailed.Wrap(errNoFormatter)
	}
	now := s.now()
	allowed, err := s.quota.Take(ctx, who.UserID, FormatDay(now), FormatDailyLimit.Read(s.settings))
	if err != nil {
		return FormatTask{}, err
	}
	if !allowed {
		return FormatTask{}, ErrFormatQuotaExhausted
	}
	task := FormatTask{ID: s.newID(), OwnerID: who.UserID, GameID: gameID, Text: source, State: FormatWorking, Started: now}
	if err := s.tasks.Save(ctx, task, FormatTaskTTL); err != nil {
		return FormatTask{}, err
	}
	if err := s.queue.Enqueue(ctx, FormatWalkthrough{TaskID: task.ID}); err != nil {
		return FormatTask{}, err
	}
	task.Text = ""
	return task, nil
}

func (s *FormatService) Result(ctx context.Context, who actor.Actor, id string) (FormatTask, error) {
	task, found, err := s.tasks.Get(ctx, id)
	if err != nil {
		return FormatTask{}, err
	}
	if !found || task.OwnerID != who.UserID {
		return FormatTask{}, ErrFormatTaskNotFound
	}
	switch {
	case task.State == FormatFailed:
		return FormatTask{}, ErrFormatFailed.Wrap(errors.New(task.Failure))
	case task.Abandoned(s.now()):
		return FormatTask{}, ErrFormatFailed.Wrap(errFormatAbandoned)
	}
	task.Text = ""
	return task, nil
}

func (s *FormatService) Run(ctx context.Context, id string) error {
	task, found, err := s.tasks.Get(ctx, id)
	if err != nil || !found || task.State != FormatWorking {
		return err
	}
	formatted, err := s.format(ctx, task)
	task.Text = ""
	if err != nil {
		task.State, task.Failure = FormatFailed, err.Error()
		return errors.Join(err, s.tasks.Save(ctx, task, FormatTaskTTL))
	}
	task.State, task.Result = FormatDone, formatted
	return s.tasks.Save(ctx, task, FormatTaskTTL)
}

func (s *FormatService) format(ctx context.Context, task FormatTask) (Formatted, error) {
	cast, err := s.cast.Cast(ctx, task.GameID)
	if err != nil {
		return Formatted{}, err
	}
	formatted, err := s.formatter.Format(ctx, FormatRequest{Text: task.Text, Cast: cast})
	if err != nil {
		return Formatted{}, err
	}
	return Checked(formatted, cast), nil
}
