package translator_test

import (
	"errors"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/apperror"
	"github.com/Ringyuki/shionlib/apps/api/internal/translator"
	"github.com/Ringyuki/shionlib/apps/api/internal/translator/translatortest"
)

var day = time.Date(2026, 5, 15, 0, 0, 0, 0, time.UTC)

func refNames(refs []translator.Ref) []string {
	out := make([]string, len(refs))
	for i, ref := range refs {
		out[i] = ref.Name
	}
	return out
}

func TestGetCountsWorks(t *testing.T) {
	repo := translatortest.NewMemoryRepository()
	tea := repo.Seed(translator.Translator{Name: "绿茶汉化组", Aliases: []string{"Green Tea"}})
	repo.Credit(1, true, day, tea.ID)
	repo.Credit(2, false, day, tea.ID)
	got, err := translator.NewService(repo).Get(t.Context(), tea.ID)
	if err != nil || got.ID != tea.ID || got.Name != "绿茶汉化组" || got.WorksCount != 1 {
		t.Fatalf("get %+v %v", got, err)
	}
	if _, err := translator.NewService(repo).Get(t.Context(), 99); !errors.Is(err, translator.ErrNotFound) {
		t.Fatalf("missing: %v", err)
	}
}

func TestListAndSuggest(t *testing.T) {
	repo := translatortest.NewMemoryRepository()
	tea := repo.Seed(translator.Translator{Name: "绿茶汉化组"})
	repo.Seed(translator.Translator{Name: "绿洲汉化组"})
	repo.Credit(1, true, day, tea.ID)
	service := translator.NewService(repo)
	items, total, err := service.List(t.Context(), "  绿茶 ", translator.Page{Number: 1, Size: 10})
	if err != nil || total != 1 || items[0].ID != tea.ID {
		t.Fatalf("list %+v %d %v", items, total, err)
	}
	suggested, err := service.Suggest(t.Context(), " 绿 ")
	if err != nil || len(suggested) != 2 {
		t.Fatalf("suggest %+v %v", suggested, err)
	}
	if top, err := service.Suggest(t.Context(), "   "); err != nil || len(top) != 2 || top[0].ID != tea.ID {
		t.Fatalf("an empty query suggests the translators with the most works: %+v %v", top, err)
	}
}

func TestResolveReusesNamesAndAliasesAndCreatesTheRest(t *testing.T) {
	repo := translatortest.NewMemoryRepository()
	mokushi := repo.Seed(translator.Translator{Name: "默示游戏中文化兴趣小组", Aliases: []string{"黙示游戏中文化兴趣小组"}})
	can := repo.Seed(translator.Translator{Name: "Can/need汉化组"})
	service := translator.NewService(repo)

	refs, err := service.Resolve(t.Context(), []string{" Can／Need汉化组 ", "黙示游戏中文化兴趣小组", "默示游戏中文化兴趣小组", "", "破琵琶生产公社汉化组"}, 5)
	if err != nil {
		t.Fatal(err)
	}
	if len(refs) != 3 || refs[0].ID != can.ID || refs[1].ID != mokushi.ID || refs[2].ID == 0 {
		t.Fatalf("refs %+v", refs)
	}
	if !slices.Equal(refNames(refs), []string{"Can/need汉化组", "默示游戏中文化兴趣小组", "破琵琶生产公社汉化组"}) {
		t.Fatalf("stored names are answered: %v", refNames(refs))
	}
	created, err := repo.Get(t.Context(), refs[2].ID)
	if err != nil || created.CreatorID == nil || *created.CreatorID != 5 {
		t.Fatalf("created %+v %v", created, err)
	}
	again, err := service.Resolve(t.Context(), []string{"破琵琶生产公社汉化组"}, 6)
	if err != nil || len(again) != 1 || again[0].ID != refs[2].ID {
		t.Fatalf("a created name is reused: %+v %v", again, err)
	}
	if none, err := service.Resolve(t.Context(), nil, 5); err != nil || len(none) != 0 {
		t.Fatalf("no names %+v %v", none, err)
	}
}

func TestResolveRefusesTooManyOrTooLongNames(t *testing.T) {
	service := translator.NewService(translatortest.NewMemoryRepository())
	many := []string{"一", "二", "三", "四", "五", "六", "七"}
	if _, err := service.Resolve(t.Context(), many, 1); !errors.Is(err, translator.ErrTooMany) {
		t.Fatalf("too many: %v", err)
	}
	if _, err := service.Resolve(t.Context(), []string{strings.Repeat("汉", translator.MaxNameLength+1)}, 1); !errors.Is(err, apperror.ErrValidationFailed) {
		t.Fatalf("too long: %v", err)
	}
	if refs, err := service.Resolve(t.Context(), []string{strings.Repeat("汉", translator.MaxNameLength)}, 1); err != nil || len(refs) != 1 {
		t.Fatalf("the longest allowed name: %+v %v", refs, err)
	}
}
