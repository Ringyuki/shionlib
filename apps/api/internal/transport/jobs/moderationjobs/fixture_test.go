package moderationjobs

import (
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/moderation"
	"github.com/Ringyuki/shionlib/apps/api/internal/moderation/moderationtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/txtest"
)

type fixture struct {
	repo       *moderationtest.MemoryRepository
	classifier *moderationtest.Classifier
	service    *moderation.Service
}

func newFixture(t *testing.T) fixture {
	t.Helper()
	repo := moderationtest.NewMemoryRepository()
	classifier := &moderationtest.Classifier{ScreenErr: moderation.ErrClassifierDisabled, ReviewErr: moderation.ErrClassifierDisabled}
	service := moderation.NewService(repo, classifier, &moderationtest.Messages{}, &moderationtest.Activities{}, &moderationtest.Queue{}, &txtest.Immediate{})
	return fixture{repo: repo, classifier: classifier, service: service}
}
