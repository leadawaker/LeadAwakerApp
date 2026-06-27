import { forwardRef, useImperativeHandle, useRef, useEffect } from "react";
import { EditorState, Compartment } from "@codemirror/state";
import {
  EditorView,
  ViewPlugin,
  keymap,
  type DecorationSet,
  type ViewUpdate,
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
  accentColor?: string;
  onChange: (value: string) => void;
  onScroll?: () => void;
  onActiveHeadingsChange?: (activeH1Line: number, activeH2Line: number) => void;
};

/* Decoration plugin — recomputes on doc/viewport changes (fixes A: vars align). */
const decorationPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations },
);

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
      background: "rgba(114,47,55,0.13)",
      color: "var(--wine)",
      borderRadius: "2px",
    },
    ".cm-cond": {
      color: "var(--wine)",
      fontWeight: "700",
      opacity: "0.7",
    },
    ".cm-h1": { fontSize: `${fontSize + 5}px`, fontWeight: "700" },
    ".cm-h2": { fontSize: `${fontSize + 3}px`, fontWeight: "700" },
    ".cm-h3": { fontWeight: "700" },
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

    /* Find the topmost-visible `#` and the topmost-visible `##` inside it. */
    function emitActiveHeadings(view: EditorView) {
      const cb = onActiveRef.current;
      if (!cb) return;
      const top = view.scrollDOM.scrollTop;
      const { doc } = view.state;
      let activeH1 = -1;
      let activeH2 = -1;
      for (let i = 1; i <= doc.lines; i++) {
        const line = doc.line(i);
        const m = line.text.match(HEADING_RE);
        if (!m) continue;
        const level = m[1].length;
        if (level > 2) continue;
        const blockTop = view.lineBlockAt(line.from).top;
        if (blockTop <= top + 1) {
          if (level === 1) {
            activeH1 = i - 1;
            activeH2 = -1; // reset deeper heading when entering a new H1
          } else if (level === 2) {
            activeH2 = i - 1;
          }
        } else {
          break;
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
        if (u.docChanged) onChangeRef.current(u.state.doc.toString());
        if (u.geometryChanged || u.viewportChanged) scheduleActive(u.view);
      });

      const state = EditorState.create({
        doc: initialValue,
        extensions: [
          EditorView.lineWrapping,
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          decorationPlugin,
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
