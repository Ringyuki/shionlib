package txtest

import "context"

type activeKey struct{}

type active struct {
	hooks []func(context.Context)
}

type Immediate struct {
	Calls int
}

func (t *Immediate) WithinTransaction(ctx context.Context, fn func(ctx context.Context) error) error {
	t.Calls++
	if _, nested := ctx.Value(activeKey{}).(*active); nested {
		return fn(ctx)
	}
	tx := &active{}
	if err := fn(context.WithValue(ctx, activeKey{}, tx)); err != nil {
		return err
	}
	for _, hook := range tx.hooks {
		hook(ctx)
	}
	return nil
}

func (t *Immediate) AfterCommit(ctx context.Context, fn func(ctx context.Context)) {
	if tx, ok := ctx.Value(activeKey{}).(*active); ok {
		tx.hooks = append(tx.hooks, fn)
		return
	}
	fn(ctx)
}
