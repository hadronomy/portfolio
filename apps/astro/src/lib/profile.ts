import type { Status } from '~/lib/status';

const engineeringRole = 'Product Engineer / Full-Stack Engineer';

/**
 * Every fact the homepage states about Pablo, in one place. Sections read from
 * here rather than inlining copy, so correcting a date or a handle is one edit
 * and never leaves two sections disagreeing.
 */

export const profile = {
  name: 'Pablo Hernández',
  role: engineeringRole,
  /** Year the "10+ years" of building started, shown as EST. in the header. */
  established: 2003,
  location: 'Canary Islands, Spain',
  /** Santa Cruz de Tenerife, for the footer's current conditions. */
  coordinates: { latitude: 28.4636, longitude: -16.2518 },
  email: 'pablo@hadronomy.com',
  /**
   * What the dot on the avatar claims.
   *
   * A statement about Pablo rather than a label, so it is owned here rather
   * than buried in a component — and one of a closed set rather than free
   * text, so it cannot claim something the dot has no way to look like. What
   * each one says and how it appears is in `~/lib/status`.
   */
  status: 'available' satisfies Status,
  avatar: 'https://github.com/hadronomy.png',
  intro:
    'I build web applications, product interfaces, and the systems behind them, with a particular interest in agentic AI. Most of my work is open source. Based in the Canary Islands, Spain, I am available for projects with teams across Europe.',
} as const;

export type ExperienceEntry = {
  period?: string;
  role: string;
  engagement?: string;
  description: string;
  highlights?: readonly string[];
  organisation?: {
    name: string;
    /** Icon set name for astro-icon, or `ull` for the university mark. */
    mark: string;
    url?: string;
    /** Screenshot of `url` shown in the cursor on hover. */
    preview?: string;
  };
};

export const engineeringExperience = {
  role: engineeringRole,
  engagement: 'Independent',
  description:
    'Design and build software across product interfaces, APIs, AI retrieval, language tooling, and device infrastructure.',
  highlights: [
    "Build Canary's Spanish-law retrieval pipeline with BOE document parsing, temporal fragments, and vector embeddings.",
    "Develop Inari's local-first device platform with managed enrollment, offline operation, and a Rust controller.",
    'Create RAM language tooling and emulation, and implement vehicle-routing algorithms with transshipment in VRPT-SWTS.',
    'Build signature and movie recommendation tools. Mentor peer developers in software architecture.',
  ],
} satisfies ExperienceEntry;

export const engineeringSkills = [
  {
    id: 'development',
    label: 'Development',
    items: [
      'TypeScript',
      'JavaScript',
      'React',
      'Rust',
      'Python',
      'C++',
      'Node.js',
      'Next.js',
      'Go',
      'Zig',
      'WebAssembly',
      'HTML',
      'CSS',
      'Astro',
      'Tailwind CSS',
      'Three.js',
      'Axum',
      'Leptos',
    ],
  },
  {
    id: 'tools',
    label: 'Tools & infrastructure',
    items: [
      'Docker',
      'PostgreSQL',
      'Git',
      'Linux',
      'Kubernetes',
      'Prisma',
      'Vite',
      'Tauri',
      'SurrealDB',
      'Temporal',
      'Zenoh',
    ],
  },
] as const satisfies readonly {
  id: string;
  label: string;
  items: readonly string[];
}[];

export const experience: ExperienceEntry[] = [
  engineeringExperience,
  {
    period: '2021 — NOW',
    role: 'B.S. Computer Engineering',
    description:
      'Algorithms, software architecture and distributed systems. Led student project teams and competed in algorithm contests.',
    organisation: {
      name: 'Universidad de La Laguna',
      mark: 'ull',
      url: 'https://www.ull.es',
      preview: '/previews/ull.webp',
    },
  },
  {
    period: '2014 — NOW',
    role: 'Open source',
    description:
      'Autographa, Canary, a RAM machine language and emulator, and solvers for vehicle routing with transshipments.',
    organisation: {
      name: 'GitHub',
      mark: 'simple-icons:github',
      url: 'https://github.com/hadronomy',
      preview: '/previews/github.webp',
    },
  },
];

/**
 * Ten marks, not twenty-four — the row is a signal, not an inventory. The
 * design shows real brand colour here, so these are the multicolour sets
 * rather than the monochrome `simple-icons` variants.
 */
export const stack = [
  { name: 'TypeScript', icon: 'logos:typescript-icon' },
  { name: 'Rust', icon: 'material-icon-theme:rust' },
  { name: 'React', icon: 'logos:react' },
  { name: 'Astro', icon: 'logos:astro-icon' },
  { name: 'Node.js', icon: 'logos:nodejs-icon' },
  { name: 'Go', icon: 'logos:go' },
  { name: 'Zig', icon: 'material-icon-theme:zig' },
  { name: 'Docker', icon: 'logos:docker-icon' },
  { name: 'Linux', icon: 'logos:linux-tux' },
  { name: 'PostgreSQL', icon: 'logos:postgresql' },
] as const;

export type Social = {
  label: string;
  handle: string;
  href: string;
  icon: string;
  /**
   * Set when the brand mark is the brand name, as X's is.
   *
   * The row prints the label beside the mark, which for X puts the glyph next
   * to a letter drawn the same way — the only row in the list that says its
   * name twice. Where this is set the label is kept for screen readers and the
   * mark speaks for itself. The icon column does not move, so the list keeps
   * its rhythm.
   */
  markIsName?: boolean;
};

/**
 * Where to find Pablo, minus email.
 *
 * `CopyShortcut` puts the address one key away from anywhere on the site, so a
 * row here would be a second, slower route to something the page already
 * offers. The address itself stays on `profile`.
 *
 * X leads because it is the one row the mark alone names. Between two labelled
 * rows its empty label column reads as a gap; at the top it reads as a choice.
 */
export const socials: Social[] = [
  {
    label: 'X',
    handle: '@hadronomy',
    href: 'https://x.com/hadronomy',
    icon: 'simple-icons:x',
    markIsName: true,
  },
  {
    label: 'GitHub',
    handle: '@hadronomy',
    href: 'https://github.com/hadronomy',
    icon: 'simple-icons:github',
  },
  {
    label: 'LinkedIn',
    handle: '/in/hadronomy',
    href: 'https://linkedin.com/in/hadronomy',
    icon: 'simple-icons:linkedin',
  },
];
