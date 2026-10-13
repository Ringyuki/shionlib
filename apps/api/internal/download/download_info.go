package download

import (
	"slices"
	"strings"
	"unicode/utf8"

	"github.com/Ringyuki/shionlib/apps/api/internal/apperror"
	"github.com/Ringyuki/shionlib/apps/api/internal/translator"
)

type Translation string

const (
	TranslationNone     Translation = "none"
	TranslationOfficial Translation = "official"
	TranslationGroup    Translation = "group"
	TranslationMachine  Translation = "machine"
)

type Edition string

const (
	EditionDownload Edition = "download"
	EditionPackage  Edition = "package"
	EditionSteam    Edition = "steam"
)

type Form string

const (
	FormDisc      Form = "disc"
	FormInstaller Form = "installer"
	FormPortable  Form = "portable"
)

const (
	ExtraSave  = "save"
	ExtraBonus = "bonus"
)

const (
	OriginalLanguage      = "jp"
	MaxPatchVersionLength = 32
	MaxReleaseURLLength   = 512
	MaxEditionNameLength  = 64
)

var Translations = []Translation{TranslationNone, TranslationOfficial, TranslationGroup, TranslationMachine}

var Editions = []Edition{EditionDownload, EditionPackage, EditionSteam}

var Forms = []Form{FormDisc, FormInstaller, FormPortable}

var Extras = []string{ExtraSave, ExtraBonus}

type Info struct {
	Translation  *Translation
	Translators  []translator.Ref
	PatchVersion *string
	ReleaseURL   *string
	Edition      *Edition
	EditionName  *string
	Form         *Form
	Extras       []string
}

type InfoInput struct {
	Translation  *Translation
	Translators  []string
	PatchVersion *string
	ReleaseURL   *string
	Edition      *Edition
	EditionName  *string
	Form         *Form
	Extras       []string
}

func Translated(languages []string) bool {
	return slices.ContainsFunc(languages, func(language string) bool { return language != OriginalLanguage })
}

func (in InfoInput) settled(languages []string, complete bool) (InfoInput, error) {
	out := InfoInput{Edition: in.Edition, Form: in.Form, EditionName: trimmed(in.EditionName), Extras: knownExtras(in.Extras)}
	if out.Edition != nil && !slices.Contains(Editions, *out.Edition) {
		return InfoInput{}, invalid("edition", "unknown edition")
	}
	if out.Form != nil && !slices.Contains(Forms, *out.Form) {
		return InfoInput{}, invalid("form", "unknown form")
	}
	if out.Form == nil && complete {
		return InfoInput{}, invalid("form", "the form is required")
	}
	if out.EditionName != nil && utf8.RuneCountInString(*out.EditionName) > MaxEditionNameLength {
		return InfoInput{}, invalid("edition_name", "the edition name is too long")
	}
	if !Translated(languages) {
		none := TranslationNone
		out.Translation = &none
		return out, nil
	}
	if in.Translation == nil {
		if complete {
			return InfoInput{}, invalid("translation", "the translation is required")
		}
		return out, nil
	}
	if !slices.Contains(Translations, *in.Translation) {
		return InfoInput{}, invalid("translation", "unknown translation")
	}
	out.Translation = in.Translation
	if *in.Translation == TranslationGroup {
		out.Translators = named(in.Translators)
		if len(out.Translators) == 0 {
			return InfoInput{}, invalid("translators", "at least one translator is required")
		}
	}
	if *in.Translation == TranslationGroup || *in.Translation == TranslationMachine {
		out.PatchVersion = trimmed(in.PatchVersion)
		out.ReleaseURL = trimmed(in.ReleaseURL)
	}
	if out.PatchVersion != nil && utf8.RuneCountInString(*out.PatchVersion) > MaxPatchVersionLength {
		return InfoInput{}, invalid("patch_version", "the patch version is too long")
	}
	if out.ReleaseURL != nil && (utf8.RuneCountInString(*out.ReleaseURL) > MaxReleaseURLLength || !webAddress(*out.ReleaseURL)) {
		return InfoInput{}, invalid("release_url", "the release page must be an http or https address")
	}
	return out, nil
}

func (in InfoInput) with(translators []translator.Ref) Info {
	return Info{
		Translation: in.Translation, Translators: translators, PatchVersion: in.PatchVersion, ReleaseURL: in.ReleaseURL,
		Edition: in.Edition, EditionName: in.EditionName, Form: in.Form, Extras: in.Extras,
	}
}

func invalid(field, message string) error {
	return apperror.ErrValidationFailed.WithField(field, message)
}

func trimmed(value *string) *string {
	if value == nil {
		return nil
	}
	text := strings.TrimSpace(*value)
	if text == "" {
		return nil
	}
	return &text
}

func named(names []string) []string {
	out := make([]string, 0, len(names))
	for _, name := range names {
		if strings.TrimSpace(name) != "" {
			out = append(out, name)
		}
	}
	return out
}

func knownExtras(extras []string) []string {
	out := make([]string, 0, len(extras))
	for _, known := range Extras {
		if slices.Contains(extras, known) {
			out = append(out, known)
		}
	}
	return out
}

func webAddress(address string) bool {
	rest, secure := strings.CutPrefix(address, "https://")
	if !secure {
		var plain bool
		if rest, plain = strings.CutPrefix(address, "http://"); !plain {
			return false
		}
	}
	return rest != "" && !strings.ContainsAny(address, " \t\r\n")
}
