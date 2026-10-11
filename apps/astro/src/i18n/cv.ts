import { engineeringExperience } from '../lib/profile';
import type { Locale } from './locales';

export const cvProjects = [
  { id: 'inari', name: 'Inari', url: 'https://github.com/hadronomy/inari' },
  {
    id: 'autographa',
    name: 'Autographa',
    url: 'https://github.com/hadronomy/autographa',
  },
  { id: 'canary', name: 'Canary', url: 'https://github.com/hadronomy/canary' },
  { id: 'ram', name: 'RAM Language', url: 'https://github.com/hadronomy/ram' },
  {
    id: 'vrpt',
    name: 'VRPT-SWTS',
    url: 'https://github.com/hadronomy/VRPT-SWTS',
  },
  {
    id: 'movies',
    name: 'King of the Hollywood Hill',
    url: 'https://github.com/SistemasInteligentesHL/Proyecto-Sistemas-Inteligentes',
  },
] as const;

type ProjectId = (typeof cvProjects)[number]['id'];

type CVCopy = {
  folio: string;
  portraitAlt: string;
  engagement: string;
  summary: string;
  highlights: readonly string[];
  location: string;
  educationTitle: string;
  labels: Record<
    | 'location'
    | 'contact'
    | 'online'
    | 'profile'
    | 'experience'
    | 'projects'
    | 'skills'
    | 'education'
    | 'languages',
    string
  >;
  skillGroups: Record<'development' | 'tools', string>;
  languages: { spanish: string; english: string; native: string };
  projectDescriptions: Record<ProjectId, string>;
  metadataDescription: string;
};

export const cvCopy = {
  en: {
    folio: 'Curriculum vitae',
    portraitAlt: 'Portrait of Pablo Hernández',
    engagement: engineeringExperience.engagement,
    summary: engineeringExperience.description,
    highlights: engineeringExperience.highlights,
    location: 'Canary Islands, Spain',
    educationTitle: 'B.S. in Computer Engineering',
    labels: {
      location: 'Location',
      contact: 'Contact',
      online: 'Online',
      profile: 'Profile',
      experience: 'Experience',
      projects: 'Projects',
      skills: 'Skills',
      education: 'Education',
      languages: 'Languages',
    },
    skillGroups: {
      development: 'Development',
      tools: 'Tools & infrastructure',
    },
    languages: { spanish: 'Spanish', english: 'English', native: 'Native' },
    projectDescriptions: {
      inari:
        'A local-first platform for device enrollment and offline operation.',
      autographa: 'A tool to generate animated signatures.',
      canary: 'An agentic legal assistant.',
      ram: 'A Random Access Machine language and emulator.',
      vrpt: 'Algorithms for the Vehicle Routing Problem with Transshipments.',
      movies: 'An interactive movie recommendation system.',
    },
    metadataDescription:
      'Experience, projects, education, and technical skills.',
  },
  es: {
    folio: 'Currículum',
    portraitAlt: 'Retrato de Pablo Hernández',
    engagement: 'Por cuenta propia',
    summary:
      'Desarrollo software en todo el stack, desde sistemas bare-metal hasta el frontend. Me interesa crear sistemas de agentic AI y comparto mi trabajo en proyectos open source.',
    highlights: [
      'Desarrollo el retrieval pipeline de Canary con documentos del BOE, control de vigencia y vector embeddings.',
      'Desarrollo Inari para conectar hardware y operar offline, con device enrollment y un controller en Rust.',
      'Desarrollo tooling y el emulator de RAM. Implementé algoritmos de vehicle routing en VRPT-SWTS.',
      'Creé Autographa y King of the Hollywood Hill. Ayudo a otros developers con decisiones de software architecture.',
    ],
    location: 'Islas Canarias, España',
    educationTitle: 'Ingeniería Informática',
    labels: {
      location: 'Ubicación',
      contact: 'Contacto',
      online: 'Enlaces',
      profile: 'Perfil profesional',
      experience: 'Experiencia',
      projects: 'Proyectos',
      skills: 'Competencias',
      education: 'Formación',
      languages: 'Idiomas',
    },
    skillGroups: {
      development: 'Development',
      tools: 'Tools & infrastructure',
    },
    languages: { spanish: 'Español', english: 'Inglés', native: 'Nativo' },
    projectDescriptions: {
      inari:
        'Plataforma local-first con device enrollment y funcionamiento offline.',
      autographa: 'Herramienta para crear animated signatures.',
      canary: 'Software de agentic AI para consultar legislación española.',
      ram: 'Language tooling y emulator para programar en RAM.',
      vrpt: 'Algoritmos de vehicle routing con transshipments.',
      movies: 'Recommender interactivo para descubrir películas.',
    },
    metadataDescription:
      'Experiencia, proyectos, formación y competencias técnicas.',
  },
} satisfies Record<Locale, CVCopy>;
