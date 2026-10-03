package lexical

const (
	classParagraph          = "[&:not(:first-child)]:mt-6"
	classQuote              = "mt-6 border-l-2 pl-6 italic"
	classLink               = "text-blue-600 hover:underline hover:cursor-pointer"
	classHashtag            = "text-blue-600 bg-blue-100 rounded-md px-1"
	classCode               = "EditorTheme__code"
	classTable              = "EditorTheme__table w-fit overflow-scroll border-collapse"
	classTableCell          = `EditorTheme__tableCell w-24 relative border px-4 py-2 text-left [&[align=center]]:text-center [&[align=right]]:text-right"`
	classTableCellHeader    = "EditorTheme__tableCellHeader bg-muted border px-4 py-2 text-left font-bold [&[align=center]]:text-center [&[align=right]]:text-right"
	classListItem           = "mx-8"
	classListItemNested     = "list-none before:hidden after:hidden"
	classCheckList          = "relative"
	classListItemChecked    = `relative mx-2 px-6 list-none outline-none line-through before:content-[""] before:w-4 before:h-4 before:top-0.5 before:mt-0.5 before:left-0 before:cursor-pointer before:block before:bg-cover before:absolute before:border before:border-primary before:rounded before:bg-primary before:bg-no-repeat after:content-[""] after:cursor-pointer after:border-white after:border-solid after:absolute after:block after:top-[6px] after:w-[3px] after:left-[7px] after:right-[7px] after:h-[6px] after:rotate-45 after:border-r-2 after:border-b-2 after:border-l-0 after:border-t-0`
	classListItemUnchecked  = `relative mx-2 px-6 list-none outline-none before:content-[""] before:w-4 before:h-4 before:top-0.5 before:mt-0.5 before:left-0 before:cursor-pointer before:block before:bg-cover before:absolute before:border before:border-primary before:rounded`
	defaultHeaderBackground = "#f2f3f5"
)

var headingClasses = map[string]string{
	"h1": "scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl",
	"h2": "scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0",
	"h3": "scroll-m-20 text-2xl font-semibold tracking-tight",
	"h4": "scroll-m-20 text-xl font-semibold tracking-tight",
	"h5": "scroll-m-20 text-lg font-semibold tracking-tight",
	"h6": "scroll-m-20 text-base font-semibold tracking-tight",
}

var listClasses = map[string]string{
	"ul": "m-0 p-0 list-outside [&>li]:mt-2",
	"ol": "m-0 p-0 list-decimal [&>li]:mt-2",
}

var listDepthClasses = map[string][]string{
	"ol": {
		"list-outside !list-decimal",
		"list-outside !list-[upper-roman]",
		"list-outside !list-[lower-roman]",
		"list-outside !list-[upper-alpha]",
		"list-outside !list-[lower-alpha]",
	},
	"ul": {
		"list-outside !list-disc",
		"list-outside !list-disc",
		"list-outside !list-disc",
		"list-outside !list-disc",
		"list-outside !list-disc",
	},
}

var codeHighlightClasses = map[string]string{
	"atrule":      "EditorTheme__tokenAttr",
	"attr":        "EditorTheme__tokenAttr",
	"boolean":     "EditorTheme__tokenProperty",
	"builtin":     "EditorTheme__tokenSelector",
	"cdata":       "EditorTheme__tokenComment",
	"char":        "EditorTheme__tokenSelector",
	"class":       "EditorTheme__tokenFunction",
	"class-name":  "EditorTheme__tokenFunction",
	"comment":     "EditorTheme__tokenComment",
	"constant":    "EditorTheme__tokenProperty",
	"deleted":     "EditorTheme__tokenProperty",
	"doctype":     "EditorTheme__tokenComment",
	"entity":      "EditorTheme__tokenOperator",
	"function":    "EditorTheme__tokenFunction",
	"important":   "EditorTheme__tokenVariable",
	"inserted":    "EditorTheme__tokenSelector",
	"keyword":     "EditorTheme__tokenAttr",
	"namespace":   "EditorTheme__tokenVariable",
	"number":      "EditorTheme__tokenProperty",
	"operator":    "EditorTheme__tokenOperator",
	"prolog":      "EditorTheme__tokenComment",
	"property":    "EditorTheme__tokenProperty",
	"punctuation": "EditorTheme__tokenPunctuation",
	"regex":       "EditorTheme__tokenVariable",
	"selector":    "EditorTheme__tokenSelector",
	"string":      "EditorTheme__tokenSelector",
	"symbol":      "EditorTheme__tokenProperty",
	"tag":         "EditorTheme__tokenProperty",
	"url":         "EditorTheme__tokenOperator",
	"variable":    "EditorTheme__tokenVariable",
}

const (
	formatBold          = 1
	formatItalic        = 1 << 1
	formatStrikethrough = 1 << 2
	formatUnderline     = 1 << 3
	formatCode          = 1 << 4
	formatSubscript     = 1 << 5
	formatSuperscript   = 1 << 6
	formatHighlight     = 1 << 7
)

type formatClass struct {
	flag  int
	class string
}

var textFormatClasses = []formatClass{
	{flag: formatBold, class: "font-bold"},
	{flag: formatCode, class: "bg-card-hover p-1 rounded-md"},
	{flag: formatItalic, class: "italic"},
	{flag: formatStrikethrough, class: "line-through"},
	{flag: formatSubscript, class: "sub"},
	{flag: formatSuperscript, class: "sup"},
	{flag: formatUnderline, class: "underline"},
}

const classUnderlineStrikethrough = "underline line-through"
