package moderation_test

import (
	"context"
	"encoding/json"
	"errors"
	"strconv"
	"strings"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/activity"
	"github.com/Ringyuki/shionlib/apps/api/internal/message"
	"github.com/Ringyuki/shionlib/apps/api/internal/moderation"
	"github.com/Ringyuki/shionlib/apps/api/internal/moderation/moderationtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/txtest"
)

type fixture struct {
	repo       *moderationtest.MemoryRepository
	classifier *moderationtest.Classifier
	messages   *moderationtest.Messages
	activities *moderationtest.Activities
	queue      *moderationtest.Queue
	service    *moderation.Service
}

func newFixture() fixture {
	f := fixture{
		repo:       moderationtest.NewMemoryRepository(),
		classifier: &moderationtest.Classifier{},
		messages:   &moderationtest.Messages{},
		activities: &moderationtest.Activities{},
		queue:      &moderationtest.Queue{},
	}
	f.service = moderation.NewService(f.repo, f.classifier, f.messages, f.activities, f.queue, &txtest.Immediate{})
	return f
}

func scores(values map[string]float64) moderation.Screening {
	raw, _ := json.Marshal(values)
	flags := map[string]bool{}
	for key, value := range values {
		flags[key] = value >= 0.5
	}
	categories, _ := json.Marshal(flags)
	return moderation.Screening{Model: "omni-moderation-latest", Categories: categories, Scores: raw, CategoryScores: values}
}

func (f fixture) reply(html string) moderation.CommentSubject {
	parent := f.repo.SeedComment(moderation.CommentSubject{CreatorID: 9, GameID: 5, HTML: "<p>parent</p>"}, moderationtest.CommentVisible)
	return f.repo.SeedComment(moderation.CommentSubject{
		CreatorID: 3, GameID: 5, HTML: html, ParentID: &parent.ID, ParentCreatorID: &parent.CreatorID, ParentHTML: parent.HTML,
		Game: moderation.GameTitles{JP: "タイトル", ZH: "标题", EN: "Title"},
	}, moderationtest.CommentPending)
}

func TestScreenCommentApprovesLowScores(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	comment := f.reply("<p>Hello<br/>World</p>")
	f.classifier.Screening = scores(map[string]float64{"hate": 0.001, "harassment": 0.01})

	if err := f.service.ScreenComment(ctx, comment.ID); err != nil {
		t.Fatal(err)
	}
	if len(f.classifier.Screened) != 1 || f.classifier.Screened[0] != "Hello World" {
		t.Fatalf("unexpected screened text %q", f.classifier.Screened)
	}
	events := f.repo.Events()
	if len(events) != 1 || events[0].Decision != moderation.DecisionAllow || events[0].Auditor != moderation.AuditorScreening || events[0].TopCategory != moderation.CategoryHarassment || *events[0].MaxScore != 0.01 || *events[0].CommentID != comment.ID {
		t.Fatalf("unexpected events %+v", events)
	}
	if status := f.repo.CommentStatus(comment.ID); status != moderationtest.CommentVisible {
		t.Fatalf("comment should be visible, got %s", status)
	}
	activities := f.activities.All()
	if len(activities) != 1 || activities[0].Type != activity.TypeComment || activities[0].UserID != 3 || *activities[0].GameID != 5 || *activities[0].CommentID != comment.ID {
		t.Fatalf("unexpected activities %+v", activities)
	}
	sent := f.messages.All()
	if len(sent) != 1 || sent[0].Type != message.TypeCommentReply || sent[0].Tone != message.ToneInfo || sent[0].ReceiverID != 9 || *sent[0].SenderID != 3 || sent[0].Title != "Messages.Comment.Reply.Title" || sent[0].Content != "Messages.Comment.Reply.Content" || *sent[0].CommentID != comment.ID || *sent[0].GameID != 5 {
		t.Fatalf("unexpected reply notice %+v", sent)
	}
	if jobs := f.queue.All(); len(jobs) != 0 {
		t.Fatalf("approved comments are not reviewed again: %+v", jobs)
	}
}

