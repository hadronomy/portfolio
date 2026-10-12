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
      'Desarrollo software en todo el stack, desde sistemas de bajo nivel hasta interfaces de usuario. Me interesa especialmente la IA basada en agentes y publico la mayor parte de mi trabajo como código abierto.',
    highlights: [
      'Desarrollo el sistema de recuperación de información de Canary con documentos del BOE, control de vigencia y embeddings.',
      'Desarrollo Inari para conectar hardware y funcionar sin conexión, con inscripción de dispositivos y un controlador en Rust.',
      'Desarrollo las herramientas y el emulador de RAM. Implementé algoritmos de planificación de rutas en VRPT-SWTS.',
      'Creé Autographa y King of the Hollywood Hill. Ayudo a otros desarrolladores a tomar decisiones de arquitectura de software.',
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
      development: 'Desarrollo',
      tools: 'Herramientas e infraestructura',
    },
    languages: { spanish: 'Español', english: 'Inglés', native: 'Nativo' },
    projectDescriptions: {
      inari: 'Plataforma local-first para dispositivos, con uso sin conexión.',
      autographa: 'Herramienta para crear firmas animadas.',
      canary: 'Asistente jurídico de IA basado en agentes.',
      ram: 'Herramientas y emulador para programar en RAM.',
      vrpt: 'Algoritmos de planificación de rutas de vehículos con transbordos.',
      movies: 'Sistema de recomendación interactivo para descubrir películas.',
    },
    metadataDescription:
      'Experiencia, proyectos, formación y competencias técnicas.',
  },
} satisfies Record<Locale, CVCopy>;
