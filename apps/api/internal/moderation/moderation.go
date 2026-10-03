package moderation

import (
	"encoding/json"
	"errors"
	"slices"
	"time"
)

var (
	ErrSubjectNotFound    = errors.New("moderation subject not found")
	ErrClassifierDisabled = errors.New("moderation classifier is not configured")
)

type Decision string

const (
	DecisionAllow  Decision = "ALLOW"
	DecisionBlock  Decision = "BLOCK"
	DecisionReview Decision = "REVIEW"
)

type Category string

const (
	CategoryHarassment            Category = "HARASSMENT"
	CategoryHarassmentThreatening Category = "HARASSMENT_THREATENING"
	CategorySexual                Category = "SEXUAL"
	CategorySexualMinors          Category = "SEXUAL_MINORS"
	CategoryHate                  Category = "HATE"
	CategoryHateThreatening       Category = "HATE_THREATENING"
	CategoryIllicit               Category = "ILLICIT"
	CategoryIllicitViolent        Category = "ILLICIT_VIOLENT"
	CategorySelfHarm              Category = "SELF_HARM"
	CategorySelfHarmIntent        Category = "SELF_HARM_INTENT"
	CategorySelfHarmInstructions  Category = "SELF_HARM_INSTRUCTIONS"
	CategoryViolence              Category = "VIOLENCE"
	CategoryViolenceGraphic       Category = "VIOLENCE_GRAPHIC"
	CategorySpam                  Category = "SPAM"
	CategoryMeaningless           Category = "MEANINGLESS"
)

var categories = []Category{
	CategoryHarassment, CategoryHarassmentThreatening, CategorySexual, CategorySexualMinors,
	CategoryHate, CategoryHateThreatening, CategoryIllicit, CategoryIllicitViolent,
	CategorySelfHarm, CategorySelfHarmIntent, CategorySelfHarmInstructions,
	CategoryViolence, CategoryViolenceGraphic, CategorySpam, CategoryMeaningless,
}

type categoryLabel struct {
	category Category
	label    string
}

var categoryLabels = []categoryLabel{
	{CategoryHarassment, "harassment"},
	{CategoryHarassmentThreatening, "harassment/threatening"},
	{CategorySexual, "sexual"},
	{CategoryHate, "hate"},
	{CategoryHateThreatening, "hate/threatening"},
	{CategoryIllicit, "illicit"},
	{CategoryIllicitViolent, "illicit/violent"},
	{CategorySelfHarmIntent, "self-harm/intent"},
	{CategorySelfHarmInstructions, "self-harm/instructions"},
	{CategorySelfHarm, "self-harm"},
	{CategorySexualMinors, "sexual/minors"},
	{CategoryViolence, "violence"},
	{CategoryViolenceGraphic, "violence/graphic"},
	{CategorySpam, "spam"},
	{CategoryMeaningless, "meaningless"},
}

func Categories() []Category {
	return slices.Clone(categories)
}

func (c Category) Valid() bool {
	return slices.Contains(categories, c)
}

type Auditor int

const (
	AuditorScreening Auditor = 1
	AuditorReview    Auditor = 2
)

const (
	ReviewThreshold = 0.05
	BlockThreshold  = 0.8
)

type Event struct {
	ID          int
	Auditor     Auditor
	Model       string
	Decision    Decision
	TopCategory Category
	Categories  json.RawMessage
	Scores      json.RawMessage
	MaxScore    *float64
	Reason      *string
	Evidence    *string
	Created     time.Time
}

type NewEvent struct {
	CommentID     *int
	WalkthroughID *int
	Auditor       Auditor
	Model         string
	Decision      Decision
	TopCategory   Category
	Categories    json.RawMessage
	Scores        json.RawMessage
	MaxScore      *float64
	Reason        *string
	Evidence      *string
}

type Screening struct {
	Model          string
	Categories     json.RawMessage
	Scores         json.RawMessage
	CategoryScores map[string]float64
}

func (s Screening) MaxScore() float64 {
	highest := 0.0
	for _, score := range s.CategoryScores {
		highest = max(highest, score)
	}
	return highest
}

func (s Screening) TopCategory() Category {
	top, highest := CategoryHarassment, -1.0
	for _, entry := range categoryLabels {
		score, ok := s.CategoryScores[entry.label]
		if ok && score > highest {
			top, highest = entry.category, score
		}
	}
	return top
}

func (s Screening) Decision() Decision {
	switch score := s.MaxScore(); {
	case score >= BlockThreshold:
		return DecisionBlock
	case score >= ReviewThreshold:
		return DecisionReview
	default:
		return DecisionAllow
	}
}

type ReviewRequest struct {
	Instructions string
	Input        string
}

type Verdict struct {
	Model       string
	Decision    Decision
	Reason      string
	Evidence    string
	TopCategory Category
	Categories  json.RawMessage
}

type GameTitles struct {
	JP string
	ZH string
	EN string
}

type CommentSubject struct {
	ID              int
	CreatorID       int
	GameID          int
	HTML            string
	Pending         bool
	ParentID        *int
	ParentCreatorID *int
	ParentHTML      string
	Game            GameTitles
}

type WalkthroughSubject struct {
	ID            int
	CreatorID     int
	GameID        int
	Title         string
	HTML          string
	Deleted       bool
	ReviewPending bool
	Game          GameTitles
}

const (
	ScreeningQueue         = "moderation_screening"
	CommentReviewQueue     = "moderation_comment_review"
	WalkthroughReviewQueue = "moderation_walkthrough_review"
)

func QueueConcurrency() map[string]int {
	return map[string]int{ScreeningQueue: 10, CommentReviewQueue: 1, WalkthroughReviewQueue: 1}
}

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
