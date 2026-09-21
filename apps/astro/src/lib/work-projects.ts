import type { WorkProject } from './work';

export const projects = [
  {
    id: 'inari',
    title: 'Inari',
    category: 'Edge infrastructure',
    summary:
      'A local-first platform that connects physical devices to private infrastructure with managed enrollment, offline operation, and a Zenoh data plane.',
    year: '2026',
    cover: {
      src: 'https://raw.githubusercontent.com/hadronomy/inari/09244d439b4110df0e9313571ce5f98a7dab298e/packages/brand/inari_brand/assets/social-preview.svg',
      alt: 'Inari social preview with its red torii mark and device operations tagline.',
      width: 1200,
      height: 630,
    },
    href: 'https://github.com/hadronomy/inari',
  },
  {
    id: 'canary',
    title: 'Canary',
    category: 'Legal AI',
    summary:
      'An AI legal assistant for Spanish law that turns BOE documents into temporal fragments with poly-vector embeddings for legal retrieval.',
    year: '2026',
    cover: {
      src: 'https://raw.githubusercontent.com/hadronomy/canary/1b85dcd2b96fcace3e02c73bac3cb68ae58e8e90/.github/images/github-header-image.webp',
      alt: 'Canary header artwork with the project name and yellow canary mark.',
      width: 3668,
      height: 1416,
    },
    href: 'https://github.com/hadronomy/canary',
  },
  {
    id: 'bootleg',
    title: 'Bootleg',
    category: 'Developer tools',
    summary: 'A command-line tool that copies anything from the terminal.',
    year: '2024',
    cover: {
      src: 'https://repository-images.githubusercontent.com/790904642/49ad54bc-7e20-4a60-88b7-991724ba6768',
      alt: 'Repository artwork for Bootleg.',
      width: 1280,
      height: 640,
    },
    href: 'https://github.com/hadronomy/bootleg',
  },
  {
    id: 'autographa',
    title: 'Autographa',
    category: 'Creative tools',
    summary: 'Create animated handwritten signatures in the browser.',
    year: '2026',
    cover: {
      src: 'https://repository-images.githubusercontent.com/1168860252/10df3ac8-9473-4f80-9634-5d10bc07f488',
      alt: 'Repository artwork for Autographa.',
      width: 1280,
      height: 640,
    },
    href: 'https://github.com/hadronomy/autographa',
  },
] as const satisfies readonly WorkProject[];
