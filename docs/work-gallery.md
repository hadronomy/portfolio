# Replace the demo projects

1. Add your project records to a file in `apps/astro/src/lib`.
2. Check the array with `satisfies readonly WorkProject[]` from `~/lib/work`.
3. Pass that array to `WorkGallery` in `components/core/Work.astro`.
4. Remove the `demo` prop to show the project count.

Use `src/lib/work-demos.ts` as the compiled example. Give each project a stable,
unique `id` and its own `href`. Selection and return-state restoration use the ID.

Supply the title, category, summary, year, and cover image. Include the image's
path, alt text, and intrinsic width and height. Use 4:3 artwork to show the full
image; other ratios crop from the center.

The gallery places additional projects in groups of four. Each group gets its
own stack. Visitors can swipe between projects, drag with a mouse, or pinch a
trackpad to zoom. The compact caption keeps project links and button alternatives.
Touch pinch retains browser page zoom.
An empty project array renders no gallery.

The homepage and `/work/stacks/` use Stacks. Demo project pages live under
`/work/stacks/project/`. Replace those pages when you add your real project stories.
