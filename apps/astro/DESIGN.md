# Core — design guide

This site is a port of the Framer project **Core** to Astro 5 + Tailwind v4 with
React islands. This file is the handoff for whoever works on it next. It records
the reference, the token system, the lessons that cost the most time, and the
rules that keep the work honest.

Read it before you change anything under `src/components/core/`,
`src/styles/` or `src/lib/`.

---

## 1. The reference

Source of truth is the Framer project `UBvNr14GiAfSEZbWBajU`. It is authoritative
for geometry, spacing, colour and type. This repo is a port, not a reinterpretation.

### Reopen a session

Sessions expire. Create a new one, use it, then destroy it.

```sh
bunx @framer/agent@latest session new UBvNr14GiAfSEZbWBajU   # prints a session id
bunx @framer/agent@latest exec -s <id> -e "<js>"
```

Screenshot a node (returns a URL to `curl`):

```sh
bunx @framer/agent@latest read-project -s <id> -p "/" \
  -q '[{"type":"screenshot","id":"<nodeId>","format":"png","theme":"dark"}]'
```

### Node ids

| Node | Id |
| --- | --- |
| Home page | `augiA20Il` |
| `/writing/:slug` page | `a7AgsWINa` |
| `/404` page | `Ui5rKlUXk` |
| Blog Post row component | `TMwCt9Fxc` |
| Work Image component | `jrf7ZQQtO` |
| Work frame | `vffMlrGSc` |

`framer.getColorStyles()` returns all 19 colour styles with their light and dark
values. Walk trees with `getChildren()` from a page's children —
`framer.getNode(id)` does not resolve deeply nested nodes reliably.

### The most important rule: read the document, then verify against a render

The canvas is authoritative for most things and wrong about some. Two proven cases:

- **Rotation on the Work Image instances reports `0`.** The published page plainly
  shows every panel tilted. The tilt comes from something the API does not expose.
  The angles in `src/components/core/Work.astro` are measured from pixels, and the
  comment there says so.
- **Core's colour names mislead.** `/Global/Foreground` is
  `rgb(250,250,250)` / `rgb(20,20,20)` — a *surface*. `/Global/Default` is
  `rgb(18,18,18)` / `rgb(255,255,255)` — the *text* colour. Port by value, never
  by name.

When you measure instead of read, write that in the comment next to the value.
Several comments in this codebase already do; keep the habit.

---

## 2. Tokens, type and layout

### Palette

Every value is achromatic: hue 0, saturation 0. The design carries contrast
through lightness alone, so a hue anywhere reads as a mistake. The only exception
is a real brand logo, which keeps its own colours.

- Light page: `rgb(255,255,255)` background, `rgb(18,18,18)` text.
- Dark page: `rgb(13,13,13)` background, `rgb(255,255,255)` text.

Tokens live in `src/styles/global.css` as bare HSL triples and resolve through
`hsl(var(--x))`. Alpha-bearing tokens use the `H S% L% / A` form, which
`hsl()` accepts. Tailwind bindings for the Core-specific tokens
(`surface`, `inset`, `overlay`, `button`, `nav-item`, `cursor`, `shortcut`) are in
`tailwind.config.ts`.

Two details worth knowing before you touch them:

- `--border-light-only` and `--border-dark-only` exist so an edge that Core draws
  in one theme only never doubles up in the other.
- `--shortcut-shadow` goes to zero alpha in dark. Core drops the keycap shadow
  there rather than darkening it, so this stays one token and not two rules.

### Type

Eight text styles, one utility each, in `src/styles/global.css`:
`type-h1`, `type-h2`, `type-h3`, `type-body`, `type-body-sm`, `type-body-xs`,
`type-button`, `type-overline`. **Do not invent a ninth.** If a section needs a
size that is not in the ramp, the section is wrong.

`type-h1` is largest on phones (40px) and smallest on tablet (32px), then 36px on
desktop. That inversion is what Core ships. It is not a transcription slip.

`type-overline` is the only place mono appears — section kickers, dates and the
clock. Fonts are Inter Variable and Geist Mono, both self-hosted through
`@fontsource-variable`. The signature face is Brittany Signature, loaded in
`src/components/core/Signature.astro` and used for one line only.

### Grid

- Breakpoints are Core's canvas widths and nothing else: `phone` 390, `tablet` 810,
  `desktop` 1200. A section verified at those three widths is verified.
