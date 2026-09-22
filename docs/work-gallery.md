# The work gallery

Project records live in `apps/astro/src/lib/work-projects.ts` and satisfy
`readonly WorkProject[]` from `~/lib/work`. `components/core/Work.astro` passes
that array to `WorkGallery`. Give each project a stable, unique `id` and its own
`href`; selection and return-state restoration use the ID.

Supply the title, category, summary, year, and cover. A cover needs its path,
alt text, and intrinsic width and height. Use 4:3 artwork to show the full
image; other ratios crop from the center.

The gallery places projects in groups of four. Each group gets its own stack.
Visitors can swipe between projects, drag with a mouse, or pinch a trackpad to
zoom. The compact caption keeps project links and button alternatives. Touch
pinch retains browser page zoom. An empty project array renders no gallery.

## Covers

A cover is either a capture of the real thing or a shader that draws the
project's own subject. Nothing else ships — a project with no honest image is a
project with no cover yet.

Capture the product itself, populated with real content. `canary.webp` is the
Canary landing page, captured at 1200x900. Re-capture when the page changes.

A project that has no interface to capture — a language, an emulator, a solver,
a control plane — gets a drawn cover instead. Name the shader in `cover.shader`
and keep `cover.src` pointing at that shader's poster:

```ts
cover: {
  src: '/work/ram.webp',
  alt: 'Cover art: a program listing mid-execution...',
  width: 1200,
  height: 900,
  shader: 'ram',
},
```

## Drawn covers

Each drawn cover is one WGSL fragment shader in `apps/astro/src/shaders`, built
on the primitives in `ink.wgsl` and compiled by
[vgpu](https://vgpu.sh). `src/lib/shader-covers.ts` registers each one and picks
the moment its poster freezes.

The poster is not a stand-in. It is the same shader at that moment, rendered
headless through Dawn, and it is what ships in the markup, what a browser
without WebGPU keeps, what a visitor who asked for reduced motion keeps, and
what the cursor shows on hover. WebGPU only ever adds motion on top of it.

To add one:

1. Write `src/shaders/<id>.wgsl` with a `Params` uniform of `time`, `aspect`,
   and `pixel`, and a `fs_main` fragment entry point. `pixel` is one device
   pixel in print units — resolve every edge against it and floor stroke
   radii with `hairline()`, or the drawing washes out at print size.
2. Add `{ id, posterTime }` to `src/lib/shader-covers.ts` and a loader entry in
   `components/react/work/ShaderCover.tsx`.
3. Validate: `bun run shaders:check`. Astro's build does not compile WGSL, so
   this is the only gate that catches an invalid shader before the browser does.
4. Render the poster: `bun run covers:render`. Pass an id and `--time` to try
   other moments (`node scripts/shaders/render-covers.mjs ram --time 3.2 --out
   /tmp/look.png`). Re-run it whenever the shader changes.

Rendering posters needs a GPU-capable machine; `bunx vgpu doctor` reports what
is missing.
