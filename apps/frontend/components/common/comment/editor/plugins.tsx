import { useState } from 'react'
import { CheckListPlugin } from '@lexical/react/LexicalCheckListPlugin'
import { ClearEditorPlugin } from '@lexical/react/LexicalClearEditorPlugin'
import { ClickableLinkPlugin } from '@lexical/react/LexicalClickableLinkPlugin'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { HashtagPlugin } from '@lexical/react/LexicalHashtagPlugin'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { HorizontalRulePlugin } from '@lexical/react/LexicalHorizontalRulePlugin'
import { ListPlugin } from '@lexical/react/LexicalListPlugin'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { TabIndentationPlugin } from '@lexical/react/LexicalTabIndentationPlugin'
import { ContentEditable } from '@/components/editor/libs/editor-ui/content-editable'
import { ActionsPlugin } from '@/components/editor/libs/plugins/actions/actions-plugin'
import { ClearOnSignalPlugin } from '@/components/editor/libs/plugins/actions/clear-on-signal-plugin'
import { SubmitPlugin } from '@/components/editor/libs/plugins/actions/submit-plugin'
import { CharacterLimitPlugin } from '@/components/editor/libs/plugins/actions/character-limit-plugin'
import { ClearEditorActionPlugin } from '@/components/editor/libs/plugins/actions/clear-editor-plugin'
import { EditModeTogglePlugin } from '@/components/editor/libs/plugins/actions/edit-mode-toggle-plugin'
import { MaxLengthPlugin } from '@/components/editor/libs/plugins/actions/max-length-plugin'
import { AutoLinkPlugin } from '@/components/editor/libs/plugins/auto-link-plugin'
import { CodeActionMenuPlugin } from '@/components/editor/libs/plugins/code-action-menu-plugin'
import { CodeHighlightPlugin } from '@/components/editor/libs/plugins/code-highlight-plugin'
import { ComponentPickerMenuPlugin } from '@/components/editor/libs/plugins/component-picker-menu-plugin'
import { ContextMenuPlugin } from '@/components/editor/libs/plugins/context-menu-plugin'
import { DragDropPastePlugin } from '@/components/editor/libs/plugins/drag-drop-paste-plugin'
import { DraggableBlockPlugin } from '@/components/editor/libs/plugins/draggable-block-plugin'
import { AutoEmbedPlugin } from '@/components/editor/libs/plugins/embeds/auto-embed-plugin'
import { FloatingLinkEditorPlugin } from '@/components/editor/libs/plugins/floating-link-editor-plugin'
import { FloatingTextFormatToolbarPlugin } from '@/components/editor/libs/plugins/floating-text-format-plugin'
import { ImagesPlugin } from '@/components/editor/libs/plugins/images-plugin'
import { KeywordsPlugin } from '@/components/editor/libs/plugins/keywords-plugin'
import { LayoutPlugin } from '@/components/editor/libs/plugins/layout-plugin'
import { LinkPlugin } from '@/components/editor/libs/plugins/link-plugin'
import { ListMaxIndentLevelPlugin } from '@/components/editor/libs/plugins/list-max-indent-level-plugin'
import { AlignmentPickerPlugin } from '@/components/editor/libs/plugins/picker/alignment-picker-plugin'
import { BulletedListPickerPlugin } from '@/components/editor/libs/plugins/picker/bulleted-list-picker-plugin'
import { CheckListPickerPlugin } from '@/components/editor/libs/plugins/picker/check-list-picker-plugin'
import { CodePickerPlugin } from '@/components/editor/libs/plugins/picker/code-picker-plugin'
import { HeadingPickerPlugin } from '@/components/editor/libs/plugins/picker/heading-picker-plugin'
import { NumberedListPickerPlugin } from '@/components/editor/libs/plugins/picker/numbered-list-picker-plugin'
import { ParagraphPickerPlugin } from '@/components/editor/libs/plugins/picker/paragraph-picker-plugin'
import { QuotePickerPlugin } from '@/components/editor/libs/plugins/picker/quote-picker-plugin'
import { TabFocusPlugin } from '@/components/editor/libs/plugins/tab-focus-plugin'
import { BlockFormatDropDown } from '@/components/editor/libs/plugins/toolbar/block-format-toolbar-plugin'
import { FormatBulletedList } from '@/components/editor/libs/plugins/toolbar/block-format/format-bulleted-list'
import { FormatCheckList } from '@/components/editor/libs/plugins/toolbar/block-format/format-check-list'
import { FormatCodeBlock } from '@/components/editor/libs/plugins/toolbar/block-format/format-code-block'
import { FormatHeading } from '@/components/editor/libs/plugins/toolbar/block-format/format-heading'
import { FormatNumberedList } from '@/components/editor/libs/plugins/toolbar/block-format/format-numbered-list'
import { FormatParagraph } from '@/components/editor/libs/plugins/toolbar/block-format/format-paragraph'
import { FormatQuote } from '@/components/editor/libs/plugins/toolbar/block-format/format-quote'
import { ClearFormattingToolbarPlugin } from '@/components/editor/libs/plugins/toolbar/clear-formatting-toolbar-plugin'
import { CodeLanguageToolbarPlugin } from '@/components/editor/libs/plugins/toolbar/code-language-toolbar-plugin'
import { ElementFormatToolbarPlugin } from '@/components/editor/libs/plugins/toolbar/element-format-toolbar-plugin'
import { FontBackgroundToolbarPlugin } from '@/components/editor/libs/plugins/toolbar/font-background-toolbar-plugin'
import { FontColorToolbarPlugin } from '@/components/editor/libs/plugins/toolbar/font-color-toolbar-plugin'
import { FontFormatToolbarPlugin } from '@/components/editor/libs/plugins/toolbar/font-format-toolbar-plugin'
import { FontSizeToolbarPlugin } from '@/components/editor/libs/plugins/toolbar/font-size-toolbar-plugin'
import { HistoryToolbarPlugin } from '@/components/editor/libs/plugins/toolbar/history-toolbar-plugin'
import { LinkToolbarPlugin } from '@/components/editor/libs/plugins/toolbar/link-toolbar-plugin'
import { SubSuperToolbarPlugin } from '@/components/editor/libs/plugins/toolbar/subsuper-toolbar-plugin'
import { ToolbarPlugin } from '@/components/editor/libs/plugins/toolbar/toolbar-plugin'
import { Separator } from '@/components/shionui/Separator'
import { Kbd } from '@/components/shionui/Kbd'
import { useTranslations } from 'next-intl'
import { Plugin } from '@/components/editor/interfaces/plugin'
import { ScrollArea, ScrollBar } from '@/components/shionui/ScrollArea'

