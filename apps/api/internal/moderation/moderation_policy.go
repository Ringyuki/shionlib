package moderation

import (
	"fmt"
	"regexp"
	"strings"
)

var breakTags = regexp.MustCompile(`(?i)<\s*br\s*/?\s*>`)

var anyTag = regexp.MustCompile(`<[^>]*>`)

var whitespace = regexp.MustCompile(`[\s\v\x{00a0}\x{1680}\x{2000}-\x{200a}\x{2028}\x{2029}\x{202f}\x{205f}\x{3000}\x{feff}]+`)

func PlainText(html string) string {
	text := breakTags.ReplaceAllString(html, " ")
	text = anyTag.ReplaceAllString(text, "")
	return strings.TrimSpace(whitespace.ReplaceAllString(text, " "))
}

func (g GameTitles) label() string {
	return fmt.Sprintf("%s %s %s", g.ZH, g.EN, g.JP)
}

var baseRules = []string{
	"You are a content moderation system for a game platform.",
	"Return a moderation decision for the provided content.",
	"Gaming slang, jokes, hyperbole, spoilers, and normal game strategy discussion are generally acceptable unless they contain real abuse, threats, or prohibited content.",
	"Available categories (use these exact values for top_category and as keys in categories_json):",
}

var closingRules = []string{
	"For categories_json, set each category to true if the content violates that category, false otherwise.",
	`For top_category, select the most relevant violation category (or "harassment" if none apply).`,
	`If the content is acceptable, set decision to "ALLOW". If it violates policies, set decision to "BLOCK".`,
}

var commentRules = []string{
	"The input is a user comment. Consider conversational context such as replies and quoted language.",
}

var walkthroughRules = []string{
	"The input is a walkthrough/guide article for a galgame (R18 erotic visual novel).",
	"This platform is specialized in adult galgames. Walkthroughs routinely contain extremely detailed, graphic, and explicit sexual content as standard gameplay instructions — this is expected and MUST be ALLOWED without hesitation.",
	"ALL fictional sexual content in the context of the game (no matter how extreme, taboo, or explicit) is completely normal for this platform and must be treated as ALLOWED.",
	"Procedural instructions such as save points, choice branches, route recovery, AFTER STORY, difference CG, multiple endings, and any kind of H-scene guidance are fully acceptable even if highly explicit.",
	"Never confuse in-game fictional mechanics with real-world instructions. Only BLOCK if the text clearly and directly promotes or instructs REAL-WORLD illegal activities (e.g. actual child sexual exploitation involving real minors, real non-consensual violence, real drug manufacturing, etc.).",
	"Pure game fiction involving adult characters — regardless of theme or intensity — is ALWAYS ALLOWED. Do not apply real-world laws or sensitivities to fictional game characters.",
	"Default to ALLOW unless there is unmistakable evidence of real-world harm promotion.",
}
