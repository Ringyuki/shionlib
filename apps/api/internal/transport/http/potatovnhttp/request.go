package potatovnhttp

type potatoVNGamePathInput struct {
	GameID int `path:"gameId" minimum:"1"`
}

type bindPotatoVNInput struct {
	Body struct {
		PVNUserName string `json:"pvn_user_name" minLength:"1" maxLength:"255"`
		PVNPassword string `json:"pvn_password" minLength:"1"`
	}
}
