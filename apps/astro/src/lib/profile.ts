/**
 * Every fact the homepage states about Pablo, in one place. Sections read from
 * here rather than inlining copy, so correcting a date or a handle is one edit
 * and never leaves two sections disagreeing.
 */

export const profile = {
  name: 'Pablo Hernández',
  role: 'Full-Stack Engineer',
  /** Year the "10+ years" of building started, shown as EST. in the header. */
  established: 2003,
  location: 'Canary Islands, Spain',
  /** Santa Cruz de Tenerife, for the footer's current conditions. */
  coordinates: { latitude: 28.4636, longitude: -16.2518 },
  email: 'hadronomy@gmail.com',
  avatar: 'https://github.com/hadronomy.png',
  intro:
    'I build across the whole stack, from bare-metal systems to the interfaces on top of them, with a particular interest in agentic AI. Most of my work is open source.',
} as const;

export type ExperienceEntry = {
  period: string;
  role: string;
  organisation: string;
  /** Icon set name for astro-icon, or `monogram` / `ull` for an in-house mark. */
  mark: string;
  description: string;
  /** Makes the company chip a link. */
  url?: string;
  /**
   * Screenshot of `url` shown in the cursor on hover. Captured from the live
   * page rather than mocked, so it stays honest — regenerate it when the page
   * it points at changes.
   */
  preview?: string;
};

export const experience: ExperienceEntry[] = [
  {
    period: '2014 — NOW',
    role: 'Independent developer',
    organisation: 'Independent',
    mark: 'monogram',
    description:
      'Building production tooling and libraries across systems programming, compilers and the web. Ten years of shipping without a manager.',
  },
  {
    period: '2021 — NOW',
    role: 'B.S. Computer Engineering',
    organisation: 'Universidad de La Laguna',
    mark: 'ull',
    description:
      'Algorithms, software architecture and distributed systems. Led student project teams and competed in algorithm contests.',
    url: 'https://www.ull.es',
    preview: '/previews/ull.webp',
  },
  {
    period: '2014 — NOW',
    role: 'Open source',
    organisation: 'GitHub',
    mark: 'simple-icons:github',
    description:
      'Autographa, Canary, a RAM machine language and emulator, and solvers for vehicle routing with transshipments.',
    url: 'https://github.com/hadronomy',
    preview: '/previews/github.webp',
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

export const socials = [
  {
    label: 'Email',
    handle: profile.email,
    href: `mailto:${profile.email}`,
    icon: 'tabler:mail',
  },
  {
    label: 'GitHub',
    handle: '@hadronomy',
    href: 'https://github.com/hadronomy',
    icon: 'simple-icons:github',
  },
  {
    label: 'X',
    handle: '@hadronomy',
    href: 'https://x.com/hadronomy',
    icon: 'simple-icons:x',
  },
  {
    label: 'LinkedIn',
    handle: '/in/hadronomy',
    href: 'https://linkedin.com/in/hadronomy',
    icon: 'simple-icons:linkedin',
  },
] as const;
