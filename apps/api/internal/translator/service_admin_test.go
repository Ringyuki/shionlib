package translator_test

import (
	"errors"
	"slices"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/apperror"
	"github.com/Ringyuki/shionlib/apps/api/internal/patch"
	"github.com/Ringyuki/shionlib/apps/api/internal/translator"
	"github.com/Ringyuki/shionlib/apps/api/internal/translator/translatortest"
	"github.com/Ringyuki/shionlib/apps/api/internal/txtest"
)

func ptr[T any](v T) *T {
	return &v
}

func newAdmin() (*translator.AdminService, *translatortest.MemoryRepository) {
	service, repo, _ := followedAdmin()
	return service, repo
}

func followedAdmin() (*translator.AdminService, *translatortest.MemoryRepository, *translatortest.Followers) {
	repo := translatortest.NewMemoryRepository()
	followers := &translatortest.Followers{}
	return translator.NewAdminService(repo, repo, followers, &txtest.Immediate{}), repo, followers
}

func TestAdminSearchTrimsTheQuery(t *testing.T) {
	service, repo := newAdmin()
	repo.Seed(translator.Translator{Name: "绿茶汉化组"})
	repo.Seed(translator.Translator{Name: "脸肿汉化组"})
	entries, total, err := service.Search(t.Context(), translator.AdminFilter{Search: " 绿茶 ", SortBy: translator.SortByName}, translator.Page{Number: 1, Size: 10})
	if err != nil || total != 1 || entries[0].Name != "绿茶汉化组" {
		t.Fatalf("search %+v %d %v", entries, total, err)
	}
}

func TestEditCleansNamesAliasesAndHomepage(t *testing.T) {
	service, repo := newAdmin()
	tea := repo.Seed(translator.Translator{Name: "绿茶汉化组", Aliases: []string{"Green Tea"}})
	aliases := []string{" 绿茶  汉化 ", "绿茶汉化", "綠茶漢化組", "绿茶汉化小组", ""}
	err := service.Edit(t.Context(), tea.ID, translator.Changes{Name: ptr("  绿茶汉化小组 "), Aliases: &aliases, Homepage: patch.Clearable[string]{Set: true, Value: ptr(" https://tea.example ")}})
	if err != nil {
		t.Fatal(err)
	}
	stored, _ := repo.Get(t.Context(), tea.ID)
	if stored.Name != "绿茶汉化小组" || !slices.Equal(stored.Aliases, []string{"绿茶 汉化", "绿茶汉化", "綠茶漢化組"}) || stored.Homepage == nil || *stored.Homepage != "https://tea.example" {
		t.Fatalf("stored %+v", stored)
	}
	if err := service.Edit(t.Context(), tea.ID, translator.Changes{Homepage: patch.Clearable[string]{Set: true, Value: ptr("  ")}}); err != nil {
		t.Fatal(err)
	}
	if stored, _ = repo.Get(t.Context(), tea.ID); stored.Homepage != nil || stored.Name != "绿茶汉化小组" || len(stored.Aliases) != 3 {
		t.Fatalf("a blank homepage clears it and nothing else changes: %+v", stored)
	}
	if err := service.Edit(t.Context(), tea.ID, translator.Changes{Name: ptr("绿茶 汉化")}); err != nil {
		t.Fatal(err)
	}
	if stored, _ = repo.Get(t.Context(), tea.ID); stored.Name != "绿茶 汉化" || slices.Contains(stored.Aliases, "绿茶 汉化") {
		t.Fatalf("the new name leaves the aliases: %+v", stored)
	}
}

func TestEditRefusesInvalidAndTakenNames(t *testing.T) {
	service, repo := newAdmin()
	tea := repo.Seed(translator.Translator{Name: "绿茶汉化组"})
	repo.Seed(translator.Translator{Name: "脸肿汉化组", Aliases: []string{"脸肿"}})
	if err := service.Edit(t.Context(), tea.ID, translator.Changes{Name: ptr("   ")}); !errors.Is(err, apperror.ErrValidationFailed) {
		t.Fatalf("empty name: %v", err)
	}
	if err := service.Edit(t.Context(), tea.ID, translator.Changes{Name: ptr("脸肿汉化组")}); !errors.Is(err, translator.ErrNameTaken) {
		t.Fatalf("taken name: %v", err)
	}
	taken := []string{"脸肿"}
	if err := service.Edit(t.Context(), tea.ID, translator.Changes{Aliases: &taken}); !errors.Is(err, translator.ErrNameTaken) {
		t.Fatalf("an alias that names another translator: %v", err)
	}
	if err := service.Edit(t.Context(), 99, translator.Changes{Name: ptr("x")}); !errors.Is(err, translator.ErrNotFound) {
		t.Fatalf("missing: %v", err)
	}
}

