# Selection Nub — Design Spike (Removed)

**Feature:** A small 8×30px tab rendered in the gap between the leads list panel and the detail panel, aligned to the selected card's vertical center, tracking it as the user scrolls.

**Status: Removed.** The implementation worked technically but was cut for design reasons. This document records what was built and why each approach was rejected, so it can be revived without re-exploring the same dead ends.

---

## The Problem

The nub needed to:
1. Visually sit in the 3px gap between the left list panel (`w-[340px]`) and the right detail panel
2. Vertically align with the selected card in the list
3. Move with the card in real time as the user scrolls

The two panels are flex siblings with `gap-[3px]`. The left panel is `overflow-hidden` (required for `rounded-lg` corner clipping) and contains a scroll container with `overflow-y-auto`.

---

## Approaches Tried

### Attempt 1 — Nub inside the card (CSS bleed)
Put the nub as an absolutely-positioned child of `LeadListCard` with `right: -8px`.

**Problem:** CSS spec disallows `overflow-x: visible` when `overflow-y` is anything other than `visible`. Both the scroll container (`overflow-y: auto`) and the left panel (`overflow-hidden`) clipped the nub. Setting `[overflow-x:clip]` on the scroll container still clipped it — `clip` clips, it just doesn't create a scroll container.

**Verdict: CSS cannot solve this. The nub must live outside the clipping ancestors.**

### Attempt 2 — Absolute nub in outer wrapper with React state
Render the nub absolutely in the outer flex wrapper. Track its Y position with a `nubY` state variable, updated via scroll listener and selection change effect.

**Problem:** React state updates are batched and async — the nub lagged visibly behind the card during scroll.

**Verdict: React state is too slow for scroll-synchronised position tracking.**

### Attempt 3 — Direct DOM mutation (implemented, then removed)
Render the nub absolutely in the outer wrapper with `opacity: 0` initially. Use `useLayoutEffect` + a passive scroll listener to **directly mutate** `nubRef.current.style.transform` and `opacity` — bypassing React's render cycle entirely.

```ts
const positionNub = useCallback(() => {
  const el = scrollContainerRef.current.querySelector(`[data-lead-id="${id}"]`);
  const centerY = el.getBoundingClientRect().top + el.offsetHeight / 2 - outerRef.current.getBoundingClientRect().top;
  nubRef.current.style.transform = `translateY(${centerY - 15}px)`;
  nubRef.current.style.opacity = visible ? "1" : "0";
}, [selectedLead]);

useLayoutEffect(() => { positionNub(); }, [positionNub]);         // on selection change
useEffect(() => { el.addEventListener("scroll", positionNub) }, [positionNub]); // on scroll
```

**Why it works:** `style.transform` triggers a CSS composite-layer repaint, not a React re-render. The browser runs it at display refresh rate. `useLayoutEffect` fires synchronously after DOM mutations, before paint — so there's no flash on selection change.

**Why it was removed:** Design decision — the nub was cut from the UI.

---

## How to Revive

If the nub is wanted again, the Attempt 3 pattern is the correct implementation. Key details:

- **Nub element:** Absolute in the outer wrapper (`ref={outerRef}`), `left: 340` (right edge of the 340px left panel), initial `opacity: 0`
- **outerRef** on the outer `<div className="relative flex h-full ...">` wrapper
- **nubRef** on the nub `<div>`
- **positionNub** as a `useCallback` depending on `selectedLead`
- **Two wires:** `useLayoutEffect(() => positionNub(), [positionNub])` + passive scroll listener on `scrollContainerRef`
- **Visibility guard:** hide nub when the card scrolls out of the list viewport (`cardRect.bottom > listRect.top && cardRect.top < listRect.bottom`)
- **Style:** `width: 8, height: 30, backgroundColor: "#D4E8C2"` (sage green), no border radius

All related code lived in `client/src/features/leads/components/LeadsCardView.tsx` inside the `LeadsCardView` function.
