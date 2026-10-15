package walkthroughhttp

type formatWalkthroughInput struct {
	ID   int `path:"id"`
	Body struct {
		Text string `json:"text" minLength:"1" maxLength:"50000" doc:"The walkthrough as plain text"`
	}
}

type formatTaskInput struct {
	Task string `path:"task" pattern:"^[0-9a-f-]{36}$"`
}
