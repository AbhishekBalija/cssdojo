import { acceptCompletion, autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { html } from "@codemirror/lang-html";
import { HighlightStyle, bracketMatching, foldEffect, foldGutter, foldKeymap, foldable, indentOnInput, syntaxHighlighting } from "@codemirror/language";
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
  ".cm-foldGutter .cm-gutterElement": { color: "var(--faint)", padding: "0 4px", cursor: "pointer" },
  ".cm-foldPlaceholder": { backgroundColor: "var(--line)", border: "none", color: "var(--sub)", padding: "0 4px", borderRadius: "4px" },
  ".cm-tooltip": { backgroundColor: "var(--panel)", border: "1px solid var(--line-strong)", borderRadius: "8px", overflow: "hidden", boxShadow: "0 12px 32px rgba(0,0,0,.35)" },
  ".cm-tooltip-autocomplete > ul": { fontFamily: "var(--font-mono)", maxHeight: "200px" },
  ".cm-tooltip-autocomplete > ul > li": { padding: "4px 10px", color: "var(--fg)" },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": { backgroundColor: "color-mix(in srgb, var(--accent) 22%, transparent)", color: "var(--fg)" },
  ".cm-completionMatchedText": { textDecoration: "none", color: "var(--accent)" },
  "&.cm-focused": { outline: "none" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection": { backgroundColor: "color-mix(in srgb, var(--accent) 30%, transparent) !important" },
  "&.cm-focused .cm-cursor": { borderLeftColor: "var(--accent)" },
});

/** Folds the markup above the <style> block, so the CSS is what you see first. */
function foldMarkup(v: EditorView): void {
  const doc = v.state.doc;
  if (!/<style[\s>]/.test(doc.toString())) return;
  const first = doc.line(1);
  if (first.text.trimStart().startsWith("<style")) return;
  const range = foldable(v.state, first.from, first.to);
  if (range) v.dispatch({ effects: foldEffect.of(range) });
}

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
          foldGutter({ openText: "▾", closedText: "▸" }),
          html(),
          autocompletion({ icons: false }),
          closeBrackets(),
          syntaxHighlighting(dojoHighlight),
          dojoTheme,
          EditorState.tabSize.of(2),
          EditorView.lineWrapping,
          keymap.of([
            { key: "Mod-Enter", run: () => (submitRef.current?.(), true) },
            { key: "Tab", run: acceptCompletion },
            ...completionKeymap,
            ...closeBracketsKeymap,
            ...foldKeymap,
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
    foldMarkup(v);
    onReady?.({
      focus: () => v.focus(),
      setValue: (next) => {
        v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: next } });
        foldMarkup(v);
      },
    });
    return () => v.destroy();
    // The editor is created once; later value changes come from the editor itself or setValue.
  }, []);

  return <div ref={host} className="cm-host" />;
}
