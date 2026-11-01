import { forwardRef, useImperativeHandle, useRef, useEffect } from "react";
import { EditorState, StateField, Compartment, type Text } from "@codemirror/state";
import {
  EditorView,
  keymap,
  type DecorationSet,
} from "@codemirror/view";
import { history, historyKeymap, defaultKeymap } from "@codemirror/commands";
import { buildDecorations, HEADING_RE } from "../utils/promptDecorations";

const EDITOR_PX = 20;

export type PromptCodeEditorHandle = {
  insertAtCaret: (token: string) => void;
  scrollToLine: (lineIndex: number) => void;
  focus: () => void;
  getValue: () => string;
  getScrollDOM: () => HTMLElement | null;
};

type Props = {
  initialValue: string;
  fontSize: number;
  onChange: (value: string) => void;
  onScroll?: () => void;
  onActiveHeadingsChange?: (activeH1Line: number, activeH2Line: number) => void;
};

/* StateField-based decorations — height-affecting decorations (h1/h2/h3 change
   font-size) must come from a StateField, never a ViewPlugin. Viewport-scoped
   height decorations desync CM6's height map, causing click drift and crashes. */
const decorationField = StateField.define<DecorationSet>({
  create(state) { return buildDecorations(state); },
  update(deco, tr) {
    if (!tr.docChanged) return deco;
    return buildDecorations(tr.state);
  },
  provide: (f) => EditorView.decorations.from(f),
});

/* Theme builder — lives in a Compartment so fontSize changes reconfigure live. */
function buildTheme(fontSize: number) {
  return EditorView.theme({
    "&": {
      fontSize: `${fontSize}px`,
      background: "transparent",
      height: "100%",
    },
    ".cm-content": {
      fontFamily: "var(--mono)",
      lineHeight: "1.7",
      color: "var(--ink)",
      caretColor: "var(--wine)",
      padding: `${EDITOR_PX}px`,
    },
    ".cm-scroller": {
      fontFamily: "var(--mono)",
      lineHeight: "1.7",
      overflow: "auto",
    },
    "&.cm-focused": { outline: "none" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--wine)" },
    ".cm-var": {
      background: "var(--wine-tint)",
      color: "var(--wine)",
      borderRadius: "2px",
    },
    ".cm-cond": {
      color: "var(--wine)",
      fontWeight: "700",
      opacity: "0.7",
    },
    ".cm-h1": { fontWeight: "700", letterSpacing: "0.02em" },
    ".cm-h2": { fontWeight: "700" },
    ".cm-h3": { fontWeight: "600" },
  });
}

export const PromptCodeEditor = forwardRef<PromptCodeEditorHandle, Props>(
  function PromptCodeEditor(
    { initialValue, fontSize, onChange, onScroll, onActiveHeadingsChange },
    ref,
  ) {
    const hostRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const themeCompartment = useRef(new Compartment());
    const rafRef = useRef<number>(0);

    // Keep latest callbacks without re-creating the editor.
    const onChangeRef = useRef(onChange);
    const onScrollRef = useRef(onScroll);
    const onActiveRef = useRef(onActiveHeadingsChange);
    onChangeRef.current = onChange;
    onScrollRef.current = onScroll;
    onActiveRef.current = onActiveHeadingsChange;

    /* The `#` / `##` lines, read once per document change instead of on every
       scroll frame: scrolling only measures these few lines. */
    const headingLinesRef = useRef<{ lineNo: number; level: number }[]>([]);
    function readHeadingLines(doc: Text) {
      const out: { lineNo: number; level: number }[] = [];
      for (let i = 1; i <= doc.lines; i++) {
        const m = doc.line(i).text.match(HEADING_RE);
        if (m && m[1]!.length <= 2) out.push({ lineNo: i, level: m[1]!.length });
      }
      headingLinesRef.current = out;
    }

    /* Find the topmost-visible `#` and the topmost-visible `##` inside it. */
    function emitActiveHeadings(view: EditorView) {
      const cb = onActiveRef.current;
      if (!cb) return;
      const top = view.scrollDOM.scrollTop;
      let activeH1 = -1;
      let activeH2 = -1;
      for (const { lineNo, level } of headingLinesRef.current) {
        const blockTop = view.lineBlockAt(view.state.doc.line(lineNo).from).top;
        if (blockTop > top + 1) break;
        if (level === 1) {
          activeH1 = lineNo - 1;
          activeH2 = -1; // reset deeper heading when entering a new H1
        } else {
          activeH2 = lineNo - 1;
        }
      }
      cb(activeH1, activeH2);
    }

    function scheduleActive(view: EditorView) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => emitActiveHeadings(view));
    }

    useEffect(() => {
      if (!hostRef.current) return;

      const updateListener = EditorView.updateListener.of((u) => {
        if (u.docChanged) {
          readHeadingLines(u.state.doc);
          onChangeRef.current(u.state.doc.toString());
        }
        if (u.geometryChanged || u.viewportChanged) scheduleActive(u.view);
      });

      const state = EditorState.create({
        doc: initialValue,
        extensions: [
          EditorView.lineWrapping,
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          decorationField,
          updateListener,
          EditorView.domEventHandlers({
            scroll: (_e, view) => {
              onScrollRef.current?.();
              scheduleActive(view);
            },
          }),
          themeCompartment.current.of(buildTheme(fontSize)),
        ],
      });

      const view = new EditorView({ state, parent: hostRef.current });
      viewRef.current = view;
      readHeadingLines(state.doc);
      requestAnimationFrame(() => emitActiveHeadings(view));

      return () => {
        cancelAnimationFrame(rafRef.current);
        view.destroy();
        viewRef.current = null;
      };
      // Editor is created once; value/callbacks are synced via refs and effects.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Reconfigure theme live when fontSize changes.
    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      view.dispatch({
        effects: themeCompartment.current.reconfigure(buildTheme(fontSize)),
      });
    }, [fontSize]);

    // Replace document when the prompt being edited changes externally.
    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      const current = view.state.doc.toString();
      if (current === initialValue) return;
      view.dispatch({
        changes: { from: 0, to: current.length, insert: initialValue },
      });
    }, [initialValue]);

    useImperativeHandle(ref, () => ({
      insertAtCaret(token: string) {
        const view = viewRef.current;
        if (!view) return;
        view.dispatch(view.state.replaceSelection(token));
        view.focus();
      },
      scrollToLine(lineIndex: number) {
        const view = viewRef.current;
        if (!view) return;
        const lineNo = Math.min(Math.max(lineIndex + 1, 1), view.state.doc.lines);
        const pos = view.state.doc.line(lineNo).from;
        view.dispatch({
          effects: EditorView.scrollIntoView(pos, { y: "start", yMargin: 8 }),
        });
      },
      focus() {
        viewRef.current?.focus();
      },
      getValue() {
        return viewRef.current?.state.doc.toString() ?? "";
      },
      getScrollDOM() {
        return viewRef.current?.scrollDOM ?? null;
      },
    }));

    // Dragged variable chips carry their token as `text/plain`, which CM6 inserts
    // natively at the drop position — no custom drop handler needed.
    return <div ref={hostRef} style={{ minHeight: 200, height: "100%" }} />;
  },
);
