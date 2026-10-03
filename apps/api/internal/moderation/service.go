package moderation

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/activity"
)

func instructions(specific []string) string {
	lines := make([]string, 0, len(baseRules)+len(categoryLabels)+len(closingRules)+len(specific))
	lines = append(lines, baseRules...)
	for _, entry := range categoryLabels {
		lines = append(lines, "- "+entry.label)
	}
	lines = append(lines, closingRules...)
	lines = append(lines, specific...)
	return strings.Join(lines, "\n")
}

func commentReview(subject CommentSubject) ReviewRequest {
	lines := []string{"Game: " + subject.Game.label()}
	if parent := PlainText(subject.ParentHTML); subject.ParentID != nil && parent != "" {
		lines = append(lines, quoted("Replying to", parent))
	}
	lines = append(lines, quoted("Comment", PlainText(subject.HTML)))
	return ReviewRequest{Instructions: instructions(commentRules), Input: strings.Join(lines, "\n")}
}

func walkthroughReview(subject WalkthroughSubject) ReviewRequest {
	lines := []string{
		"Game: " + subject.Game.label(),
		quoted("Walkthrough title", subject.Title),
		quoted("Walkthrough content", PlainText(subject.HTML)),
	}
	return ReviewRequest{Instructions: instructions(walkthroughRules), Input: strings.Join(lines, "\n")}
}

func quoted(label, value string) string {
	return label + `: "` + value + `"`
}

type Service struct {
	repo       Repository
	classifier Classifier
	messages   Messages
	activities Activities
	queue      Queue
	tx         Transactor
}

func NewService(repo Repository, classifier Classifier, messages Messages, activities Activities, queue Queue, tx Transactor) *Service {
	return &Service{repo: repo, classifier: classifier, messages: messages, activities: activities, queue: queue, tx: tx}
}

func (s *Service) ScreenComment(ctx context.Context, commentID int) error {
	subject, err := s.repo.CommentSubject(ctx, commentID)
	if errors.Is(err, ErrSubjectNotFound) {
		return nil
	}
	if err != nil {
		return err
	}
	if !subject.Pending {
		return nil
	}
	text := PlainText(subject.HTML)
	if text == "" {
		return s.approveUnreviewed(ctx, subject)
	}
	screening, err := s.classifier.Screen(ctx, text)
	if errors.Is(err, ErrClassifierDisabled) {
		return s.approveUnreviewed(ctx, subject)
	}
	if err != nil {
		return fmt.Errorf("screen comment %d: %w", commentID, err)
	}
	decision, top, highest := screening.Decision(), screening.TopCategory(), screening.MaxScore()
	applied := false
	err = s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		current, err := s.lockUnchangedComment(ctx, subject)
		if err != nil || current == nil {
			return err
		}
		applied = true
		if err := s.repo.RecordEvent(ctx, NewEvent{
			CommentID:   &commentID,
			Auditor:     AuditorScreening,
			Model:       screening.Model,
			Decision:    decision,
			TopCategory: top,
			Categories:  screening.Categories,
			Scores:      screening.Scores,
			MaxScore:    &highest,
		}); err != nil {
			return err
		}
		switch decision {
		case DecisionAllow:
			return s.approveComment(ctx, *current)
		case DecisionBlock:
			return s.blockComment(ctx, *current, BlockDetails{TopCategory: top})
		}
		return nil
	})
	if err != nil {
		return err
	}
	if applied && decision == DecisionReview {
		return s.queue.Enqueue(ctx, ReviewComment{CommentID: commentID})
	}
	return nil
}

func (s *Service) ReviewComment(ctx context.Context, commentID int) error {
	subject, err := s.repo.CommentSubject(ctx, commentID)
	if errors.Is(err, ErrSubjectNotFound) {
		return nil
	}
	if err != nil {
		return err
	}
	if !subject.Pending {
		return nil
	}
	verdict, err := s.classifier.Review(ctx, commentReview(subject))
	if errors.Is(err, ErrClassifierDisabled) {
		return s.approveUnreviewed(ctx, subject)
	}
	if err != nil {
		return fmt.Errorf("review comment %d: %w", commentID, err)
	}
	return s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		current, err := s.lockUnchangedComment(ctx, subject)
		if err != nil || current == nil {
			return err
		}
		if err := s.repo.RecordEvent(ctx, reviewEvent(verdict, &commentID, nil)); err != nil {
			return err
		}
		if verdict.Decision == DecisionAllow {
			return s.approveComment(ctx, *current)
		}
		return s.blockComment(ctx, *current, BlockDetails{
			TopCategory: verdict.TopCategory,
			Reason:      &verdict.Reason,
			Evidence:    &verdict.Evidence,
			Reviewed:    true,
		})
	})
}