func TestMergeMovesCreditsAndKeepsTheNamesAsAliases(t *testing.T) {
	service, repo := newAdmin()
	kept := repo.Seed(translator.Translator{Name: "Can/need汉化组", Aliases: []string{"CN"}})
	upper := repo.Seed(translator.Translator{Name: "Can/Need汉化组"})
	short := repo.Seed(translator.Translator{Name: "Can/need", Aliases: []string{"罐头"}})
	shared := repo.Credit(1, true, day, kept.ID, short.ID)
	moved := repo.Credit(2, true, day.Add(time.Hour), upper.ID)

	if err := service.Merge(t.Context(), kept.ID, []int{upper.ID, short.ID, kept.ID, upper.ID}); err != nil {
		t.Fatal(err)
	}
	stored, _ := repo.Get(t.Context(), kept.ID)
	if !slices.Equal(stored.Aliases, []string{"CN", "Can/need", "罐头"}) {
		t.Fatalf("aliases %v", stored.Aliases)
	}
	if _, err := repo.Get(t.Context(), upper.ID); !errors.Is(err, translator.ErrNotFound) {
		t.Fatalf("merged translators are removed: %v", err)
	}
	if !slices.Equal(repo.Credited(shared), []int{kept.ID}) || !slices.Equal(repo.Credited(moved), []int{kept.ID}) {
		t.Fatalf("credits %v %v", repo.Credited(shared), repo.Credited(moved))
	}
	if err := service.Merge(t.Context(), kept.ID, []int{kept.ID}); !errors.Is(err, translator.ErrMergeNeedsOthers) {
		t.Fatalf("merging into itself: %v", err)
	}
	if err := service.Merge(t.Context(), kept.ID, []int{99}); !errors.Is(err, translator.ErrNotFound) {
		t.Fatalf("missing: %v", err)
	}
}

func TestDuplicatesGroupNamesThatDifferInWritingUntilDismissed(t *testing.T) {
	service, repo := newAdmin()
	mokushi := repo.Seed(translator.Translator{Name: "默示游戏中文化兴趣小组"})
	variant := repo.Seed(translator.Translator{Name: "黙示游戏中文化兴趣小组"})
	pipa := repo.Seed(translator.Translator{Name: "破琵琶生产公社"})
	pipaGroup := repo.Seed(translator.Translator{Name: "破琵琶生产公社汉化组"})
	repo.Seed(translator.Translator{Name: "绿茶汉化组"})
	repo.Credit(1, true, day, variant.ID)
	repo.Credit(2, true, day, pipaGroup.ID)
	repo.Credit(3, true, day, pipaGroup.ID)

	found, err := service.Duplicates(t.Context())
	if err != nil || len(found) != 2 {
		t.Fatalf("clusters %+v %v", found, err)
	}
	if found[0][0].ID != pipaGroup.ID || found[0][1].ID != pipa.ID || found[1][0].ID != variant.ID || found[1][1].ID != mokushi.ID {
		t.Fatalf("clusters come with the most credited first: %+v", found)
	}
	if err := service.Dismiss(t.Context(), []int{pipa.ID, pipaGroup.ID, pipa.ID}); err != nil {
		t.Fatal(err)
	}
	if found, err = service.Duplicates(t.Context()); err != nil || len(found) != 1 || found[0][0].ID != variant.ID {
		t.Fatalf("a dismissed cluster is not shown again: %+v %v", found, err)
	}
	if err := service.Dismiss(t.Context(), []int{pipa.ID}); !errors.Is(err, translator.ErrMergeNeedsOthers) {
		t.Fatalf("dismissing one translator: %v", err)
	}
}

func TestANewNameAndAMergeAreToldToTheFollowers(t *testing.T) {
	service, repo, followers := followedAdmin()
	tea := repo.Seed(translator.Translator{Name: "绿茶汉化组"})
	other := repo.Seed(translator.Translator{Name: "绿茶汉化"})
	if err := service.Edit(t.Context(), tea.ID, translator.Changes{Aliases: &[]string{"Green Tea"}}); err != nil || len(followers.Changed) != 0 {
		t.Fatalf("an edit that keeps the name tells nobody: %v %v", followers.Changed, err)
	}
	if err := service.Edit(t.Context(), tea.ID, translator.Changes{Name: ptr("绿茶汉化组 ")}); err != nil || len(followers.Changed) != 0 {
		t.Fatalf("the same name tells nobody: %v %v", followers.Changed, err)
	}
	if err := service.Edit(t.Context(), tea.ID, translator.Changes{Name: ptr("绿茶组")}); err != nil || !slices.Equal(followers.Changed, []int{tea.ID}) {
		t.Fatalf("a new name: %v %v", followers.Changed, err)
	}
	if err := service.Edit(t.Context(), other.ID, translator.Changes{Name: ptr("绿茶组")}); !errors.Is(err, translator.ErrNameTaken) || len(followers.Changed) != 1 {
		t.Fatalf("a refused edit tells nobody: %v %v", followers.Changed, err)
	}
	if err := service.Merge(t.Context(), tea.ID, []int{other.ID}); err != nil || !slices.Equal(followers.Changed, []int{tea.ID, tea.ID}) {
		t.Fatalf("a merge: %v %v", followers.Changed, err)
	}
}
