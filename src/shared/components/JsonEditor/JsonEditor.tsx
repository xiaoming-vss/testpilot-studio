import CodeMirror from '@uiw/react-codemirror'
import { indentWithTab } from '@codemirror/commands'
import { json, jsonParseLinter } from '@codemirror/lang-json'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { linter } from '@codemirror/lint'
import { EditorView, keymap } from '@codemirror/view'
import { tags } from '@lezer/highlight'
import { forwardRef, useImperativeHandle, useMemo, useRef, type ReactNode } from 'react'
import { useThemeStore } from '@/shared/store/theme.store'

const jsonEditorLightTheme = EditorView.theme({
  '&': {
    color: '#1f2937',
    backgroundColor: '#ffffff',
    fontFamily: "Consolas, 'Cascadia Mono', 'Courier New', monospace",
  },
  '.cm-content': {
    caretColor: '#111827',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: '#111827',
  },
  '.cm-selectionBackground, ::selection': {
    backgroundColor: 'rgba(96, 165, 250, 0.24)',
  },
  '.cm-panels': {
    backgroundColor: '#ffffff',
    color: '#1f2937',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(15, 23, 42, 0.02)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: '#ffffff',
  },
  '.cm-gutters': {
    backgroundColor: '#ffffff',
    color: '#94a3b8',
    borderRight: '1px solid #eef2f7',
  },
}, { dark: false })

const jsonEditorDarkTheme = EditorView.theme({
  '&': {
    color: '#e5edf9',
    backgroundColor: '#1f2431',
    fontFamily: "Consolas, 'Cascadia Mono', 'Courier New', monospace",
  },
  '.cm-content': {
    caretColor: '#dbeafe',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: '#dbeafe',
    borderLeftWidth: '2px',
  },
  '.cm-selectionBackground, ::selection': {
    backgroundColor: 'rgba(96, 165, 250, 0.28)',
  },
  '.cm-panels': {
    backgroundColor: '#1f2431',
    color: '#e5edf9',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(148, 163, 184, 0.06)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: '#1f2431',
  },
  '.cm-gutters': {
    backgroundColor: '#1f2431',
    color: '#71839e',
    borderRight: '1px solid rgba(148, 163, 184, 0.16)',
  },
}, { dark: true })

const jsonEditorLightHighlightStyle = HighlightStyle.define([
  { tag: tags.propertyName, color: '#d97706', fontWeight: '500', fontStyle: 'normal' },
  { tag: tags.string, color: '#16a34a', fontWeight: '500', fontStyle: 'normal' },
  { tag: tags.number, color: '#d19a66', fontStyle: 'normal' },
  { tag: tags.bool, color: '#56b6c2', fontStyle: 'normal' },
  { tag: tags.null, color: '#c678dd', fontStyle: 'normal' },
  { tag: [tags.separator, tags.brace, tags.squareBracket, tags.punctuation], color: '#334155', fontWeight: '600', fontStyle: 'normal' },
])

const jsonEditorDarkHighlightStyle = HighlightStyle.define([
  { tag: tags.propertyName, color: '#f59e0b', fontWeight: '600', fontStyle: 'normal' },
  { tag: tags.string, color: '#4ade80', fontWeight: '500', fontStyle: 'normal' },
  { tag: tags.number, color: '#f7b267', fontStyle: 'normal' },
  { tag: tags.bool, color: '#67e8f9', fontStyle: 'normal' },
  { tag: tags.null, color: '#d8b4fe', fontStyle: 'normal' },
  { tag: [tags.separator, tags.brace, tags.squareBracket, tags.punctuation], color: '#9fb7d6', fontWeight: '700', fontStyle: 'normal' },
])

function tryFormatJson(value?: string) {
  if (!value?.trim()) {
    return { valid: true as const, formatted: '', errorMessage: '' }
  }

  try {
    const parsed = JSON.parse(value)
    return {
      valid: true as const,
      formatted: JSON.stringify(parsed, null, 2),
      errorMessage: '',
    }
  } catch (error) {
    return {
      valid: false as const,
      formatted: value,
      errorMessage: error instanceof Error ? error.message : 'JSON 格式不正确',
    }
  }
}

export type JsonEditorRef = {
  focus: () => void
  insertText: (text: string) => void
  formatDocument: () => void
}

type JsonEditorProps = {
  value?: string
  onChange?: (value: string) => void
  minHeight?: number
  toolbar?: ReactNode
  readOnly?: boolean
  foldable?: boolean
}

export const JsonEditor = forwardRef<JsonEditorRef, JsonEditorProps>(({
  value,
  onChange,
  minHeight = 260,
  toolbar,
  readOnly = false,
  foldable = false,
}, ref) => {
  const jsonState = useMemo(() => tryFormatJson(value), [value])
  const themeMode = useThemeStore((state) => state.mode)
  const editorViewRef = useRef<EditorView | null>(null)
  const editorTheme = themeMode === 'dark' ? jsonEditorDarkTheme : jsonEditorLightTheme
  const editorHighlightStyle = themeMode === 'dark' ? jsonEditorDarkHighlightStyle : jsonEditorLightHighlightStyle

  useImperativeHandle(ref, () => ({
    focus() {
      editorViewRef.current?.focus()
    },
    insertText(text: string) {
      const view = editorViewRef.current
      if (!view) return

      const selection = view.state.selection.main
      const anchor = selection.from + text.length
      view.dispatch({
        changes: {
          from: selection.from,
          to: selection.to,
          insert: text,
        },
        selection: { anchor, head: anchor },
      })
      view.focus()
    },
    formatDocument() {
      if (readOnly) return
      if (!jsonState.valid || !value?.trim()) return
      if (jsonState.formatted !== value) {
        onChange?.(jsonState.formatted)
      }
      editorViewRef.current?.focus()
    },
  }), [jsonState.formatted, jsonState.valid, onChange, readOnly, value])

  function handleBlur() {
    if (readOnly) return
    if (!jsonState.valid || !value?.trim()) return
    if (jsonState.formatted !== value) {
      onChange?.(jsonState.formatted)
    }
  }

  return (
    <div className={`json-editor-wrap${foldable ? ' foldable' : ''}${readOnly ? ' readonly' : ''}`}>
      <div className={`json-editor-shell${jsonState.valid ? '' : ' invalid'}`}>
        {toolbar ? <div className="json-editor-toolbar">{toolbar}</div> : null}
        <CodeMirror
          value={value ?? ''}
          minHeight={`${minHeight}px`}
          editable={!readOnly}
          readOnly={readOnly}
          basicSetup={{
            foldGutter: foldable,
            highlightActiveLine: false,
            highlightActiveLineGutter: false,
          }}
          extensions={[
            json(),
            linter(jsonParseLinter()),
            keymap.of([indentWithTab]),
            EditorView.lineWrapping,
            editorTheme,
            syntaxHighlighting(editorHighlightStyle),
          ]}
          className="json-editor-codemirror"
          onCreateEditor={(view) => {
            editorViewRef.current = view
          }}
          onChange={(nextValue) => {
            if (!readOnly) onChange?.(nextValue)
          }}
          onBlur={handleBlur}
        />
      </div>
    </div>
  )
})

JsonEditor.displayName = 'JsonEditor'
