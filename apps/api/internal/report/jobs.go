package report

type AlertAdmins struct {
	ReportID int `json:"report_id"`
}

func (AlertAdmins) Kind() string {
	return "report_alert_admins"
}

func (AlertAdmins) MaxAttempts() int {
	return 5
}
