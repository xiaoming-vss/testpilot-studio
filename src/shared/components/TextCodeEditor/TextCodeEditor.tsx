import CodeMirror from '@uiw/react-codemirror'
import { indentWithTab } from '@codemirror/commands'
import { EditorView, keymap } from '@codemirror/view'
import { useMemo } from 'react'
import { useThemeStore } from '@/shared/store/theme.store'

const textEditorLightTheme = EditorView.theme({
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

const textEditorDarkTheme = EditorView.theme({
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

type TextCodeEditorProps = {
  value?: string
  onChange?: (value: string) => void
  height?: number
  minHeight?: number
  readOnly?: boolean
  ariaLabel?: string
}

export function TextCodeEditor({
  value,
  onChange,
  height,
  minHeight = 260,
  readOnly = false,
  ariaLabel,
}: TextCodeEditorProps) {
  const themeMode = useThemeStore((state) => state.mode)
  const editorTheme = useMemo(
    () => (themeMode === 'dark' ? textEditorDarkTheme : textEditorLightTheme),
    [themeMode],
  )

  return (
    <div className="json-editor-wrap">
      <div className="json-editor-shell">
        <CodeMirror
          value={value ?? ''}
          height={height ? `${height}px` : undefined}
          minHeight={`${minHeight}px`}
          basicSetup={{
            foldGutter: false,
            highlightActiveLine: false,
            highlightActiveLineGutter: false,
          }}
          extensions={[
            keymap.of([indentWithTab]),
            EditorView.lineWrapping,
            editorTheme,
            EditorView.contentAttributes.of({
              ...(ariaLabel ? { 'aria-label': ariaLabel } : {}),
              'aria-readonly': String(readOnly),
            }),
          ]}
          className="json-editor-codemirror"
          editable={!readOnly}
          readOnly={readOnly}
          onChange={(nextValue) => onChange?.(nextValue)}
        />
      </div>
    </div>
  )
}
