# Core — design guide

This guide defines the design rules for the portfolio. It covers the Astro pages,
React islands, styles, and shared UI components.

Read this guide before a design or interaction change. Use the current user
instructions when they conflict with this guide. Existing code and old PR
measurements do not prove that a design meets these rules.

## 1. Design authority

The Framer project [Core](https://framer.com/projects/UBvNr14GiAfSEZbWBajU)
provides the original geometry, spacing, color, and type. The port also includes
project-specific decisions from [PRs #126–#139](https://github.com/hadronomy/portfolio/pull/139).
Later commits and discussions can supersede a PR description.

Use the reference for visual intent. Use platform documentation for browser
behavior and accessibility requirements. A copied reference value can still fail
an accessibility requirement.

### Reference access

Use the installed Framer skill to open the project. Reuse its session for related
reads. Read the generated project inventory before using node IDs.

| Reference            | Node ID     |
| -------------------- | ----------- |
| Home                 | `augiA20Il` |
| Desktop breakpoint   | `WQLkyLRf1` |
| Tablet breakpoint    | `PhRnepxN8` |
| Phone breakpoint     | `zScCFXbQK` |
| Writing detail page  | `a7AgsWINa` |
| 404 page             | `Ui5rKlUXk` |
| Blog Post component  | `TMwCt9Fxc` |
| Work Image component | `jrf7ZQQtO` |
| Cursor component     | `pKlcJRcBX` |

Read values from the document, then compare them with a screenshot. Work Image
instances can report zero rotation despite visible tilt. Use measured geometry
when the serialized attributes do not explain the image.

Color names also need interpretation. `/Global/Foreground` is a surface:
`rgb(250,250,250)` in light and `rgb(20,20,20)` in dark.
`/Global/Default` is the text color: `rgb(18,18,18)` and white.

Record reference values, measurements, and approximations in the PR description.
Source comments explain current behavior, contracts, and reasons. They do not
narrate earlier defects or repeat values already visible in the code.

## 2. Visual direction

The page uses a narrow text column and a restrained palette. White photo mats,
real logos, and small physical interactions give it character.

The peelable sticker row is the main interactive detail. The presence dot reacts
near the avatar. It stays a status dot at rest. Additional decoration must support
this composition without competing for attention.

### Palette and materials

- Keep page surfaces and text achromatic.
- Keep authentic brand colors where the composition calls for them.
- Treat the existing blue badge and status colors as specific exceptions.
- Use `src/lib/status.ts` for status colors. Keep those colors out of unrelated UI.
- Use tonal surface changes and small directional shadows for depth.
- Keep white photo mats in both themes.
- Use actual backdrop blur for the glass cursor.

Tokens live in `src/styles/global.css`. HSL tokens resolve through
`hsl(var(--x))`. Tokens with alpha use the `H S% L% / A` form.
Tailwind bindings live in `tailwind.config.ts`.

Theme-specific edges use `--border-light-only` and `--border-dark-only`.
The keycap and sticker contact shadows use zero alpha in dark mode. This keeps
one token for each effect.

### Type and layout

The type system has eight utilities: `type-h1`, `type-h2`, `type-h3`, `type-body`,
`type-body-sm`, `type-body-xs`, `type-button`, and `type-overline`.
Use this scale for new components.

Inter Variable is the main face. Geist Mono serves metadata and code.
Brittany Signature serves the signature line only. Inter and Geist Mono are
explicitly allowed by the project instructions.

`type-h1` uses 40px on phones, 32px on tablets, and 36px on desktops.
The size change is intentional. Heading levels express document structure
independently of their visual size.

| Layout constraint         | Value or owner                                  |
| ------------------------- | ----------------------------------------------- |
| Content column            | 640px, owned by `Section.astro`                 |
| Text measure              | 608px with 16px column gutters                  |
| Reference desktop frame   | 1200px                                          |
| Reference widths          | 390px, 810px, 1200px                            |
| Section internal gaps     | 16px, 24px, 32px                                |
| Gap between page sections | 40px, owned by `Layout.astro`                   |
| Row hover fill            | Full width, square edges, aligned inner content |
| Work prints               | 4:3 artwork; placement owns width and rotation |
| Personal photos           | 184×248px, 10px radius, 8px mat inset           |

The reference widths are checkpoints, not a complete responsive test.
The layout must also work between breakpoints, at 320px, and with enlarged text.

The Inter fallback uses Arial with metric overrides to reduce font-swap movement.
A font change requires new measurements across the supported platforms.

### Work canvas

The work canvas uses contours from a seeded synthetic height field.
It is decorative terrain, not a map of the Canary Islands.
`src/lib/terrain.ts` generates the SVG paths at build time.
The browser receives the paths without the generator.

Stacks is the work presentation. Project records contain content and destinations;
`canvas-layout.ts` owns the print positions. Additional projects form groups of four.
Select a print to update its description and project link. Keep browsing on the canvas.
Keep controls in one compact caption with a linked title, summary, project count,
and bare previous, next, spread, and reset icons. Cross-blur changed text with the
same 2px blur as the copy and theme buttons. Keep the first caption visible.

Horizontal touch swipes browse projects; vertical gestures scroll the page.
Trackpad pinch zooms around the pointer. Touch pinch retains browser page zoom.
Mouse dragging pans the canvas. Left and right arrow keys browse projects;
S spreads or gathers prints, and Home resets the view. Keep button alternatives.
Restore selection and camera position when visitors return from a project page.

Keep the contours subordinate to the project captures. Use theme tokens and
non-scaling strokes. The contour canvas supersedes the original halftone field.

### Project covers

A cover is a capture of the real product or a shader that draws the project's
own subject. Use no other artwork. Capture a populated interface, not an empty
one. Reserve a drawn cover for a project with no interface to capture.

Drawn covers are WGSL fragment shaders in `src/shaders`, rendered with vgpu.
Each one ships a poster rendered from the same shader at a chosen moment.
The poster is the cover: it is in the markup, it stays opaque under the canvas,
and it is what a browser without WebGPU, a visitor with reduced motion, and the
cursor preview all use. WebGPU adds motion over a finished picture.

Draw the project's own subject, and let its state drive the motion. A shader
that animates on a timer is decoration. Floor stroke radii against the device
pixel size: a print composed at 1200px wide is shown at about 250.

`docs/work-gallery.md` covers the records, the validation gate, and the poster
script. Astro's build does not validate WGSL; `bun run shaders:check` does.

## 3. Motion and interaction

Motion must explain a state change or answer an action. Frequent actions need
immediate feedback. [Emil Kowalski's motion guidance](https://emilkowal.ski/ui/you-dont-need-animations)
uses purpose and frequency to decide whether animation helps.

Keep page content visible throughout entrance animations, including their delays.
An opacity-zero entrance violates this rule even when CSS runs without JavaScript.
Use motion on visible content and honor `prefers-reduced-motion`.
The [Motion accessibility guide](https://motion.dev/docs/react-accessibility)
explains how to adapt effects to that preference.

Inspect intermediate frames in both directions. Correct endpoints do not prove
that a morph is correct. Keep resting elements free of unnecessary transforms,
filters, and layer promotion.

### Cursor

`src/components/react/Cursor.tsx` replaces the native cursor on supported fine
pointers with motion enabled. Without that enhancement, the native cursor remains.

- Keep pointer position immediate. Apply coordinates directly without a follow spring.
- Keep one owner for the position transform. Motion controls the child shape and opacity.
- Keep `pointermove` support alongside optional `pointerrawupdate` support.
- Persist the island across Astro navigation and carry its cursor class through the swap.
- Restore the native cursor when the enhancement stops.
- Retain the traced arrow silhouette and its tip as the hotspot.
- Morph one element through a small rounded shape into the preview or status label.
- Resolve the outline before expansion. Shrink the box before restoring the arrow outline.
- Let preview contents arrive after the container has enough space.

The arrow uses the translucent cursor token with a darker core in both themes.
A preview centers on the pointer. A status label sits clear of the status dot.
Interaction hints use `data-cursor="hint"`. Keep the arrow distinct and fixed at the
pointer. Grow the neutral glass label from its lower-right edge. Do not use the
status dot's green appearance for an interaction hint. Avoid outer shadows inside
the cursor's shape mask; they produce square corners around a rounded label.
The native arrow asset comes from
[`daviddarnes/mac-cursors`](https://github.com/daviddarnes/mac-cursors/blob/main/src/svg/default.svg).

Direct style writes still depend on the browser main thread. They do not provide
native cursor latency guarantees. The custom cursor also loses OS pointer size,
contrast, and shape preferences. These limitations require explicit attention
when the cursor changes.

### Presence

`profile.status` selects `available`, `busy`, `away`, or `offline`.
`src/lib/status.ts` owns each label, color, and animation eligibility.
A valid type does not establish that the status claim is true.

The server renders the status dot. The React island enhances it for supported
pointers. Offline status and reduced motion retain the static dot.

- Keep the resting dot at 12px and at the same center as the server-rendered dot.
- Keep the background ring at every size.
- Derive the dot and cursor label from the same status appearance.
- Keep the face without a mouth or an unsolicited performance loop.
- Tie expressions to events: the copy action produces the dome eyes, and wake produces the alert eyes.
- Keep dozing separate from status. Pointer inactivity does not change availability.

The eyes use spherical projection and foreshortening. Their geometry needs
optical adjustment at this size. Neutral eyes are capsules, pleased eyes are
domes, and alert eyes are circles.

The face opens near the pointer. After 20 seconds of inactivity, the open face
can doze. The closed status dot must retain its size and appearance.

The island has a pointer-sensitive overlay for the cursor label. It has no
navigation action. Treat that overlay as real hit-test geometry when evaluating
nearby controls and accessible status information.

### Stickers

`Sticker.astro` owns the cut, peel, gloss, drag, and label.
Positions persist as offsets from each sticker slot. Stable tool names identify
placements. Clamp restored placements after layout changes, including the clip margin.

A drop keeps the sticker in place. A drop near its slot snaps home.
A double click returns a displaced sticker. The label travels with the sticker,
and the slot shows its silhouette after displacement.

The white cut separates the mark in dark mode. A small contact shadow provides
separation in light mode. The peeled underside casts its own shadow.

Use `feBlend mode="screen"` to combine specular highlights with the artwork.
Use `feComposite operator="in"` to constrain the result to the artwork alpha.
`screen` is not a valid `feComposite` operator. See the
[SVG filter specification](https://www.w3.org/TR/filter-effects-1/#feBlendElement).
Resolve both light nodes from `.sticker-slot`, which contains the artwork and filter definitions.

The sampled `linear()` curves preserve the chosen spring motion.
CSS Bézier curves can overshoot when their y control points exceed the normal range.
Only their x control points require values from zero to one.
See [MDN's Bézier reference](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/easing-function/cubic-bezier).

## 4. Implementation rules

Astro owns static content. React islands own interactions that need their state
and Motion hooks. The current islands are `Cursor`, `Presence`, and `WorkGallery`.
The cursor and presence use `client:idle`. The interactive gallery uses `client:load`.
See [Astro islands](https://docs.astro.build/en/concepts/islands/).

- Use installed library versions and types before adopting examples from newer documentation.
- Use Node as the runtime and Bun as the package manager, unless a script explicitly requires Bun.
- Use existing dependencies before adding a new one.
- Keep React effects for external synchronization, with listener, timer, and animation cleanup.
- Keep pointer-rate values outside React state when no render is necessary.
- Use delegated listeners for repeated Astro controls.
- Keep UI behavior separate from its visual transition.

[React's effect guidance](https://react.dev/learn/you-might-not-need-an-effect)
explains when render logic or event handlers are sufficient.
[Motion's performance guide](https://motion.dev/docs/performance)
explains the limits of accelerated properties. Measure actual frame behavior
before adding caches or changing animation architecture.

`IconSwap.astro` owns the CSS transition. `CopyButton.astro` owns clipboard
behavior and per-button reset timers. Success feedback requires a successful copy.
`ThemeToggle.astro` owns its glyph state, independently of the theme store.

The blocking head script resolves the initial theme. The persistent store owns
later changes and cross-tab synchronization. Astro swaps require theme restoration.
A persisted cursor requires the incoming document to retain its cursor class.
See [Astro view transitions](https://docs.astro.build/en/guides/view-transitions/)
and [Nano Stores persistence](https://github.com/nanostores/persistent).

### Rendering constraints

| Concern               | Rule                                                                                                                         |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Sticker outline       | Use morphology, blur, and an alpha threshold. Chained shadows process earlier shadows too.                                   |
| Flood transparency    | Use `flood-opacity` or element opacity explicitly.                                                                           |
| Specular attributes   | Preserve SVG attribute casing, including `specularConstant`.                                                                 |
| Peel geometry         | Keep face and flap geometry synchronized. Inspect the crease throughout the transition.                                      |
| Empty filtered layers | Inspect their paint output. The underside filter owns the flap shadow here.                                                  |
| Custom properties     | Register interpolated values with `@property`, or animate the real properties together.                                      |
| Motion transforms     | Compose each transform under one owner, or use separate wrappers.                                                            |
| Presence alignment    | Measure the center against the static dot. Keep a real anchor box for the expanded face.                                     |
| Theme-aware ring      | Let CSS resolve the constant shadow color. Avoid interpolating an unresolved `var()` inside a shadow.                        |
| Sticker return        | Supply explicit transform endpoints after direct drag writes.                                                                |
| Pointer capture       | Handle capture failure and cancellation without stranding the drag.                                                          |
| Astro styles          | Scoped selectors need matching scope attributes. Use narrowly named global selectors for island descendants where necessary. |
| Flex whitespace       | Use `gap` between flex items. Whitespace-only text does not provide their spacing.                                           |
| Overflow              | A clip path alone does not remove layout overflow. Account for rotated and parked elements.                                  |
| Hover cards           | Anchor to the trigger and rank transient cards above pinned cards.                                                           |

`getPosts` owns publication filtering for pages and RSS. Drafts remain available
in development and produce no published page. The typography specimen is a draft.

Twoslash runs only for explicitly tagged fences. The code-block plugin identifies
real blocks before adding copy controls. Copied code excludes popup text.
Use the [Shiki](https://shiki.style/packages/twoslash),
[Fumadocs](https://www.fumadocs.dev/docs/headless/mdx/rehype-code),
[Astro Icon](https://www.astroicon.dev/guides/customization/), and
[KaTeX](https://katex.org/docs/options.html) documentation for changes to those integrations.
Use the [Tailwind directive reference](https://tailwindcss.com/docs/functions-and-directives)
for the existing v4 utilities and configuration bridge.

## 5. Content and accessibility

Use real project captures, photographs, logos, and personal facts.
Keep placeholders explicit until those assets exist. Placeholder panels gain links
and reveal arrows only when they have destinations.

The ULL symbol is a trace of the university asset. Prefer an official vector if
one becomes available. Keep the trace provenance in the asset documentation.

Testimonials, ventures, and Spotify content remain absent without real content.
The contact section uses working social links until a form endpoint exists.
Weather comes from Open-Meteo and stays absent when the request fails.

Use [WCAG 2.2](https://www.w3.org/WAI/WCAG22/quickref/) as the accessibility baseline.
Normal text needs at least 4.5:1 contrast. Large text needs at least 3:1.
Evaluate the composited color, including opacity and the actual background.

Controls need keyboard access, visible focus, meaningful names, and usable targets.
Hover information also needs an accessible route. Color alone cannot communicate
status. Drag interactions need an equivalent alternative unless dragging is essential.

## 6. Verification

1. Run the app build, which includes `astro check`.
2. Inspect changed UI in both themes at 390px, 810px, and 1200px.
3. Include 320px, intermediate widths, and enlarged text when layout or typography changes.
4. Measure horizontal overflow numerically and inspect clipping separately.
5. Inspect rest, hover, press, exit, and intermediate animation frames where applicable.
6. Exercise keyboard access, reduced motion, and relevant pointer types.
7. Exercise client navigation and reload when state or lifecycle behavior changes.
8. Combine screenshots, computed styles, and behavior checks.
9. Report measured results separately from assumptions and historical measurements.

A clean build does not establish accessibility or visual correctness.
An automated accessibility scan also needs manual interaction checks.

Use an isolated `agent-browser` session. Real pointer events can interfere with
synthetic measurements. Track `event.isTrusted` during synthetic runs and reject
contaminated measurements. Dispatch probes on realistic targets.

For long timers, start the observation and collect its result in a later call.
Tool timeouts and screenshot failures do not establish a browser defect.

## 7. Current gaps

This list records known gaps from the review at `dda59d7`. It is not permission
to retain them in new work.

- Four personal photographs remain missing. They block deployment.
- The sticker row shows 10 of 24 skills. The expanded composition remains unresolved.
- Page entry starts at zero opacity. It conflicts with the visible-content rule in section 3.
- The light muted text and dark experience dates fail contrast checks. Heading order also needs correction.
- The custom cursor suppresses native grab and text shapes and OS pointer preferences.
- Cursor and presence eligibility do not react to preference changes after mount.
- The status label needs access beyond the decorative pointer path.
- Sticker placement needs an accessible alternative to pointer dragging.

The original PR stack records the decisions in order:

| PR   | Scope                                                                                            |
| ---- | ------------------------------------------------------------------------------------------------ |
| #126 | Remove legacy effects and animation libraries                                                    |
| #127 | Tokens and theme toggle                                                                          |
| #128 | Homepage                                                                                         |
| #130 | Blog, 404, stickers, gallery, theme persistence, ULL symbol                                      |
| #131 | Design guide                                                                                     |
| #132 | Comment rules and layout name                                                                    |
| #133 | Dependency cleanup                                                                               |
| #134 | Reactive presence dot                                                                            |
| #135 | Light-mode sticker shadow                                                                        |
| #136 | Twoslash hover stacking order                                                                    |
| #137 | Icon swap and copy button                                                                        |
| #138 | Theme icon swap                                                                                  |
| #139 | Arrow morph, presence expressions, status model, page entry, contour canvas, pointer performance |