- The page is one 640px column (`--content-width`) inside a 1200px frame, with a
  608px measure (`--measure`) on running text.
- `src/components/core/Section.astro` owns the column. It takes `gap` of 16, 24 or
  32 only — Core uses 16 between most sections, 24 after the intro, 32 around
  experience and contact.
- `src/components/core/Row.astro` is the exception: full-width hover fill, content
  still on the 640px column. The fill is square-edged because rounding a bleed puts
  corners in the middle of the page.
- `src/layouts/Layout.astro` sets 40px between sections. That number is measured off
  the render; the canvas reports a zero gap and puts the spacing somewhere it does
  not expose.

---

## 3. Technical lessons

Each entry is symptom, cause, fix. Where a lesson has a live example, the file is
named.

### Chained CSS `drop-shadow()` never makes an outline

**Symptom.** Eight chained `drop-shadow()` filters around a mark produce a
saw-tooth at every sharp corner instead of an even outline.
**Cause.** A filter chain is sequential. Each filter runs on the previous
*result*, so you get offset copies of offset copies.
**Fix.** One `feMorphology` dilate on `SourceAlpha`, then `feGaussianBlur`, then a
`feColorMatrix` whose alpha row thresholds the blur back to a hard edge. The
matrix's first three rows can force R, G and B to 1, which gives a white cut with
no separate flood.
**Live:** the `cut-*` filter in `src/components/core/Sticker.astro`.

### `feFlood` drops the alpha channel of a colour handed to it

**Symptom.** `flood-color="currentColor"` at 10% alpha paints solid.
**Cause.** `flood-color` and `flood-opacity` are separate inputs.
**Fix.** Carry the translucency with `opacity` on the element instead.
**Live:** `.sticker-cutout` in `Sticker.astro` sets `color: hsl(var(--foreground))`
and `opacity: 0.1`.

### An element with a CSS `filter` paints its own box even when it is empty

**Symptom.** A faint diamond behind every stack mark in light mode.
**Cause.** The element carried a CSS filter and a rotated ancestor. It painted its
own box even with nothing inside it — proven by emptying the element completely.
**Fix.** Never put a CSS filter on a layer that can be empty. Fold the effect into
an SVG filter on the content instead.
**Live:** the sticker's cast shadow comes from `feDropShadow` inside the `back-*`
filter, not from a third element.

### `specularConstant` is camelCase

`specular-constant` is silently ignored and falls back to 1, which washes the
artwork grey. Same for every other camelCase SVG filter attribute.

### Composite specular highlights with `operator="screen"`

The default `over` paints the highlight on top and desaturates what is under it.
Screen adds light, which is what a highlight does.
**Live:** the `sheen-*` filters in `Sticker.astro`.

### A backface flips about the box centre, not about the hinge

**Symptom.** Rotating the flap about the crease throws it to the far side of the
fold.
**Cause.** `scaleY(-1)` mirrors about the centre of the box.
**Fix.** Let it flip about the centre. The top strip lands at the bottom, so the
back layer takes the bottom strip with pre-mirrored artwork. The two inversions
cancel.
**Live:** `.flap` in `Sticker.astro`, parked a full height above and mirrored.

### A clip-path crease must never go negative

**Symptom.** The mirrored flap floats detached from the sticker during the
transition, and looks correct at both endpoints.
**Cause.** A crease above the top edge defines a strip that is off the element.
**Fix.** Clamp the crease into the box. It is invisible at rest, because the band
is empty there, and visible in every frame that passes through the negative range.

### Custom properties do not interpolate without `@property`

**Symptom.** Two derived values that describe the same state drift apart mid
animation.
**Cause.** An unregistered custom property has no type, so the browser cannot
interpolate it; each derived property transitions on its own clock.
**Fix.** Either register the property (`syntax`, `inherits`, `initial-value`) and
animate the two numbers that describe the state, deriving everything else — or
animate the real properties together under one easing declaration.
**Live:** the fold takes the second route. `.flap` animates `clip-path` and `top`
with a single `transition: all var(--peel-hover-easing)` so they cannot desync.

### Motion's `animate(el, { x: target })` starts from its own cached value

**Symptom.** A sticker moved twice without a page reload snaps back to its previous
resting place and travels from there.
**Cause.** Motion caches the last value it animated for that element. It does not
read what you wrote to `style` directly.
**Fix.** Pass both keyframes: `animate(el, { transform: [from, to] }, spring)`.
**Live:** `glideTo` in `Sticker.astro`.

