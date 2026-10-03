package upload

import (
	"time"
)

type QuotaField string

const (
	FieldSize QuotaField = "SIZE"
	FieldUsed QuotaField = "USED"
)

type QuotaAction string

const (
	ActionAdd QuotaAction = "ADD"
	ActionSub QuotaAction = "SUB"
	ActionUse QuotaAction = "USE"
)

const (
	ReasonInitialGrant  = "INITIAL_GRANT"
	ReasonResetUsed     = "RESET_USED"
	ReasonDynamicTopup  = "DYNAMIC_TOPUP"
	ReasonDynamicReduce = "DYNAMIC_REDUCE"
	ReasonResetQuota    = "RESET_QUOTA"
	quotaBatchSize      = 500
)

type Quota struct {
	ID           int
	UserID       int
	Size         int64
	Used         int64
	IsFirstGrant bool
}

type QuotaRecord struct {
	ID        int
	QuotaID   int
	Field     QuotaField
	Action    QuotaAction
	Amount    int64
	Reason    *string
	SessionID *int
	Withdrawn bool
}

type NewQuotaRecord struct {
	QuotaID   int
	Field     QuotaField
	Action    QuotaAction
	Amount    int64
	Reason    *string
	SessionID *int
}

type QuotaPolicy struct {
	BaseBytes           int64
	CapBytes            int64
	TopupStepBytes      int64
	TopupThresholdBytes int64
	ReduceStepBytes     int64
	ReduceInactiveDays  int
	GrantAfterDays      int
	LongestInactiveDays int
	Location            *time.Location
}

func (p QuotaPolicy) monthStart(now time.Time) time.Time {
	location := p.Location
	if location == nil {
		location = time.UTC
	}
	local := now.In(location)
	return time.Date(local.Year(), local.Month(), 1, 0, 0, 0, 0, location)
}
