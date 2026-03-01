import fs from 'node:fs';
import path from 'node:path';

import {
  Document,
  Font,
  Image,
  Link,
  Page,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer';

export interface CVData {
  personalInfo: {
    name: string;
    title: string;
    email: string;
    phone: string;
    location: string;
    website?: string;
    profileImage?: string;
    quote?: string;
    quoteAuthor?: string;
  };
  socials: Array<{
    platform: string;
    handle: string;
    url?: string;
  }>;
  languages: Array<{
    name: string;
    level: string;
    flag?: string;
  }>;
  projects: Array<{
    name: string;
    description: string;
    url: string;
  }>;
  experience: Array<{
    title: string;
    company: string;
    duration: string;
    location: string;
    description: string;
  }>;
  education: Array<{
    course: string;
    institution: string;
    date: string;
  }>;
  skills: {
    development: string[];
    tools: string[];
  };
}

const defaultData: CVData = {
  personalInfo: {
    name: 'Pablo Hernandez',
    title: 'Software Developer',
    email: 'hadronomy@gmail.com',
    phone: '(+34) 608 73 31 18',
    location: 'Canary Islands, Spain',
    website: 'https://hadronomy.com',
    quote: "Code is like humor. When you have to explain it, it's bad.",
    quoteAuthor: 'Cory House',
  },
  socials: [{ platform: 'Github', handle: '@hadronomy' }],
  languages: [
    { name: 'Spanish', level: 'Native' },
    { name: 'English', level: 'C1' },
  ],
  projects: [
    {
      name: 'RAM Language',
      description: 'RAM (Random Access Machine) language and emulator.',
      url: 'https://github.com/hadronomy/ram',
    },
    {
      name: 'VRPT-SWTS',
      description:
        'This project implements algorithms for the Vehicle Routing Problem with Transshipments for Solid Waste Collection with Transfer Stations (VRPT-SWTS).',
      url: 'https://github.com/hadronomy/VRPT-SWTS',
    },
  ],
  experience: [
    {
      title: 'B.S. in Computer Engineering Student',
      company: 'Universidad de La Laguna',
      duration: '2021 - 2025',
      location: 'Canary Islands, Spain',
      description:
        'Studied advanced algorithms, software architecture, and full-stack development. Participated in coding competitions and led student projects.',
    },
    {
      title: 'Self-Taught Programmer',
      company: 'Independent',
      duration: '2014 - Present',
      location: 'Global',
      description:
        'Over 10 years of continuous learning across all fields of programming. From web development to systems programming, exploring various languages, frameworks, and paradigms through personal projects and open-source contributions.',
    },
  ],
  education: [
    {
      course: 'B.S. in Computer Engineering (Grado en Ingenieria Informatica)',
      institution: 'Universidad de La Laguna',
      date: '2021 - Present',
    },
  ],
  skills: {
    development: [
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
    ],
    tools: [
      'Docker',
      'PostgreSQL',
      'Git',
      'Linux',
      'Kubernetes',
      'Prisma',
      'Vite',
      'Tauri',
    ],
  },
};

const COLORS = {
  bg: '#F7F5F2',
  bgAlt: '#EBE8E0',
  border: '#D6D3CD',
  textMain: '#1A1A1A',
  textMuted: '#666666',
  accent: '#0033FF',
};

const PDF_FONTS_DIR = path.resolve(process.cwd(), 'src/assets/pdf-fonts');

const FONT_FILES = {
  spaceGrotesk300: path.join(PDF_FONTS_DIR, 'SpaceGrotesk-Light.ttf'),
  spaceGrotesk400: path.join(PDF_FONTS_DIR, 'SpaceGrotesk-Regular.ttf'),
  spaceGrotesk700: path.join(PDF_FONTS_DIR, 'SpaceGrotesk-Bold.ttf'),
  dmSans400: path.join(PDF_FONTS_DIR, 'DMSans-Regular.ttf'),
  dmSans700: path.join(PDF_FONTS_DIR, 'DMSans-Bold.ttf'),
  geistMono400: path.join(PDF_FONTS_DIR, 'GeistMono-Regular.ttf'),
  geistMono700: path.join(PDF_FONTS_DIR, 'GeistMono-Bold.ttf'),
};

let fontsRegistered = false;

function ensureFontsRegistered() {
  if (fontsRegistered) return;

  const readFont = (filePath: string) => filePath;

  for (const [key, filePath] of Object.entries(FONT_FILES)) {
    if (!fs.existsSync(filePath)) {
      throw new Error(
        `Missing PDF font file (${key}): ${filePath}. Run \`bun run fonts:download\`.`,
      );
    }
  }

  Font.register({
    family: 'Space Grotesk',
    fonts: [
      { src: readFont(FONT_FILES.spaceGrotesk300), fontWeight: 300 },
      { src: readFont(FONT_FILES.spaceGrotesk400), fontWeight: 400 },
      { src: readFont(FONT_FILES.spaceGrotesk700), fontWeight: 700 },
    ],
  });

  Font.register({
    family: 'DM Sans',
    fonts: [
      { src: readFont(FONT_FILES.dmSans400), fontWeight: 400 },
      { src: readFont(FONT_FILES.dmSans700), fontWeight: 700 },
    ],
  });

  Font.register({
    family: 'Geist Mono',
    fonts: [
      { src: readFont(FONT_FILES.geistMono400), fontWeight: 400 },
      { src: readFont(FONT_FILES.geistMono700), fontWeight: 700 },
    ],
  });

  Font.registerHyphenationCallback((word) => [word]);
  fontsRegistered = true;
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: COLORS.bg,
    padding: 18,
    fontFamily: 'DM Sans',
    color: COLORS.textMain,
    flexDirection: 'column',
  },
  metaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  metaText: {
    fontFamily: 'Geist Mono',
    fontSize: 6,
    color: COLORS.textMuted,
    letterSpacing: 1,
  },
  gridContainer: {
    flex: 1,
    border: `1pt solid ${COLORS.border}`,
    flexDirection: 'column',
  },
  row: {
    flexDirection: 'row',
  },
  borderBottom: {
    borderBottom: `1pt solid ${COLORS.border}`,
  },
  borderTop: {
    borderTop: `1pt solid ${COLORS.border}`,
  },
  borderRight: {
    borderRight: `1pt solid ${COLORS.border}`,
  },
  colFlex: {
    flex: 1,
    flexDirection: 'column',
  },
  headerBlock: {
    padding: 10,
    flex: 1,
    justifyContent: 'center',
    backgroundColor: COLORS.bg,
  },
  nameFirst: {
    fontFamily: 'Space Grotesk',
    fontWeight: 300,
    fontSize: 42,
    letterSpacing: -1.5,
    lineHeight: 1,
  },
  nameLast: {
    fontFamily: 'Space Grotesk',
    fontWeight: 700,
    fontSize: 42,
    letterSpacing: -1.5,
    lineHeight: 1,
  },
  roleTitle: {
    fontFamily: 'Geist Mono',
    fontWeight: 700,
    fontSize: 10,
    color: COLORS.accent,
    marginTop: 12,
    letterSpacing: 1.5,
  },
  photoContainer: {
    width: 140,
    height: 140,
  },
  profileImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  infoRow: {
    backgroundColor: COLORS.bgAlt,
    flexDirection: 'row',
  },
  infoBlock: {
    padding: 8,
    paddingLeft: 16,
    justifyContent: 'center',
  },
  infoLabel: {
    fontFamily: 'Geist Mono',
    fontSize: 6,
    fontWeight: 700,
    color: COLORS.textMuted,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  infoValue: {
    fontFamily: 'Geist Mono',
    fontSize: 8,
    color: COLORS.textMain,
  },
  link: {
    fontFamily: 'Geist Mono',
    fontSize: 8,
    color: COLORS.textMain,
    textDecoration: 'none',
  },
  section: {
    padding: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 16,
  },
  sectionTitle: {
    fontFamily: 'Space Grotesk',
    fontWeight: 700,
    fontSize: 14,
    letterSpacing: 1.2,
    color: COLORS.textMain,
  },
  sectionMeta: {
    fontFamily: 'Geist Mono',
    fontSize: 8,
    color: COLORS.border,
  },
  aboutText: {
    fontSize: 10,
    lineHeight: 1.5,
    color: COLORS.textMuted,
  },
  experienceList: {
    flexDirection: 'column',
    gap: 16,
  },
  experienceItem: {
    flexDirection: 'column',
  },
  expHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  expTitle: {
    fontFamily: 'Space Grotesk',
    fontWeight: 700,
    fontSize: 12,
  },
  expDuration: {
    fontFamily: 'Geist Mono',
    fontSize: 8,
    color: COLORS.accent,
  },
  expCompany: {
    fontFamily: 'Geist Mono',
    fontSize: 8,
    color: COLORS.textMuted,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  expDescription: {
    fontSize: 9,
    lineHeight: 1.5,
    color: COLORS.textMuted,
  },
  rightColumn: {
    width: 220,
    flexDirection: 'column',
  },
  skillCategory: {
    fontFamily: 'Geist Mono',
    fontWeight: 700,
    fontSize: 7,
    marginBottom: 8,
    color: COLORS.textMuted,
    letterSpacing: 1,
  },
  skillTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  skillTag: {
    fontFamily: 'Geist Mono',
    fontSize: 7,
    backgroundColor: '#FFFFFF',
    color: COLORS.textMain,
    paddingTop: 4,
    paddingBottom: 2,
    paddingHorizontal: 6,
    borderRadius: 3,
    borderTop: `1pt solid ${COLORS.border}`,
    borderLeft: `1pt solid ${COLORS.border}`,
    borderRight: `1pt solid ${COLORS.border}`,
    borderBottom: '3pt solid #BEBBB4',
    textTransform: 'uppercase',
  },
  projItem: {
    marginBottom: 8,
  },
  projHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  projName: {
    fontFamily: 'Space Grotesk',
    fontWeight: 700,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  projLink: {
    fontFamily: 'Geist Mono',
    fontSize: 7,
    color: COLORS.accent,
    textDecoration: 'none',
  },
  projDesc: {
    fontSize: 9,
    lineHeight: 1.4,
    color: COLORS.textMuted,
  },
  eduItem: {
    marginBottom: 12,
  },
  eduCourse: {
    fontFamily: 'Space Grotesk',
    fontWeight: 700,
    fontSize: 10,
    marginBottom: 4,
    lineHeight: 1.3,
  },
  eduInstitution: {
    fontFamily: 'DM Sans',
    fontSize: 9,
    color: COLORS.textMuted,
    marginBottom: 4,
  },
  eduDate: {
    fontFamily: 'Geist Mono',
    fontSize: 8,
    color: COLORS.accent,
  },
  langItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 6,
  },
  langName: {
    fontFamily: 'DM Sans',
    fontWeight: 700,
    fontSize: 9,
    color: COLORS.textMain,
  },
  langLevel: {
    fontFamily: 'Geist Mono',
    fontSize: 7,
    color: COLORS.textMuted,
  },
});

export function CVDocument({ data = defaultData }: { data?: CVData }) {
  ensureFontsRegistered();

  const nameParts = data.personalInfo.name.split(' ');
  const firstName = nameParts[0].toUpperCase();
  const lastName = nameParts.slice(1).join(' ').toUpperCase();

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.metaHeader} fixed>
          <Text
            style={styles.metaText}
          >{`SYS.DOC.CV :: ${new Date().getFullYear()}`}</Text>
          <Text style={styles.metaText}>RENDERED: RUNTIME</Text>
        </View>

        <View style={styles.gridContainer}>
          <View style={styles.row}>
            <View style={[styles.headerBlock, styles.borderRight]}>
              <Text style={styles.nameFirst}>{firstName}</Text>
              <Text style={styles.nameLast}>{lastName}</Text>
              <Text
                style={styles.roleTitle}
              >{`-- ${data.personalInfo.title.toUpperCase()}`}</Text>
            </View>
            <View style={styles.photoContainer}>
              <Image
                style={styles.profileImage}
                src={
                  data.personalInfo.profileImage ||
                  'https://github.com/hadronomy.png'
                }
              />
            </View>
          </View>

          <View style={[styles.infoRow, styles.borderTop, styles.borderBottom]}>
            <View style={[styles.infoBlock, styles.borderRight, { flex: 2 }]}>
              <Text style={styles.infoLabel}>LOCATION</Text>
              <Text style={styles.infoValue}>{data.personalInfo.location}</Text>
            </View>
            <View style={[styles.infoBlock, styles.borderRight, { flex: 2 }]}>
              <Text style={styles.infoLabel}>CONTACT</Text>
              <Text style={styles.infoValue}>{data.personalInfo.email}</Text>
              <Text style={[styles.infoValue, { marginTop: 2 }]}>
                {data.personalInfo.phone}
              </Text>
            </View>
            <View style={[styles.infoBlock, styles.borderRight, { flex: 1.5 }]}>
              <Text style={styles.infoLabel}>WEBSITE</Text>
              <Link src={data.personalInfo.website || ''} style={styles.link}>
                {data.personalInfo.website?.replace('https://', '')}
              </Link>
            </View>
            <View style={[styles.infoBlock, { flex: 1.5 }]}>
              <Text style={styles.infoLabel}>NETWORK</Text>
              <Link
                src={`https://github.com/${(data.socials[0]?.handle || '@hadronomy').replace('@', '')}`}
                style={styles.link}
              >
                {data.socials[0]?.platform || 'Github'} /{' '}
                {data.socials[0]?.handle || '@hadronomy'}
              </Link>
            </View>
          </View>

          <View style={[styles.row, { flex: 1 }]}>
            <View style={[styles.colFlex, styles.borderRight]}>
              <View style={[styles.section, styles.borderBottom]}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>ABSTRACT</Text>
                  <Text style={styles.sectionMeta}>[01]</Text>
                </View>
                <Text style={styles.aboutText}>
                  Passionate software developer with over 10 years of
                  self-directed learning and hands-on experience across multiple
                  programming languages and technologies. Currently pursuing a
                  Computer Science degree while maintaining expertise in
                  full-stack development, systems programming, and modern
                  frameworks.
                </Text>
              </View>

              <View style={[styles.section, styles.borderBottom]}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>EXPERIENCE</Text>
                  <Text style={styles.sectionMeta}>[02]</Text>
                </View>
                <View style={styles.experienceList}>
                  {data.experience.map((exp, i) => (
                    <View key={i} style={styles.experienceItem} wrap={false}>
                      <View style={styles.expHeader}>
                        <Text style={styles.expTitle}>{exp.title}</Text>
                        <Text style={styles.expDuration}>{exp.duration}</Text>
                      </View>
                      <Text style={styles.expCompany}>
                        {exp.company} - {exp.location}
                      </Text>
                      <Text style={styles.expDescription}>
                        {exp.description}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={[styles.section, { flex: 1 }]}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>PROJECTS</Text>
                  <Text style={styles.sectionMeta}>[03]</Text>
                </View>
                {data.projects.map((proj, i) => (
                  <View key={i} style={styles.projItem} wrap={false}>
                    <View style={styles.projHeader}>
                      <Text style={styles.projName}>{proj.name}</Text>
                      <Link src={proj.url} style={styles.projLink}>
                        [ VIEW ]
                      </Link>
                    </View>
                    <Text style={styles.projDesc}>{proj.description}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.rightColumn}>
              <View style={[styles.section, styles.borderBottom]}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>SKILLS</Text>
                  <Text style={styles.sectionMeta}>[04]</Text>
                </View>
                <Text style={styles.skillCategory}>DEVELOPMENT</Text>
                <View style={styles.skillTags}>
                  {data.skills.development.map((skill, i) => (
                    <Text key={i} style={styles.skillTag}>
                      {skill}
                    </Text>
                  ))}
                </View>
                <Text style={[styles.skillCategory, { marginTop: 8 }]}>
                  TOOLS
                </Text>
                <View style={styles.skillTags}>
                  {data.skills.tools.map((tool, i) => (
                    <Text key={i} style={styles.skillTag}>
                      {tool}
                    </Text>
                  ))}
                </View>
              </View>

              <View style={[styles.section, { flex: 1 }]}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>EDUCATION</Text>
                  <Text style={styles.sectionMeta}>[05]</Text>
                </View>
                {data.education.map((edu, i) => (
                  <View key={i} style={styles.eduItem} wrap={false}>
                    <Text style={styles.eduCourse}>{edu.course}</Text>
                    <Text style={styles.eduInstitution}>{edu.institution}</Text>
                    <Text style={styles.eduDate}>{edu.date}</Text>
                  </View>
                ))}

                <View style={[styles.sectionHeader, { marginTop: 16 }]}>
                  <Text style={styles.sectionTitle}>LANGUAGES</Text>
                  <Text style={styles.sectionMeta}>[06]</Text>
                </View>
                {data.languages.map((lang, i) => (
                  <View key={i} style={styles.langItem} wrap={false}>
                    <Text style={styles.langName}>{lang.name}</Text>
                    <Text style={styles.langLevel}>{lang.level}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
