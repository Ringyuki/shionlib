package patch

type Clearable[T any] struct {
	Set   bool
	Value *T
}