func TestScreenCommentEscalatesTheReviewBand(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	comment := f.reply("<p>hmm</p>")
	f.classifier.Screening = scores(map[string]float64{"harassment": 0.01, "hate": 0.2})

	if err := f.service.ScreenComment(ctx, comment.ID); err != nil {
		t.Fatal(err)
	}
	events := f.repo.Events()
	if len(events) != 1 || events[0].Decision != moderation.DecisionReview || events[0].TopCategory != moderation.CategoryHate {
		t.Fatalf("unexpected events %+v", events)
	}
	if f.repo.CommentStatus(comment.ID) != moderationtest.CommentPending || len(f.activities.All()) != 0 || len(f.messages.All()) != 0 {
		t.Fatal("review band must leave the comment pending without side effects")
	}
	jobs := f.queue.All()
	if len(jobs) != 1 || jobs[0] != (moderation.ReviewComment{CommentID: comment.ID}) {
		t.Fatalf("expected an LLM review job, got %+v", jobs)
	}
}

func TestScreenCommentBlocksHighScores(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	comment := f.reply("<p>bad</p>")
	f.classifier.Screening = scores(map[string]float64{"violence": 0.95, "hate/threatening": 0.4})

	if err := f.service.ScreenComment(ctx, comment.ID); err != nil {
		t.Fatal(err)
	}
	if status := f.repo.CommentStatus(comment.ID); status != moderationtest.CommentBlocked {
		t.Fatalf("comment should be blocked, got %s", status)
	}
	sent := f.messages.All()
	if len(sent) != 1 || sent[0].Type != message.TypeSystem || sent[0].Tone != message.ToneDestructive || sent[0].ReceiverID != 3 || sent[0].SenderID != nil ||
		sent[0].Title != "Messages.System.Moderation.Comment.Block.Title" || sent[0].Content != "Messages.System.Moderation.Comment.Block.Content" || string(sent[0].Meta) != `{"top_category":"VIOLENCE"}` {
		t.Fatalf("unexpected block notice %+v %s", sent, sent[0].Meta)
	}
	if len(f.activities.All()) != 0 || len(f.queue.All()) != 0 {
		t.Fatal("blocked comments create no activity and no review")
	}
}

func TestScreenCommentSkipsAndRetries(t *testing.T) {
	ctx := context.Background()

	t.Run("missing comment", func(t *testing.T) {
		f := newFixture()
		if err := f.service.ScreenComment(ctx, 404); err != nil {
			t.Fatal(err)
		}
		if len(f.classifier.Screened) != 0 {
			t.Fatal("missing comments must not reach the classifier")
		}
	})

	t.Run("already decided", func(t *testing.T) {
		f := newFixture()
		comment := f.repo.SeedComment(moderation.CommentSubject{CreatorID: 1, GameID: 1, HTML: "<p>x</p>"}, moderationtest.CommentBlocked)
		if err := f.service.ScreenComment(ctx, comment.ID); err != nil {
			t.Fatal(err)
		}
		if len(f.classifier.Screened) != 0 || f.repo.CommentStatus(comment.ID) != moderationtest.CommentBlocked {
			t.Fatal("decided comments are left alone")
		}
	})

	t.Run("classifier failure leaves the comment pending for a retry", func(t *testing.T) {
		f := newFixture()
		comment := f.reply("<p>x</p>")
		f.classifier.ScreenErr = errors.New("upstream 503")
		if err := f.service.ScreenComment(ctx, comment.ID); err == nil {
			t.Fatal("the job must fail so it is retried")
		}
		if f.repo.CommentStatus(comment.ID) != moderationtest.CommentPending || len(f.repo.Events()) != 0 {
			t.Fatal("a failed screening must not change anything")
		}
	})

	t.Run("disabled classifier approves without an event", func(t *testing.T) {
		f := newFixture()
		comment := f.reply("<p>x</p>")
		f.classifier.ScreenErr = moderation.ErrClassifierDisabled
		if err := f.service.ScreenComment(ctx, comment.ID); err != nil {
			t.Fatal(err)
		}
		if f.repo.CommentStatus(comment.ID) != moderationtest.CommentVisible || len(f.repo.Events()) != 0 || len(f.activities.All()) != 1 || len(f.messages.All()) != 1 {
			t.Fatal("without a classifier comments are published directly")
		}
	})

	t.Run("comments without text are approved without the classifier", func(t *testing.T) {
		f := newFixture()
		comment := f.repo.SeedComment(moderation.CommentSubject{CreatorID: 1, GameID: 1, HTML: "<hr />"}, moderationtest.CommentPending)
		if err := f.service.ScreenComment(ctx, comment.ID); err != nil {
			t.Fatal(err)
		}
		if len(f.classifier.Screened) != 0 || f.repo.CommentStatus(comment.ID) != moderationtest.CommentVisible {
			t.Fatal("empty comments are approved")
		}
	})

	t.Run("edits during screening win", func(t *testing.T) {
		f := newFixture()
		comment := f.reply("<p>before</p>")
		editing := &editingClassifier{repo: f.repo, commentID: comment.ID, screening: scores(map[string]float64{"hate": 0.99})}
		service := moderation.NewService(f.repo, editing, f.messages, f.activities, f.queue, &txtest.Immediate{})
		if err := service.ScreenComment(ctx, comment.ID); err != nil {
			t.Fatal(err)
		}
		if f.repo.CommentStatus(comment.ID) != moderationtest.CommentPending || len(f.repo.Events()) != 0 || len(f.messages.All()) != 0 {
			t.Fatal("a stale verdict must not be applied to edited content")
		}
	})

	t.Run("self replies do not notify", func(t *testing.T) {
		f := newFixture()
		parent := f.repo.SeedComment(moderation.CommentSubject{CreatorID: 3, GameID: 5, HTML: "<p>p</p>"}, moderationtest.CommentVisible)
		comment := f.repo.SeedComment(moderation.CommentSubject{CreatorID: 3, GameID: 5, HTML: "<p>c</p>", ParentID: &parent.ID, ParentCreatorID: &parent.CreatorID}, moderationtest.CommentPending)
		f.classifier.Screening = scores(map[string]float64{"hate": 0})
		if err := f.service.ScreenComment(ctx, comment.ID); err != nil {
			t.Fatal(err)
		}
		if len(f.messages.All()) != 0 || len(f.activities.All()) != 1 {
			t.Fatal("replying to yourself creates an activity but no notice")
		}
	})
}

