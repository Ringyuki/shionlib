package moderation

type ScreenComment struct {
	CommentID int `json:"comment_id"`
}

func (ScreenComment) Kind() string { return "moderation_screen_comment" }

func (ScreenComment) Queue() string { return ScreeningQueue }

func (ScreenComment) UniqueByArgs() bool { return true }

type ReviewComment struct {
	CommentID int `json:"comment_id"`
}

func (ReviewComment) Kind() string { return "moderation_review_comment" }

func (ReviewComment) Queue() string { return CommentReviewQueue }

type ReviewWalkthrough struct {
	WalkthroughID int `json:"walkthrough_id"`
}

func (ReviewWalkthrough) Kind() string { return "moderation_review_walkthrough" }

func (ReviewWalkthrough) Queue() string { return WalkthroughReviewQueue }

func (ReviewWalkthrough) UniqueByArgs() bool { return true }
