package aipg

import (
	"context"
	"fmt"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/aimodel"
	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
)

func (r *Repository) ListModels(ctx context.Context) ([]ai.Model, error) {
	rows, err := r.db(ctx).AIModel.Query().
		Order(ent.Desc(aimodel.FieldIsDefault), ent.Asc(aimodel.FieldName), ent.Asc(aimodel.FieldID)).
		All(ctx)
	if err != nil {
		return nil, fmt.Errorf("list ai models: %w", err)
	}
	models := make([]ai.Model, len(rows))
	for i, row := range rows {
		models[i] = toModel(row)
	}
	return models, nil
}

func (r *Repository) GetModel(ctx context.Context, id int) (ai.Model, error) {
	row, err := r.db(ctx).AIModel.Get(ctx, id)
	if postgres.IsNotFound(err) {
		return ai.Model{}, ai.ErrModelNotFound
	}
	if err != nil {
		return ai.Model{}, fmt.Errorf("get ai model %d: %w", id, err)
	}
	return toModel(row), nil
}

func (r *Repository) CreateModel(ctx context.Context, in ai.NewModel) (int, error) {
	row, err := r.db(ctx).AIModel.Create().
		SetKey(in.Key).
		SetName(in.Name).
		SetNillableDescription(in.Description).
		SetNillableCanonicalID(in.CanonicalID).
		SetVision(in.Vision).
		SetModeration(in.Moderation).
		SetTemperature(in.Temperature).
		SetToolCall(in.ToolCall).
		SetReasoning(in.Reasoning).
		SetNillableContextLimit(in.ContextLimit).
		SetNillableOutputLimit(in.OutputLimit).
		Save(ctx)
	if err != nil {
		return 0, translateModel(err, "create ai model")
	}
	return row.ID, nil
}

func (r *Repository) UpdateModel(ctx context.Context, id int, changes ai.ModelChanges) error {
	update := r.db(ctx).AIModel.UpdateOneID(id)
	if changes.Name != nil {
		update.SetName(*changes.Name)
	}
	if changes.Description != nil {
		if *changes.Description == nil {
			update.ClearDescription()
		} else {
			update.SetDescription(**changes.Description)
		}
	}
	if changes.CanonicalID != nil {
		if *changes.CanonicalID == nil {
			update.ClearCanonicalID()
		} else {
			update.SetCanonicalID(**changes.CanonicalID)
		}
	}
	if caps := changes.Capabilities; caps != nil {
		update.SetVision(caps.Vision).
			SetModeration(caps.Moderation).
			SetTemperature(caps.Temperature).
			SetToolCall(caps.ToolCall).
			SetReasoning(caps.Reasoning)
		if caps.ContextLimit == nil {
			update.ClearContextLimit()
		} else {
			update.SetContextLimit(*caps.ContextLimit)
		}
		if caps.OutputLimit == nil {
			update.ClearOutputLimit()
		} else {
			update.SetOutputLimit(*caps.OutputLimit)
		}
	}
	if changes.Enabled != nil {
		update.SetEnabled(*changes.Enabled)
	}
	if changes.IsDefault != nil {
		update.SetIsDefault(*changes.IsDefault)
	}
	if _, err := update.Save(ctx); err != nil {
		return translateModel(err, fmt.Sprintf("update ai model %d", id))
	}
	return nil
}

func translateModel(err error, action string) error {
	switch {
	case postgres.IsNotFound(err):
		return ai.ErrModelNotFound
	case postgres.IsUniqueViolation(err, uniqueModelKey), postgres.IsUniqueViolation(err, uniqueModelCanonical):
		return ai.ErrModelTaken
	}
	return fmt.Errorf("%s: %w", action, err)
}

func (r *Repository) ClearDefaultModel(ctx context.Context, exceptID int) error {
	if _, err := r.db(ctx).AIModel.Update().
		Where(aimodel.IsDefault(true), aimodel.IDNEQ(exceptID)).
		SetIsDefault(false).
		Save(ctx); err != nil {
		return fmt.Errorf("clear default ai model: %w", err)
	}
	return nil
}

func (r *Repository) DeleteModel(ctx context.Context, id int) error {
	err := r.db(ctx).AIModel.DeleteOneID(id).Exec(ctx)
	if postgres.IsNotFound(err) {
		return ai.ErrModelNotFound
	}
	if err != nil {
		return fmt.Errorf("delete ai model %d: %w", id, err)
	}
	return nil
}
