import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { html } from "@codemirror/lang-html";
import { HighlightStyle, bracketMatching, indentOnInput, syntaxHighlighting } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { EditorView, drawSelection, highlightActiveLine, keymap, lineNumbers } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";
import { useEffect, useRef } from "react";

// CodeMirror 6 with colours from the design tokens (so it follows the theme).

const dojoHighlight = HighlightStyle.define([
  { tag: [t.tagName, t.angleBracket], color: "var(--code-tag)" },
  { tag: [t.attributeName], color: "var(--code-property)" },
  { tag: [t.attributeValue, t.string], color: "var(--code-value)" },
  { tag: [t.className, t.labelName, t.propertyName], color: "var(--code-property)" },
  { tag: [t.number, t.unit, t.color, t.keyword, t.atom], color: "var(--code-value)" },
  { tag: [t.comment], color: "var(--code-comment)", fontStyle: "italic" },
]);

const dojoTheme = EditorView.theme({
  "&": { color: "var(--fg)", backgroundColor: "transparent", height: "100%", fontSize: "var(--editor-fs, 12.5px)" },
  ".cm-content": { caretColor: "var(--accent)", padding: "14px 0" },
  ".cm-gutters": { backgroundColor: "transparent", color: "var(--faint)", border: "none" },
  ".cm-activeLine": { backgroundColor: "var(--hover)" },
  ".cm-activeLineGutter": { backgroundColor: "transparent", color: "var(--sub)" },
  "&.cm-focused": { outline: "none" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection": { backgroundColor: "color-mix(in srgb, var(--accent) 30%, transparent) !important" },
  "&.cm-focused .cm-cursor": { borderLeftColor: "var(--accent)" },
});

export interface CodeEditorHandle {
  focus(): void;
  setValue(v: string): void;
}

export function CodeEditor({ value, onChange, onReady, onSubmit }: { value: string; onChange: (v: string) => void; onReady?: (h: CodeEditorHandle) => void; onSubmit?: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const changeRef = useRef(onChange);
  const submitRef = useRef(onSubmit);
  changeRef.current = onChange;
  submitRef.current = onSubmit;

  useEffect(() => {
    if (!host.current) return;
    const v = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          history(),
          drawSelection(),
          indentOnInput(),
          bracketMatching(),
          highlightActiveLine(),
          html(),
          syntaxHighlighting(dojoHighlight),
          dojoTheme,
          EditorState.tabSize.of(2),
          keymap.of([
            { key: "Mod-Enter", run: () => (submitRef.current?.(), true) },
            indentWithTab,
            ...defaultKeymap,
            ...historyKeymap,
          ]),
          EditorView.contentAttributes.of({ "aria-label": "Your HTML and CSS" }),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) changeRef.current(u.state.doc.toString());
          }),
        ],
      }),
    });
    view.current = v;
    onReady?.({
      focus: () => v.focus(),
      setValue: (next) => v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: next } }),
    });
    return () => v.destroy();
    // The editor is created once; later value changes come from the editor itself or setValue.
  }, []);

  return <div ref={host} className="cm-host" />;
}
