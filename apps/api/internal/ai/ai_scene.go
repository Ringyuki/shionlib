package ai

import "time"

type Output string

const (
	OutputObject     Output = "object"
	OutputText       Output = "text"
	OutputModeration Output = "moderation"
)

func (o Output) Accepts(model ModelRef) bool {
	return model.Moderation == (o == OutputModeration)
}

type SceneDefinition struct {
	Key    string
	Label  string
	Output Output
}

type SceneConfig struct {
	Key             string
	ModelID         *int
	Temperature     *float64
	MaxOutputTokens *int
	Timeout         *time.Duration
}

type SceneProblem string

const (
	ProblemNoModel     SceneProblem = "no_model"
	ProblemNoRoute     SceneProblem = "no_route"
	ProblemWrongOutput SceneProblem = "wrong_output"
)

type SceneModel struct {
	ModelRef
	Enabled      bool
	ActiveRoutes int
}

type Scene struct {
	SceneDefinition
	Model           *ModelRef
	Effective       *ModelRef
	Temperature     *float64
	MaxOutputTokens *int
	Timeout         *time.Duration
	Problem         *SceneProblem
	Stats           Stats
}

type SceneSettings struct {
	ModelID         *int
	Temperature     *float64
	MaxOutputTokens *int
	Timeout         *time.Duration
}

func sceneProblem(definition SceneDefinition, model *SceneModel) *SceneProblem {
	var problem SceneProblem
	switch {
	case model == nil || !model.Enabled:
		problem = ProblemNoModel
	case !definition.Output.Accepts(model.ModelRef):
		problem = ProblemWrongOutput
	case model.ActiveRoutes == 0:
		problem = ProblemNoRoute
	default:
		return nil
	}
	return &problem
}

func refOf(model SceneModel) *ModelRef {
	ref := model.ModelRef
	return &ref
}