type editingClassifier struct {
	repo      *moderationtest.MemoryRepository
	commentID int
	screening moderation.Screening
}

func (c *editingClassifier) Screen(context.Context, string) (moderation.Screening, error) {
	c.repo.SetCommentHTML(c.commentID, "<p>after</p>")
	return c.screening, nil
}

func (c *editingClassifier) Review(context.Context, moderation.ReviewRequest) (moderation.Verdict, error) {
	return moderation.Verdict{}, errors.New("unused")
}

func TestReviewComment(t *testing.T) {
	ctx := context.Background()

	t.Run("allow publishes with context about the thread", func(t *testing.T) {
		f := newFixture()
		comment := f.reply("<p>Hi <b>there</b></p>")
		f.classifier.Verdict = moderation.Verdict{Model: "gpt-5-mini", Decision: moderation.DecisionAllow, TopCategory: moderation.CategoryHarassment, Categories: json.RawMessage(`{"harassment":false}`)}
		if err := f.service.ReviewComment(ctx, comment.ID); err != nil {
			t.Fatal(err)
		}
		request := f.classifier.Reviewed[0]
		if request.Input != "Game: 标题 Title タイトル\nReplying to: \"parent\"\nComment: \"Hi there\"" {
			t.Fatalf("unexpected review input %q", request.Input)
		}
		if !strings.Contains(request.Instructions, "- self-harm/instructions") || !strings.HasSuffix(request.Instructions, "The input is a user comment. Consider conversational context such as replies and quoted language.") {
			t.Fatalf("unexpected instructions %q", request.Instructions)
		}
		events := f.repo.Events()
		if len(events) != 1 || events[0].Auditor != moderation.AuditorReview || events[0].Model != "gpt-5-mini" || events[0].MaxScore != nil || events[0].Decision != moderation.DecisionAllow {
			t.Fatalf("unexpected events %+v", events)
		}
		if f.repo.CommentStatus(comment.ID) != moderationtest.CommentVisible || len(f.activities.All()) != 1 || len(f.messages.All()) != 1 {
			t.Fatal("allowed comments are published with activity and reply notice")
		}
	})

	t.Run("block notifies with the review reason", func(t *testing.T) {
		f := newFixture()
		comment := f.reply("<p>x</p>")
		f.classifier.Verdict = moderation.Verdict{Model: "gpt-5-mini", Decision: moderation.DecisionBlock, Reason: "abuse", Evidence: "x", TopCategory: moderation.CategoryHarassment, Categories: json.RawMessage(`{}`)}
		if err := f.service.ReviewComment(ctx, comment.ID); err != nil {
			t.Fatal(err)
		}
		sent := f.messages.All()
		if f.repo.CommentStatus(comment.ID) != moderationtest.CommentBlocked || len(sent) != 1 || sent[0].Content != "Messages.System.Moderation.Comment.Block.ReviewContent" ||
			string(sent[0].Meta) != `{"top_category":"HARASSMENT","reason":"abuse","evidence":"x"}` {
			t.Fatalf("unexpected block %+v", sent)
		}
	})

	t.Run("failures stay pending and are retried", func(t *testing.T) {
		f := newFixture()
		comment := f.reply("<p>x</p>")
		f.classifier.ReviewErr = errors.New("invalid structured output")
		if err := f.service.ReviewComment(ctx, comment.ID); err == nil {
			t.Fatal("the job must fail so it is retried")
		}
		if f.repo.CommentStatus(comment.ID) != moderationtest.CommentPending || len(f.repo.Events()) != 0 {
			t.Fatal("a failed review must not change anything")
		}
	})

	t.Run("missing and disabled", func(t *testing.T) {
		f := newFixture()
		if err := f.service.ReviewComment(ctx, 404); err != nil {
			t.Fatal(err)
		}
		comment := f.reply("<p>x</p>")
		f.classifier.ReviewErr = moderation.ErrClassifierDisabled
		if err := f.service.ReviewComment(ctx, comment.ID); err != nil {
			t.Fatal(err)
		}
		if f.repo.CommentStatus(comment.ID) != moderationtest.CommentVisible {
			t.Fatal("disabled review approves")
		}
	})
}

