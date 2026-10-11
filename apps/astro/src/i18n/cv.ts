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
      'Desarrollo aplicaciones web, API, búsqueda con IA y herramientas de programación, además de software para gestionar dispositivos.',
    highlights: [
      'Implemento en Canary búsquedas sobre documentos del BOE con control de vigencia e indexación vectorial.',
      'Desarrollo Inari para gestionar dispositivos sin conexión, con registro centralizado y un controlador en Rust.',
      'Creo herramientas y un emulador para RAM. Implemento algoritmos de rutas con transbordos en VRPT-SWTS.',
      'Creo herramientas de firmas y recomendación de películas, y asesoro a otros desarrolladores en arquitectura.',
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
      inari: 'Software de gestión de dispositivos que funciona sin conexión.',
      autographa: 'Herramienta para generar firmas animadas.',
      canary: 'Asistente de IA para consultar legislación española.',
      ram: 'Lenguaje de programación y emulador del modelo RAM.',
      vrpt: 'Algoritmos de rutas con transbordos para recoger residuos.',
      movies: 'Aplicación interactiva de recomendación de películas.',
    },
    metadataDescription:
      'Experiencia, proyectos, formación y competencias técnicas.',
  },
} satisfies Record<Locale, CVCopy>;
