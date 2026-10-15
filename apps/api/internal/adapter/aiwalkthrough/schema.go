package aiwalkthrough

type scalarType struct {
	Type string `json:"type"`
}

type arrayOf struct {
	Type  string     `json:"type"`
	Items scalarType `json:"items"`
}

type routeProperties struct {
	Name       scalarType `json:"name"`
	Characters arrayOf    `json:"characters"`
	Requires   arrayOf    `json:"requires"`
	Condition  scalarType `json:"condition"`
	Ending     scalarType `json:"ending"`
	Steps      arrayOf    `json:"steps"`
}

type routeSchema struct {
	Type                 string          `json:"type"`
	Properties           routeProperties `json:"properties"`
	Required             []string        `json:"required"`
	AdditionalProperties bool            `json:"additionalProperties"`
}

type routesArray struct {
	Type  string      `json:"type"`
	Items routeSchema `json:"items"`
}

type formatProperties struct {
	Note   arrayOf     `json:"note"`
	Routes routesArray `json:"routes"`
}

type formatSchema struct {
	Schema               string           `json:"$schema"`
	Type                 string           `json:"type"`
	Properties           formatProperties `json:"properties"`
	Required             []string         `json:"required"`
	AdditionalProperties bool             `json:"additionalProperties"`
}

func newFormatSchema() formatSchema {
	text := scalarType{Type: "string"}
	texts := arrayOf{Type: "array", Items: text}
	numbers := arrayOf{Type: "array", Items: scalarType{Type: "integer"}}
	return formatSchema{
		Schema: "http://json-schema.org/draft-07/schema#",
		Type:   "object",
		Properties: formatProperties{
			Note: texts,
			Routes: routesArray{Type: "array", Items: routeSchema{
				Type: "object",
				Properties: routeProperties{
					Name:       text,
					Characters: numbers,
					Requires:   numbers,
					Condition:  text,
					Ending:     text,
					Steps:      texts,
				},
				Required:             []string{"name", "characters", "requires", "condition", "ending", "steps"},
				AdditionalProperties: false,
			}},
		},
		Required:             []string{"note", "routes"},
		AdditionalProperties: false,
	}
}
