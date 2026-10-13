package aihttp

type aiCatalogModelsInput struct {
	Q string `query:"q" maxLength:"100"`
}