### Motion's drag is React-only

The vanilla entry point has no equivalent. `drag`, `dragConstraints`,
`dragElastic`, `dragMomentum`, `dragSnapToOrigin`, `whileHover/Tap/Focus`, and
`useMotionValue/useSpring/useTransform/useVelocity` all exist in `motion/react`
only. For a handful of small elements, pointer events plus Motion's spring for the
return costs far less than mounting islands.
**Live:** the sticker drag is hand-written pointer events in `Sticker.astro`; the
work gallery, which wants `useSpring` and `useTransform`, is a React island in
`src/components/react/WorkGallery.tsx`.

### Astro scoped styles never reach a React island's markup

**Symptom.** A rule written in an `.astro` component's `<style>` block does not
apply to elements the island renders.
**Cause.** Astro scopes those rules with a `data-astro-cid-*` attribute, and the
island's markup does not carry it.
**Fix.** Use `:global()` for classes the island renders, and pick a class name
specific enough to leave global.
**Live:** `:global(.work-panel)` in `src/components/core/Work.astro`.

### Absolutely positioned elements count towards scrollable overflow when clipped to nothing

**Symptom.** 31px of horizontal overflow at 390 from a box that renders nothing.
**Cause.** The sticker's flap is parked above the sticker with a zero-area clip. A
rotation on the container swings that parked box out sideways, and it still counts.
**Fix.** `overflow: clip` with `overflow-clip-margin`. It bounds the box without
creating a scroll container, and the margin leaves the cast shadow room.
**Live:** `.sticker` in `Sticker.astro`.

### `setPointerCapture` throws when the pointer is already gone

An uncaught throw aborts the handler and strands the element mid-drag. Wrap both
the capture and the release in `try`/`catch`. Losing the capture is survivable;
losing the handler is not.
**Live:** both call sites in `Sticker.astro`.

### Whitespace between two inline items disappears in a flex container

**Symptom.** `Press <Shortcut key="C" /> to copy` renders with no space around the
keycap.
**Cause.** This is flex layout, not Astro. A whitespace-only run between two flex
items becomes an anonymous flex item and is not rendered. Measured: in a flex
container the second span starts at x=10.47px; in an inline container it starts at
x=14.66px.
**Fix.** Put the spacing in `gap`, or keep both values inside one text node or one
template literal.
**Live:** `src/components/core/Intro.astro` and `src/pages/404.astro` both use
`flex … gap-1.5` around a `<Shortcut>` in a sentence.
**Correction to earlier notes:** the Astro compiler itself preserves the space.
Verified against a built page — `{a} {b}`, the same pair split across lines, and
the same pair inside a `.map()` expression all emit `A B` in `dist/`.

### The reference's `linear()` easings overshoot past 1

The hover curve peaks at 1.114 and the press curve at 1.197. No `cubic-bezier` can
exceed 1, so no amount of duration tuning reproduces that spring, and its absence
is why the fold read as mechanical. Copy the curves verbatim.
**Live:** `--peel-easing` and `--peel-hover-easing` in `Sticker.astro`.

### `body { overflow-x: hidden }` is present and load-bearing-ish

It is in `src/styles/global.css`. Do not remove it without measuring overflow at
all three widths first. Related: a `position: fixed` box with auto offsets resolves
its static position in document space, so a hover card built that way lands far off
screen on a scrolled page. Anchor such a card absolutely to its trigger. The link
preview here avoids the problem entirely by living inside the cursor follower,
which is positioned from `clientX`/`clientY`.

### Persist positions as offsets, never as page coordinates

An absolute point is wrong the moment anything reflows — a narrower window, a new
post in the writing list, a longer intro. An offset from a home element survives
all of it, because the home element moves with the layout.
Clamp on every apply, and clamp against the element's clip margin, not only its box
— the overhang alone can push a scrollbar onto the page.
**Live:** `src/lib/stickers.ts` and the `clamp` function in `Sticker.astro`.

---

## 4. Verification discipline

This is the part that mattered most. Three defects shipped because only the state
being built was inspected.

1. **Check the resting state as carefully as the active one.** The page spends
   nearly all its time at rest.
2. **Step transitions manually with transitions disabled and inspect intermediate
   frames.** Two bugs were invisible at both endpoints and obvious mid-way.
3. **Verify both themes and all three widths (390 / 810 / 1200) every time.**
4. **Measure horizontal overflow numerically**
   (`document.documentElement.scrollWidth - clientWidth`), never by eye.
