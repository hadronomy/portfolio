import type { WorkProject } from './work';

/**
 * The projects the gallery shows.
 *
 * Each one links to where the work actually lives, so the gallery is a way
 * into the projects rather than a set of pages about them. Covers are either a
 * capture of the real thing or a shader that draws the project's own subject —
 * never stock artwork standing in for one.
 */
export const workProjects = [
  {
    id: 'canary',
    title: 'Canary',
    category: 'AI systems',
    summary:
      'An agentic legal assistant for Spanish law. It parses BOE documents into navigable temporal fragments and retrieves them with poly-vector matryoshka embeddings.',
    year: '2026',
    cover: {
      src: '/work/canary.webp',
      alt: "The Canary landing page: the headline 'The Agentic Legal Assistant' beside a dithered teal field.",
      width: 1200,
      height: 900,
    },
    href: 'https://github.com/hadronomy/canary',
  },
  {
    id: 'inari',
    title: 'Inari',
    category: 'Edge infrastructure',
    summary:
      'A private control plane for the hardware software still has to touch. Printers, scales, and scanners get managed enrollment and a local API that keeps working when the controller does not.',
    year: '2026',
    cover: {
      src: '/work/inari.webp',
      alt: 'Cover art: devices on one side of a hatched trust boundary, the agent standing in its opening, holding work while the link to the controller is down.',
      width: 1200,
      height: 900,
      shader: 'inari',
    },
    href: 'https://github.com/hadronomy/inari',
  },
  {
    id: 'ram',
    title: 'RAM',
    category: 'Languages & runtimes',
    summary:
      'A language and emulator for the Random Access Machine. Write a program, step the machine, and follow each instruction as it moves a value into a register.',
    year: '2025',
    cover: {
      src: '/work/ram.webp',
      alt: 'Cover art: a program listing mid-execution, the taken branch lit in the gutter beside the register file.',
      width: 1200,
      height: 900,
      shader: 'ram',
    },
    href: 'https://ram.hadronomy.com',
  },
  {
    id: 'vrpt-swts',
    title: 'VRPT-SWTS',
    category: 'Algorithms',
    summary:
      'A solver for waste collection routes with transshipment. Collection tours feed transfer stations, and transport vehicles carry the load on to the landfill.',
    year: '2025',
    cover: {
      src: '/work/routes.webp',
      alt: 'Cover art: two collection tours crossing a district map to their transfer stations, with a loaded haul in flight to the landfill.',
      width: 1200,
      height: 900,
      shader: 'routes',
    },
    href: 'https://github.com/hadronomy/VRPT-SWTS',
  },
] as const satisfies readonly WorkProject[];