const maxLength = 500

interface PluginsProps {
  placeholder?: string
  onSubmit?: () => void
  isSubmitting?: boolean
  isSubmitDisabled?: boolean
  submitLabel?: string | React.ReactNode
  clearSignal?: number
}

export const Plugins: Plugin<PluginsProps> = ({
  placeholder,
  onSubmit,
  submitLabel,
  isSubmitting,
  isSubmitDisabled,
  clearSignal,
}: PluginsProps) => {
  const t = useTranslations('Components.Editor.Plugins')
  const [floatingAnchorElem, setFloatingAnchorElem] = useState<HTMLDivElement | null>(null)
  const [isLinkEditMode, setIsLinkEditMode] = useState<boolean>(false)

  const onRef = (_floatingAnchorElem: HTMLDivElement) => {
    if (_floatingAnchorElem !== null) {
      setFloatingAnchorElem(_floatingAnchorElem)
    }
  }
  const initialPlaceholder = (
    <span className="flex items-center gap-1">
      {t('placeholderPrefix')}
      <Kbd>/</Kbd>
      {t('placeholderSuffix')}
    </span>
  )
  return (
    <div className="relative w-full min-w-0">
      <ToolbarPlugin>
        {({ blockType }) => (
          <ScrollArea
            className="vertical-align-middle sticky top-0 z-10 flex items-center gap-2 border-b "
            scrollbarOrientation="horizontal"
            showScrollbar={false}
          >
            <div className="flex w-max gap-2 py-1 px-1 overflow-visible">
              <HistoryToolbarPlugin />
              <Separator orientation="vertical" className="!h-7" />
              <BlockFormatDropDown>
                <FormatParagraph />
                <FormatHeading levels={['h1', 'h2', 'h3']} />
                <FormatNumberedList />
                <FormatBulletedList />
                <FormatCheckList />
                <FormatCodeBlock />
                <FormatQuote />
              </BlockFormatDropDown>
              {blockType === 'code' ? (
                <CodeLanguageToolbarPlugin />
              ) : (
                <>
                  <FontSizeToolbarPlugin />
                  <Separator orientation="vertical" className="!h-7" />
                  <FontFormatToolbarPlugin format="bold" />
                  <FontFormatToolbarPlugin format="italic" />
                  <FontFormatToolbarPlugin format="underline" />
                  <FontFormatToolbarPlugin format="strikethrough" />
                  <Separator orientation="vertical" className="!h-7" />
                  <SubSuperToolbarPlugin />
                  <LinkToolbarPlugin setIsLinkEditMode={setIsLinkEditMode} />
                  <Separator orientation="vertical" className="!h-7" />
                  <ClearFormattingToolbarPlugin />
                  <Separator orientation="vertical" className="!h-7" />
                  <FontColorToolbarPlugin />
                  <FontBackgroundToolbarPlugin />
                  <Separator orientation="vertical" className="!h-7" />
                  <ElementFormatToolbarPlugin />
                  <Separator orientation="vertical" className="!h-7" />
                </>
              )}
            </div>
          </ScrollArea>
        )}
      </ToolbarPlugin>
      <div className="relative w-full min-w-0">
        <ClearOnSignalPlugin signal={clearSignal} />
        <RichTextPlugin
          contentEditable={
            <div className="w-full min-w-0">
              <div className="w-full min-w-0" ref={onRef}>
                <ContentEditable
                  placeholder={placeholder || initialPlaceholder}
                  className="ContentEditable__root relative block min-h-60 max-h-[80vh] overflow-auto px-8 py-4 text-base focus:outline-none"
                />
              </div>
            </div>
          }
          ErrorBoundary={LexicalErrorBoundary}
        />

        <ClickableLinkPlugin />
        <CheckListPlugin />
        <HorizontalRulePlugin />
        <ListPlugin />
        <TabIndentationPlugin />
        <HashtagPlugin />
        <HistoryPlugin />

        <DraggableBlockPlugin anchorElem={floatingAnchorElem} />
        <KeywordsPlugin />
        <ImagesPlugin captionsEnabled={false} />

        <LayoutPlugin />

        <AutoEmbedPlugin />

        <CodeHighlightPlugin />
        <CodeActionMenuPlugin anchorElem={floatingAnchorElem} />

        <TabFocusPlugin />
        <AutoLinkPlugin />
        <LinkPlugin />

        <ComponentPickerMenuPlugin
          baseOptions={[
            ParagraphPickerPlugin(),
            HeadingPickerPlugin({ n: 1 }),
            HeadingPickerPlugin({ n: 2 }),
            HeadingPickerPlugin({ n: 3 }),
            CheckListPickerPlugin(),
            NumberedListPickerPlugin(),
            BulletedListPickerPlugin(),
            QuotePickerPlugin(),
            CodePickerPlugin(),
            AlignmentPickerPlugin({ alignment: 'left' }),
            AlignmentPickerPlugin({ alignment: 'center' }),
            AlignmentPickerPlugin({ alignment: 'right' }),
            AlignmentPickerPlugin({ alignment: 'justify' }),
          ]}
        />

        <ContextMenuPlugin />
        <DragDropPastePlugin />

        <FloatingLinkEditorPlugin
          anchorElem={floatingAnchorElem}
          isLinkEditMode={isLinkEditMode}
          setIsLinkEditMode={setIsLinkEditMode}
        />
        <FloatingTextFormatToolbarPlugin
          anchorElem={floatingAnchorElem}
          setIsLinkEditMode={setIsLinkEditMode}
        />

        <ListMaxIndentLevelPlugin />
      </div>
      <ActionsPlugin>
        <div className="clear-both flex items-center justify-between gap-2 overflow-auto border-t p-1">
          <div className="flex flex-1 justify-start">
            <MaxLengthPlugin maxLength={maxLength} />
            <CharacterLimitPlugin maxLength={maxLength} charset="UTF-16" />
          </div>
          <div className="flex flex-1 justify-end">
            <EditModeTogglePlugin />
            <>
              <ClearEditorActionPlugin />
              <ClearEditorPlugin />
            </>
            {onSubmit && (
              <SubmitPlugin
                onSubmit={onSubmit}
                label={submitLabel}
                isLoading={isSubmitting}
                disabled={isSubmitDisabled}
              />
            )}
          </div>
        </div>
      </ActionsPlugin>
    </div>
  )
}
