import { forwardRef, useImperativeHandle, useRef, useEffect } from "react";
import { EditorState, StateField, Compartment } from "@codemirror/state";
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
  accentColor?: string;
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
      background: "rgba(114,47,55,0.13)",
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

    /* Correct cursor placement when html { zoom } != 1.
       CM6 mixes visual-pixel clientY with layout-pixel scrollTop/height-map,
       causing clicks to land on the wrong line when a CSS zoom is active.
       We intercept mousedown in capture phase (before CM6) and re-dispatch
       with zoom-normalised coordinates. Only corrects simple clicks — drag
       selection is left to CM6 (the anchor may drift slightly during drag,
       which is an acceptable trade-off vs rewriting CM6's selection logic). */
    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;

      const correctionHandler = (e: MouseEvent) => {
        const zoom = parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
        if (Math.abs(zoom - 1) < 0.01) return; // noop when no zoom active
        if (e.detail > 1 || e.shiftKey || e.metaKey || e.ctrlKey) return; // let CM6 handle multi/modifier clicks
        if (e.buttons !== 1) return; // left button only

        const rect = view.scrollDOM.getBoundingClientRect();
        // Corrected coords: translate visual click into layout-pixel space so CM6's
        // posAtCoords + scrollTop arithmetic uses the same unit throughout.
        const correctedX = rect.left + (e.clientX - rect.left) / zoom;
        const correctedY = rect.top + (e.clientY - rect.top) / zoom;
        const pos = view.posAtCoords({ x: correctedX, y: correctedY });
        if (pos === null) return;

        // Run after CM6 has processed mousedown (focus, internal drag state) so
        // we don't interfere with its setup, then fix cursor to the right position.
        requestAnimationFrame(() => {
          if (view.state.selection.main.empty) {
            view.dispatch({ selection: { anchor: pos, head: pos } });
          }
        });
      };

      view.scrollDOM.addEventListener("mousedown", correctionHandler, true);
      return () => view.scrollDOM.removeEventListener("mousedown", correctionHandler, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // runs once after editor mount; viewRef.current is stable

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