func (f fixture) walkthrough(status string) moderation.WalkthroughSubject {
	return f.repo.SeedWalkthrough(moderation.WalkthroughSubject{CreatorID: 4, GameID: 81, Title: "Route guide", HTML: "<p>Pick <b>A</b></p>", Game: moderation.GameTitles{JP: "ゲーム"}}, status)
}

func TestReviewWalkthrough(t *testing.T) {
	ctx := context.Background()

	t.Run("allow publishes hidden walkthroughs", func(t *testing.T) {
		f := newFixture()
		hidden := f.walkthrough(moderationtest.WalkthroughHidden)
		f.classifier.Verdict = moderation.Verdict{Model: "gpt-5-mini", Decision: moderation.DecisionAllow, TopCategory: moderation.CategoryHarassment, Categories: json.RawMessage(`{}`)}
		if err := f.service.ReviewWalkthrough(ctx, hidden.ID); err != nil {
			t.Fatal(err)
		}
		if f.repo.WalkthroughStatus(hidden.ID) != moderationtest.WalkthroughPublished || len(f.repo.Events()) != 1 || len(f.messages.All()) != 0 {
			t.Fatal("allowed walkthroughs are published without notices")
		}
		request := f.classifier.Reviewed[0]
		if request.Input != "Game:   ゲーム\nWalkthrough title: \"Route guide\"\nWalkthrough content: \"Pick A\"" || !strings.HasSuffix(request.Instructions, "Default to ALLOW unless there is unmistakable evidence of real-world harm promotion.") {
			t.Fatalf("unexpected review request %+v", request)
		}
	})

	t.Run("allow keeps drafts", func(t *testing.T) {
		f := newFixture()
		draft := f.walkthrough(moderationtest.WalkthroughDraft)
		f.classifier.Verdict = moderation.Verdict{Decision: moderation.DecisionAllow, TopCategory: moderation.CategoryHarassment}
		if err := f.service.ReviewWalkthrough(ctx, draft.ID); err != nil {
			t.Fatal(err)
		}
		if f.repo.WalkthroughStatus(draft.ID) != moderationtest.WalkthroughDraft {
			t.Fatal("drafts saved after the request are not published")
		}
	})

	t.Run("block hides and links back", func(t *testing.T) {
		f := newFixture()
		published := f.walkthrough(moderationtest.WalkthroughPublished)
		f.classifier.Verdict = moderation.Verdict{Decision: moderation.DecisionBlock, Reason: "real harm", Evidence: "quote", TopCategory: moderation.CategoryIllicit}
		if err := f.service.ReviewWalkthrough(ctx, published.ID); err != nil {
			t.Fatal(err)
		}
		sent := f.messages.All()
		if f.repo.WalkthroughStatus(published.ID) != moderationtest.WalkthroughHidden || len(sent) != 1 {
			t.Fatalf("blocked walkthrough must be hidden and notified: %+v", sent)
		}
		notice := sent[0]
		if notice.Type != message.TypeSystem || notice.Tone != message.ToneDestructive || notice.ReceiverID != 4 || *notice.GameID != 81 || notice.CommentID != nil ||
			notice.Title != "Messages.System.Moderation.Walkthrough.Block.Title" || notice.Content != "Messages.System.Moderation.Walkthrough.Block.ReviewContent" ||
			*notice.LinkText != "Messages.System.Moderation.Walkthrough.Block.LinkText" || *notice.LinkURL != "/game/81/walkthrough/"+strconv.Itoa(published.ID) ||
			string(notice.Meta) != `{"top_category":"ILLICIT","reason":"real harm","evidence":"quote","walkthrough_title":"Route guide","walkthrough_id":`+strconv.Itoa(published.ID)+`}` {
			t.Fatalf("unexpected notice %+v %s", notice, notice.Meta)
		}
	})

	t.Run("deleted walkthroughs are skipped", func(t *testing.T) {
		f := newFixture()
		deleted := f.walkthrough(moderationtest.WalkthroughDeleted)
		if err := f.service.ReviewWalkthrough(ctx, deleted.ID); err != nil {
			t.Fatal(err)
		}
		if err := f.service.ReviewWalkthrough(ctx, 404); err != nil {
			t.Fatal(err)
		}
		if len(f.classifier.Reviewed) != 0 {
			t.Fatal("deleted or missing walkthroughs are not reviewed")
		}
	})

	t.Run("failures keep the walkthrough hidden for a retry", func(t *testing.T) {
		f := newFixture()
		hidden := f.walkthrough(moderationtest.WalkthroughHidden)
		f.classifier.ReviewErr = errors.New("timeout")
		if err := f.service.ReviewWalkthrough(ctx, hidden.ID); err == nil {
			t.Fatal("the job must fail so it is retried")
		}
		if f.repo.WalkthroughStatus(hidden.ID) != moderationtest.WalkthroughHidden || len(f.repo.Events()) != 0 {
			t.Fatal("a failed review must not change anything")
		}
	})

	t.Run("disabled classifier publishes", func(t *testing.T) {
		f := newFixture()
		hidden := f.walkthrough(moderationtest.WalkthroughHidden)
		f.classifier.ReviewErr = moderation.ErrClassifierDisabled
		if err := f.service.ReviewWalkthrough(ctx, hidden.ID); err != nil {
			t.Fatal(err)
		}
		if f.repo.WalkthroughStatus(hidden.ID) != moderationtest.WalkthroughPublished || len(f.repo.Events()) != 0 {
			t.Fatal("without a classifier walkthroughs are published directly")
		}
	})
}