5. **Prefer numeric assertions to screenshots.** Computed styles and bounding rects
   are reliable. Screenshots are not always available.
6. **State which values you read, which you measured, and which you approximated.**
   Put it in the comment beside the value.

---

## 5. Tooling

### Browser

`agent-browser` is the browser tool. Note the verb:

```sh
agent-browser set viewport 390 844      # "set viewport", not "viewport"
agent-browser set media dark            # or light
agent-browser open <url>
agent-browser eval '<js>'
agent-browser hover '<selector>'
agent-browser screenshot out.png
```

Its screenshot path wedges regularly and sometimes fails for long stretches. When
it does, headless Chrome works:

```sh
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --no-sandbox --hide-scrollbars \
  --user-data-dir=<fresh dir> --window-size=W,H \
  --virtual-time-budget=7000 --screenshot=out.png <url>
```

The default there renders dark. Add `--blink-settings=preferredColorScheme=1` for
light. `--dump-dom` instead of `--screenshot` returns the rendered DOM, which is
the cheap way to read a computed value out of a page.

### Images

`sips -c H W --cropOffset Y X in.png` crops. `sips -Z N in.png` upscales for
inspection. For precise geometry, load an image into a canvas with
`agent-browser eval` and read the pixels. That is how the ULL mark was traced and
how the sticker outline was measured.

### Other

- Cloudflare blocks CodePen to every tool available here. Ask the user to paste the
  source.
- Build: `cd apps/astro && GITHUB_TOKEN=dummy bun run build`. The repo `.env` ships
  an empty `GITHUB_TOKEN`; this is pre-existing and not yours to fix.
- Astro ignores pages whose filename starts with `_`. A scratch page under
  `src/pages/` needs a normal name, and needs deleting afterwards.

---

## 6. Honesty constraints

These are not negotiable.

- **Never fake content.** `WORK` and `PERSONAL` ship honest placeholders at Core's
  exact geometry — 300x248 panels at 12px radius, 184x248 photo frames, white mat,
  5px inset. The site must not go live until the user supplies four project captures
  and four photographs. Do not substitute stock imagery, generate mockups, or invent
  product UI. If asked to make them look "more real", push back.
- **Never invent a logo.** The ULL mark in `src/components/svg/Ull.astro` is traced
  from the university's own PNG, because they publish no vector. The outline was
  read off the pixels and checked back against the source; the remaining 1.97%
  difference is the antialiasing floor. It is documented as traced. Swap in an
  official vector if one ever appears.
- **Placeholders must not carry affordances that do nothing.** A Work panel only
  gains its reveal arrow and its link once it has an `href`. See the `interactive`
  branch in `WorkGallery.tsx`.
- **No form without an endpoint.** `src/components/core/Contact.astro` ships the
  social rows and no form. Core puts a form there; a form that silently drops
  messages is worse than none.
- **No fabricated data.** The footer weather comes from Open-Meteo at runtime and
  the row stays hidden when the fetch fails, rather than showing a temperature that
  could be mistaken for a real one.

---

## 7. Where things stand

Four stacked PRs, each layered on the one before:

| PR | Branch | Contents |
| --- | --- | --- |
| #126 | `t3code/ba6afc59` | Strip dead dependencies |
| #127 | `t3code/core/tokens` | Core tokens and the theme toggle |
| #128 | `t3code/core/homepage` | Homepage |
| #130 | `t3code/core/blog` | Blog, 404, article typography, stickers, theme persistence, work gallery, ULL mark |

### Outstanding

- **`Stack` redesign.** The row shows 10 of 24 skills. There is a `TODO` in
  `src/components/core/Stack.astro`. It has to carry all 24 at the same density
  without becoming a checklist — widening the current row is what makes it read as
  an inventory.
- **Spotify now-playing card.** Skipped, not faked.
- **Contact form endpoint.** Skipped, not faked.

### Notes for a future agent

- Inter and Geist Mono are explicitly allowed by the user's global instructions. Do
  not flag them as generic.
- The signature artifact of this page is the peelable sticker row. Everything else
  is calm on purpose. Do not add a second focal object.
- Islands are deliberate and few: `Cursor` (`client:idle`, decorative) and
  `WorkGallery` (`client:visible`). Everything else is Astro plus a small inline
  script. Adding an island needs a reason a spring or a pointer event cannot cover.
