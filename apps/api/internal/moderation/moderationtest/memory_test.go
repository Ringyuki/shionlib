package moderationtest

import (
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/moderation"
)

func TestMemoryRepositoryContract(t *testing.T) {
	RepositoryContract(t, func(t *testing.T) Env {
		repo := NewMemoryRepository()
		users, games := 0, 0
		return Env{
			Repo: repo,
			NewComment: func(t *testing.T, fixture CommentFixture) moderation.CommentSubject {
				users++
				games++
				subject := moderation.CommentSubject{CreatorID: users, GameID: games, HTML: fixture.HTML, ParentID: fixture.ParentID, Game: moderation.GameTitles{JP: "ゲーム"}}
				if fixture.ParentID != nil {
					parent, err := repo.CommentSubject(t.Context(), *fixture.ParentID)
					if err != nil {
						t.Fatal(err)
					}
					subject.ParentCreatorID = &parent.CreatorID
					subject.ParentHTML = parent.HTML
				}
				return repo.SeedComment(subject, fixture.Status)
			},
			CommentStatus: func(_ *testing.T, id int) string { return repo.CommentStatus(id) },
			NewWalkthrough: func(_ *testing.T, status string, reviewPending bool) moderation.WalkthroughSubject {
				users++
				games++
				return repo.SeedWalkthrough(moderation.WalkthroughSubject{CreatorID: users, GameID: games, Title: "guide", HTML: "<p>guide</p>", ReviewPending: reviewPending, Game: moderation.GameTitles{JP: "ゲーム"}}, status)
			},
			WalkthroughStatus: func(_ *testing.T, id int) string { return repo.WalkthroughStatus(id) },
			EventCount:        func(*testing.T) int { return len(repo.Events()) },
		}
	})
}
