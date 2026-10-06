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

func monthStart(now time.Time, location *time.Location) time.Time {
	if location == nil {
		location = time.UTC
	}
	local := now.In(location)
	return time.Date(local.Year(), local.Month(), 1, 0, 0, 0, 0, location)
}
