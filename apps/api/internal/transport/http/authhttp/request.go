package authhttp

type passkeyPathInput struct {
	ID int `path:"id" minimum:"1"`
}

type oidcIdentityPathInput struct {
	ID int `path:"id" minimum:"1"`
}

type passwordLoginInput struct {
	Body struct {
		Identifier string `json:"identifier" minLength:"1"`
		Password   string `json:"password" minLength:"1"`
	}
}

type refreshSessionInput struct {
	RefreshToken string `cookie:"shionlib_refresh_token"`
}

type forgotPasswordInput struct {
	Body struct {
		Email string `json:"email" format:"email"`
	}
}

type checkPasswordResetInput struct {
	Body struct {
		Token string `json:"token" format:"uuid"`
		Email string `json:"email" format:"email"`
	}
}

type resetPasswordInput struct {
	Body struct {
		Password string `json:"password" minLength:"1"`
		Email    string `json:"email" format:"email"`
		Token    string `json:"token" format:"uuid"`
	}
}

type requestCodeInput struct {
	Body struct {
		Email string `json:"email" format:"email"`
	}
}

type verifyCodeInput struct {
	Body struct {
		Code  string `json:"code" minLength:"1"`
		Email string `json:"email" format:"email"`
		UUID  string `json:"uuid" format:"uuid"`
	}
}

type passkeyRegisterOptionsInput struct {
	Body *struct {
		Name *string `json:"name,omitempty" maxLength:"128"`
	}
}

type passkeyRegisterVerifyInput struct {
	Body struct {
		FlowID   string         `json:"flow_id" minLength:"1"`
		Response map[string]any `json:"response"`
		Name     *string        `json:"name,omitempty" maxLength:"128"`
	}
}

type passkeyLoginOptionsInput struct {
	Body *struct {
		Identifier *string `json:"identifier,omitempty"`
	}
}

type passkeyLoginVerifyInput struct {
	Body struct {
		FlowID   string         `json:"flow_id" minLength:"1"`
		Response map[string]any `json:"response"`
	}
}

type oidcStartInput struct {
	ReturnTo string `query:"returnTo"`
	Mode     string `query:"mode"`
	Origin   string `query:"origin"`
}

type oidcCallbackInput struct {
	Code        string `query:"code"`
	State       string `query:"state"`
	Error       string `query:"error"`
	Transaction string `cookie:"shionlib_oidc_tx"`
}