func TestScreeningHelpers(t *testing.T) {
	cases := []struct {
		scores   map[string]float64
		max      float64
		top      moderation.Category
		decision moderation.Decision
	}{
		{map[string]float64{}, 0, moderation.CategoryHarassment, moderation.DecisionAllow},
		{map[string]float64{"hate/threatening": 0.05, "sexual": 0.01}, 0.05, moderation.CategoryHateThreatening, moderation.DecisionReview},
		{map[string]float64{"self-harm/intent": 0.8, "unknown": 0.9}, 0.9, moderation.CategorySelfHarmIntent, moderation.DecisionBlock},
		{map[string]float64{"sexual/minors": 0.049}, 0.049, moderation.CategorySexualMinors, moderation.DecisionAllow},
	}
	for _, c := range cases {
		screening := moderation.Screening{CategoryScores: c.scores}
		if screening.MaxScore() != c.max || screening.TopCategory() != c.top || screening.Decision() != c.decision {
			t.Fatalf("%v: got %v %v %v", c.scores, screening.MaxScore(), screening.TopCategory(), screening.Decision())
		}
	}
	if got := moderation.PlainText(" <p>Hi<br/>  <b>there</b> </p> "); got != "Hi there" {
		t.Fatalf("plain text %q", got)
	}
	if got := moderation.PlainText("<p>a<BR >b　c&amp;</p>"); got != "a b c&amp;" {
		t.Fatalf("plain text %q", got)
	}
	if moderation.PlainText("") != "" {
		t.Fatal("empty html")
	}
}
