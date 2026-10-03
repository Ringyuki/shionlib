package response

type PageMeta struct {
	TotalItems   int `json:"totalItems"`
	ItemCount    int `json:"itemCount"`
	ItemsPerPage int `json:"itemsPerPage"`
	TotalPages   int `json:"totalPages"`
	CurrentPage  int `json:"currentPage"`
}

type Page[T any] struct {
	Items []T      `json:"items"`
	Meta  PageMeta `json:"meta"`
}

func NewPageMeta(total, itemCount, pageSize, page int) PageMeta {
	totalPages := 0
	if pageSize > 0 {
		totalPages = (total + pageSize - 1) / pageSize
	}
	return PageMeta{
		TotalItems:   total,
		ItemCount:    itemCount,
		ItemsPerPage: pageSize,
		TotalPages:   totalPages,
		CurrentPage:  page,
	}
}

func NewPage[T any](items []T, total, pageSize, page int) Page[T] {
	if items == nil {
		items = []T{}
	}
	return Page[T]{Items: items, Meta: NewPageMeta(total, len(items), pageSize, page)}
}

func MapPage[S, T any](items []S, total, pageSize, page int, mapper func(S) T) Page[T] {
	mapped := make([]T, len(items))
	for i, item := range items {
		mapped[i] = mapper(item)
	}
	return NewPage(mapped, total, pageSize, page)
}
