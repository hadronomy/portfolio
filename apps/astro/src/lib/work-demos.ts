import type { WorkProject } from './work';

/** Demo content stays separate from the gallery's project contract. */
export const demoProjects = [
  {
    id: 'forma',
    title: 'Forma',
    category: 'Creative tools',
    summary:
      'A small space for a personal mark. Explore the shape, pace, and character of a signature.',
    year: '2026',
    cover: {
      src: '/work/forma.svg',
      alt: 'Demo artwork: a flowing ink stroke on a pale green field.',
      width: 1200,
      height: 900,
    },
    href: '/work/stacks/project/forma/',
  },
  {
    id: 'margin',
    title: 'Margin',
    category: 'Reading & research',
    summary:
      'A quieter way through complex documents. Keep the passage, the context, and your notes together.',
    year: '2026',
    cover: {
      src: '/work/margin.svg',
      alt: 'Demo artwork: a folded reading sheet with a red annotation and oversized serif type.',
      width: 1200,
      height: 900,
    },
    href: '/work/stacks/project/margin/',
  },
  {
    id: 'transit',
    title: 'Transit',
    category: 'Maps & systems',
    summary:
      'See the journey as a whole. A study of routes, connections, and the decisions between them.',
    year: '2025',
    cover: {
      src: '/work/transit.svg',
      alt: 'Demo artwork: three labeled routes converge at a central interchange on a dark map.',
      width: 1200,
      height: 900,
    },
    href: '/work/stacks/project/transit/',
  },
  {
    id: 'raster',
    title: 'Raster',
    category: 'Developer tools',
    summary:
      'Small parts, precise results. A visual study of how simple rules become a complete system.',
    year: '2025',
    cover: {
      src: '/work/raster.svg',
      alt: 'Demo artwork: a dimensional woven pattern of silver strips on a charcoal field.',
      width: 1200,
      height: 900,
    },
    href: '/work/stacks/project/raster/',
  },
] as const satisfies readonly WorkProject[];