func (s *Service) ReviewWalkthrough(ctx context.Context, walkthroughID int) error {
	subject, err := s.repo.WalkthroughSubject(ctx, walkthroughID)
	if errors.Is(err, ErrSubjectNotFound) {
		return nil
	}
	if err != nil {
		return err
	}
	if subject.Deleted || !subject.ReviewPending {
		return nil
	}
	verdict, err := s.classifier.Review(ctx, walkthroughReview(subject))
	if errors.Is(err, ErrClassifierDisabled) {
		return s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
			current, err := s.lockUnchangedWalkthrough(ctx, subject)
			if err != nil || current == nil {
				return err
			}
			return s.repo.PublishWalkthrough(ctx, walkthroughID)
		})
	}
	if err != nil {
		return fmt.Errorf("review walkthrough %d: %w", walkthroughID, err)
	}
	return s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		current, err := s.lockUnchangedWalkthrough(ctx, subject)
		if err != nil || current == nil {
			return err
		}
		if err := s.repo.RecordEvent(ctx, reviewEvent(verdict, nil, &walkthroughID)); err != nil {
			return err
		}
		if verdict.Decision == DecisionBlock {
			if err := s.repo.HideWalkthrough(ctx, walkthroughID); err != nil {
				return err
			}
			return s.messages.Send(ctx, walkthroughBlockMessage(*current, verdict))
		}
		return s.repo.PublishWalkthrough(ctx, walkthroughID)
	})
}

func (s *Service) approveUnreviewed(ctx context.Context, subject CommentSubject) error {
	return s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		current, err := s.lockUnchangedComment(ctx, subject)
		if err != nil || current == nil {
			return err
		}
		return s.approveComment(ctx, *current)
	})
}

func (s *Service) lockUnchangedComment(ctx context.Context, screened CommentSubject) (*CommentSubject, error) {
	current, err := s.repo.LockCommentSubject(ctx, screened.ID)
	if errors.Is(err, ErrSubjectNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if !current.Pending || current.HTML != screened.HTML {
		return nil, nil
	}
	return &current, nil
}

func (s *Service) lockUnchangedWalkthrough(ctx context.Context, reviewed WalkthroughSubject) (*WalkthroughSubject, error) {
	current, err := s.repo.LockWalkthroughSubject(ctx, reviewed.ID)
	if errors.Is(err, ErrSubjectNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if current.Deleted || !current.ReviewPending || current.HTML != reviewed.HTML || current.Title != reviewed.Title {
		return nil, nil
	}
	return &current, nil
}

func (s *Service) RequeueStaleReviews(ctx context.Context, updatedBefore time.Time) error {
	comments, err := s.repo.PendingComments(ctx, updatedBefore, requeueBatch)
	if err != nil {
		return err
	}
	for _, id := range comments {
		if err := s.queue.Enqueue(ctx, ScreenComment{CommentID: id}); err != nil {
			return err
		}
	}
	walkthroughs, err := s.repo.PendingWalkthroughReviews(ctx, updatedBefore, requeueBatch)
	if err != nil {
		return err
	}
	for _, id := range walkthroughs {
		if err := s.queue.Enqueue(ctx, ReviewWalkthrough{WalkthroughID: id}); err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) approveComment(ctx context.Context, subject CommentSubject) error {
	if err := s.repo.ApproveComment(ctx, subject.ID); err != nil {
		return err
	}
	commentID, gameID := subject.ID, subject.GameID
	if err := s.activities.Record(ctx, activity.NewActivity{
		Type:      activity.TypeComment,
		UserID:    subject.CreatorID,
		GameID:    &gameID,
		CommentID: &commentID,
	}); err != nil {
		return err
	}
	if subject.ParentID == nil || subject.ParentCreatorID == nil || *subject.ParentCreatorID == subject.CreatorID {
		return nil
	}
	return s.messages.Send(ctx, CommentReplyMessage(notice(subject)))
}

func (s *Service) blockComment(ctx context.Context, subject CommentSubject, details BlockDetails) error {
	if err := s.repo.BlockComment(ctx, subject.ID); err != nil {
		return err
	}
	return s.messages.Send(ctx, CommentBlockMessage(notice(subject), details))
}

func notice(subject CommentSubject) CommentNotice {
	n := CommentNotice{CommentID: subject.ID, GameID: subject.GameID, AuthorID: subject.CreatorID}
	if subject.ParentCreatorID != nil {
		n.ParentAuthorID = *subject.ParentCreatorID
	}
	return n
}

func reviewEvent(verdict Verdict, commentID, walkthroughID *int) NewEvent {
	return NewEvent{
		CommentID:     commentID,
		WalkthroughID: walkthroughID,
		Auditor:       AuditorReview,
		Model:         verdict.Model,
		Decision:      verdict.Decision,
		TopCategory:   verdict.TopCategory,
		Categories:    verdict.Categories,
		Reason:        &verdict.Reason,
		Evidence:      &verdict.Evidence,
	}
}
