package ai

import (
	"context"
	"time"
)

type SceneService struct {
	gateway *Service
	repo    Repository
	stats   StatsStore
	now     func() time.Time
}

func NewSceneService(gateway *Service, repo Repository, stats StatsStore, now func() time.Time) *SceneService {
	return &SceneService{gateway: gateway, repo: repo, stats: stats, now: now}
}

func (s *SceneService) List(ctx context.Context) ([]Scene, error) {
	configs, err := s.repo.ListSceneConfigs(ctx)
	if err != nil {
		return nil, err
	}
	byKey := make(map[string]SceneConfig, len(configs))
	ids := make([]int, 0, len(configs)+1)
	for _, config := range configs {
		byKey[config.Key] = config
		if config.ModelID != nil {
			ids = append(ids, *config.ModelID)
		}
	}
	defaultID, err := s.repo.DefaultModelID(ctx)
	if err != nil {
		return nil, err
	}
	if defaultID != nil {
		ids = append(ids, *defaultID)
	}
	models, err := s.sceneModels(ctx, ids)
	if err != nil {
		return nil, err
	}
	stats, err := s.stats.Grouped(ctx, DimensionScene, s.now().Add(-24*time.Hour))
	if err != nil {
		return nil, err
	}
	definitions := s.gateway.Scenes()
	scenes := make([]Scene, len(definitions))
	for i, definition := range definitions {
		config := byKey[definition.Key]
		scene := Scene{
			SceneDefinition: definition,
			Temperature:     config.Temperature,
			MaxOutputTokens: config.MaxOutputTokens,
			Timeout:         config.Timeout,
			Stats:           stats[definition.Key],
		}
		var effective *SceneModel
		if config.ModelID != nil {
			if model, ok := models[*config.ModelID]; ok {
				scene.Model, effective = refOf(model), &model
			}
		} else if defaultID != nil {
			if model, ok := models[*defaultID]; ok {
				effective = &model
			}
		}
		if effective != nil {
			scene.Effective = refOf(*effective)
		}
		scene.Problem = sceneProblem(definition, effective)
		scenes[i] = scene
	}
	return scenes, nil
}

func (s *SceneService) Update(ctx context.Context, key string, settings SceneSettings) (Scene, error) {
	definition, ok := s.gateway.Scene(key)
	if !ok {
		return Scene{}, ErrSceneNotFound
	}
	if settings.ModelID != nil {
		models, err := s.sceneModels(ctx, []int{*settings.ModelID})
		if err != nil {
			return Scene{}, err
		}
		model, found := models[*settings.ModelID]
		if !found {
			return Scene{}, ErrModelNotFound
		}
		if !definition.Output.Accepts(model.ModelRef) {
			return Scene{}, ErrSceneModelMismatch
		}
	}
	err := s.repo.SaveSceneConfig(ctx, SceneConfig{
		Key:             key,
		ModelID:         settings.ModelID,
		Temperature:     settings.Temperature,
		MaxOutputTokens: settings.MaxOutputTokens,
		Timeout:         settings.Timeout,
	})
	if err != nil {
		return Scene{}, err
	}
	scenes, err := s.List(ctx)
	if err != nil {
		return Scene{}, err
	}
	for _, scene := range scenes {
		if scene.Key == key {
			return scene, nil
		}
	}
	return Scene{}, ErrSceneNotFound
}

func (s *SceneService) sceneModels(ctx context.Context, ids []int) (map[int]SceneModel, error) {
	if len(ids) == 0 {
		return map[int]SceneModel{}, nil
	}
	models, err := s.repo.SceneModels(ctx, ids)
	if err != nil {
		return nil, err
	}
	byID := make(map[int]SceneModel, len(models))
	for _, model := range models {
		byID[model.ID] = model
	}
	return byID, nil
}
