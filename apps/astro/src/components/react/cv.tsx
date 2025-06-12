import {
  Document,
  Font,
  Image,
  Link,
  Page,
  Path,
  Polygon,
  StyleSheet,
  Svg,
  Text,
  View,
} from '@react-pdf/renderer';

// Register fonts
Font.register({
  family: 'Inter',
  fonts: [
    {
      src: 'https://fonts.gstatic.com/s/inter/v19/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZg.ttf',
      fontStyle: 'normal',
    },
    {
      src: 'https://fonts.gstatic.com/s/inter/v19/UcCM3FwrK3iLTcvneQg7Ca725JhhKnNqk4j1ebLhAm8SrXTc2dtRipWA.ttf',
      fontStyle: 'italic',
    },
  ],
});

interface CVData {
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
    icon?: string;
  }>;
  experience: Array<{
    title: string;
    company: string;
    duration: string;
    location: string;
    description: string;
    logo?: string;
    icon?: React.ComponentType<{ style?: Svg['props']['style'] }>;
  }>;
  education: Array<{
    course: string;
    institution: string;
    date: string;
    logo?: string;
    icon?: React.ComponentType<{ style?: Svg['props']['style'] }>;
  }>;
  skills: {
    development: string[];
    tools: string[];
  };
}

const defaultData: CVData = {
  personalInfo: {
    name: 'Pablo Hernández',
    title: 'Software Developer',
    email: 'hadronomy@gmail.com',
    phone: '(+32) 608 73 31 18',
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
      title:
        'B.S. in Computer Engineering Student (Grado en Ingeniería Informática)',
      company: 'Universidad de La Laguna',
      duration: '2021 - 2025',
      location: 'Canary Islands, Spain',
      description:
        'Studied advanced algorithms, software architecture, and full-stack development. Participated in coding competitions and led student projects.',
      icon: UllIcon,
    },
    {
      title: 'Self-Taught Programmer',
      company: 'Self',
      duration: '2014 - Present',
      location: 'Various',
      description:
        'Over 10 years of continuous learning across all fields of programming. From web development to systems programming, exploring various languages, frameworks, and paradigms through personal projects and open-source contributions.',
      icon: GithubIcon,
    },
  ],
  education: [
    {
      course: 'B.S. in Computer Engineering (Grado en Ingeniería Informática)',
      institution: 'Universidad de La Laguna',
      date: '2021 - Present',
      icon: UllIcon,
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

export function UllIcon(props: { style?: Svg['props']['style'] }) {
  return (
    <Svg
      id="Layer_1"
      width="1000px"
      height="783.73px"
      viewBox="0 0 1000 783.73"
      enable-background="new 0 0 1000 783.73"
      {...props}
    >
      <Polygon
        fill="#57068C"
        points="746.737,530.964 746.737,4.073 736.357,4.073 494.495,235.557 494.495,530.964 257.835,530.964 
	257.835,4.073 245.727,4.073 5.607,235.557 5.607,777.992 205.979,777.992 257.835,777.992 494.495,549.968 494.495,777.992 
	694.894,777.992 746.737,777.992 993.764,541.29 993.764,530.964 "
      />
    </Svg>
  );
}

export function GithubIcon(props: { style?: Svg['props']['style'] }) {
  return (
    <Svg
      width="1024"
      height="1024"
      viewBox="0 0 1024 1024"
      fill="none"
      {...props}
    >
      <Path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M8 0C3.58 0 0 3.58 0 8C0 11.54 2.29 14.53 5.47 15.59C5.87 15.66 6.02 15.42 6.02 15.21C6.02 15.02 6.01 14.39 6.01 13.72C4 14.09 3.48 13.23 3.32 12.78C3.23 12.55 2.84 11.84 2.5 11.65C2.22 11.5 1.82 11.13 2.49 11.12C3.12 11.11 3.57 11.7 3.72 11.94C4.44 13.15 5.59 12.81 6.05 12.6C6.12 12.08 6.33 11.73 6.56 11.53C4.78 11.33 2.92 10.64 2.92 7.58C2.92 6.71 3.23 5.99 3.74 5.43C3.66 5.23 3.38 4.41 3.82 3.31C3.82 3.31 4.49 3.1 6.02 4.13C6.66 3.95 7.34 3.86 8.02 3.86C8.7 3.86 9.38 3.95 10.02 4.13C11.55 3.09 12.22 3.31 12.22 3.31C12.66 4.41 12.38 5.23 12.3 5.43C12.81 5.99 13.12 6.7 13.12 7.58C13.12 10.65 11.25 11.33 9.47 11.53C9.76 11.78 10.01 12.26 10.01 13.01C10.01 14.08 10 14.94 10 15.21C10 15.42 10.15 15.67 10.55 15.59C13.71 14.53 16 11.53 16 8C16 3.58 12.42 0 8 0Z"
        transform="scale(64)"
        fill="#0000"
      />
    </Svg>
  );
}

export function CVDocument({ data = defaultData }: { data?: CVData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Left Sidebar */}
        <View style={styles.sidebar}>
          {/* Profile Section */}
          <View style={styles.profileSection}>
            <View style={styles.profileImageContainer}>
              <Image
                style={styles.profileImagePlaceholder}
                src="https://github.com/hadronomy.png"
              />
            </View>
            <Text style={styles.name}>{data.personalInfo.name}</Text>
            <Text style={styles.title}>{data.personalInfo.title}</Text>
          </View>

          {/* Quote */}
          {data.personalInfo.quote && (
            <View style={styles.quoteSection}>
              <Text style={styles.quote}>"{data.personalInfo.quote}"</Text>
              <Text style={styles.quoteAuthor}>
                {data.personalInfo.quoteAuthor}
              </Text>
            </View>
          )}

          {/* Description */}
          <View style={styles.descriptionSection}>
            <Text style={styles.descriptionText}>
              Proven ability to quickly adapt to new technologies and deliver
              innovative solutions. Seeking opportunities to contribute
              technical expertise and problem-solving skills to challenging
              projects in a professional environment.
            </Text>
          </View>

          {/* Contact */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Email</Text>
            <Text style={styles.contactText}>{data.personalInfo.email}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Website</Text>
            <Text style={styles.contactText}>{data.personalInfo.website}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Phone</Text>
            <Text style={styles.contactText}>{data.personalInfo.phone}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Address</Text>
            <Text style={styles.contactText}>{data.personalInfo.location}</Text>
          </View>

          {/* Socials */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Socials</Text>
            {data.socials.map((social) => (
              <View
                key={`${social.platform}-${social.handle}`}
                style={styles.socialItem}
              >
                <Text style={styles.socialPlatform}>{social.platform}</Text>
                <Text style={styles.socialHandle}>{social.handle}</Text>
              </View>
            ))}
          </View>

          {/* Languages */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Languages</Text>
            {data.languages.map((language) => (
              <View key={language.name} style={styles.languageItem}>
                <Text style={styles.languageName}>{language.name}</Text>
                <Text style={styles.languageLevel}>{language.level}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Main Content */}
        <View style={styles.main}>
          {/* Self description */}
          <View style={styles.mainSection}>
            <Text style={styles.mainSectionTitle}>About</Text>
            <Text style={styles.aboutText}>
              Passionate software developer with over 10 years of self-directed
              learning and hands-on experience across multiple programming
              languages and technologies. Currently pursuing a Computer Science
              degree while maintaining expertise in full-stack development,
              systems programming, and modern frameworks.
            </Text>
          </View>
          {/* Latest Projects */}
          <View style={styles.mainSection}>
            <Text style={styles.mainSectionTitle}>Latest projects</Text>
            <View style={styles.projectsGrid}>
              {data.projects.map((project) => (
                <Link
                  key={project.name}
                  src={project.url}
                  style={styles.projectCardLink}
                >
                  <View style={[styles.projectCard, { minHeight: 100 }]}>
                    <GithubIcon style={styles.projectIcon} />
                    <View
                      style={[
                        styles.projectContent,
                        { justifyContent: 'space-between' },
                      ]}
                    >
                      <View>
                        <Text style={styles.projectName}>{project.name}</Text>
                        <Text style={styles.projectDescription}>
                          {project.description}
                        </Text>
                      </View>
                      <Text style={styles.projectUrl}>{project.url}</Text>
                    </View>
                  </View>
                </Link>
              ))}
            </View>
          </View>

          {/* Experience */}
          <View style={styles.mainSection}>
            <Text style={styles.mainSectionTitle}>Experience</Text>
            <View style={styles.timelineContainer}>
              {/* Timeline background line */}
              <View style={styles.timelineBackgroundLine} />
              {data.experience.map((exp) => (
                <View
                  key={`${exp.company}-${exp.title}-${exp.duration}`}
                  style={styles.timelineItem}
                >
                  <View style={styles.timelineLeft}>
                    <View style={styles.timelineDotContainer}>
                      <View style={styles.timelineDotBackground} />
                      <View style={styles.timelineDot} />
                    </View>
                  </View>
                  <View style={styles.experienceItem}>
                    <View style={styles.experienceHeader}>
                      {exp.icon ? (
                        <exp.icon style={styles.companyLogo} />
                      ) : (
                        <View
                          style={[
                            styles.companyLogo,
                            { backgroundColor: '#e9ecef' },
                          ]}
                        />
                      )}
                      <View style={styles.experienceDetails}>
                        <Text style={styles.experienceTitle}>{exp.title}</Text>
                        <Text style={styles.experienceCompany}>
                          {exp.company}
                        </Text>
                      </View>
                      <View style={styles.experienceMetadata}>
                        <Text style={styles.experienceDuration}>
                          {exp.duration}
                        </Text>
                        <Text style={styles.experienceLocation}>
                          {exp.location}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.experienceDescription}>
                      {exp.description}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Education */}
          <View style={styles.mainSection}>
            <Text style={styles.mainSectionTitle}>Education</Text>
            <View style={styles.timelineContainer}>
              {/* Timeline background line */}
              <View style={styles.timelineBackgroundLine} />
              {data.education.map((edu) => (
                <View
                  key={`${edu.institution}-${edu.course}-${edu.date}`}
                  style={styles.timelineItem}
                >
                  <View style={styles.timelineLeft}>
                    <View style={styles.timelineDotContainer}>
                      <View style={styles.timelineDotBackground} />
                      <View style={styles.timelineDot} />
                    </View>
                  </View>
                  <View style={styles.educationItem}>
                    <View style={styles.educationHeader}>
                      {edu.icon ? (
                        <edu.icon style={styles.educationLogo} />
                      ) : (
                        <View
                          style={[
                            styles.educationLogo,
                            { backgroundColor: '#e9ecef' },
                          ]}
                        />
                      )}
                      <View style={styles.educationDetails}>
                        <Text style={styles.educationCourse}>{edu.course}</Text>
                        <Text style={styles.educationInstitution}>
                          {edu.institution}
                        </Text>
                      </View>
                      <View style={styles.educationMetadata}>
                        <Text style={styles.educationDate}>{edu.date}</Text>
                      </View>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Skills */}
          <View style={styles.mainSection}>
            <Text style={styles.mainSectionTitle}>Skills</Text>
            <View style={styles.skillsContainer}>
              {Object.entries(data.skills).map(([categoryKey, skillList]) => (
                <View key={categoryKey} style={styles.skillCategory}>
                  <Text style={styles.skillCategoryTitle}>
                    {categoryKey.charAt(0).toUpperCase() + categoryKey.slice(1)}
                  </Text>
                  <View style={styles.skillTags}>
                    {skillList.map((skill) => (
                      <Text key={skill} style={styles.skillTag}>
                        {skill}
                      </Text>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}

const styles = StyleSheet.create({
  page: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    fontFamily: 'Inter',
    fontSize: 8,
  },

  // Sidebar styles
  sidebar: {
    width: '35%',
    backgroundColor: '#f8f9fa',
    padding: 16,
  },

  profileSection: {
    alignItems: 'flex-start',
    marginBottom: 20,
  },

  profileImageContainer: {
    marginBottom: 10,
    width: '100%',
  },

  profileImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#e9ecef',
    objectFit: 'cover',
  },

  name: {
    fontSize: 18,
    fontWeight: 600,
    color: '#212529',
    marginBottom: 2,
  },

  title: {
    fontSize: 11,
    color: '#6f42c1',
    fontWeight: 500,
  },

  descriptionSection: {
    marginBottom: 20,
  },

  descriptionText: {
    fontSize: 9,
    color: '#495057',
    lineHeight: 1.4,
  },

  quoteSection: {
    marginBottom: 20,
    paddingLeft: 12,
    borderLeft: '2px solid #6f42c1',
  },

  quote: {
    fontSize: 9,
    fontStyle: 'italic',
    color: '#495057',
    marginBottom: 4,
    lineHeight: 1.3,
  },

  quoteAuthor: {
    fontSize: 8,
    color: '#6c757d',
  },

  section: {
    marginBottom: 16,
  },

  sectionTitle: {
    fontSize: 10,
    fontWeight: 600,
    color: '#212529',
    marginBottom: 6,
  },

  contactText: {
    fontSize: 8,
    color: '#495057',
    lineHeight: 1.3,
  },

  socialItem: {
    marginBottom: 4,
  },

  socialPlatform: {
    fontSize: 8,
    fontWeight: 500,
    color: '#212529',
  },

  socialHandle: {
    fontSize: 7,
    color: '#6c757d',
  },

  languageItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },

  languageName: {
    fontSize: 8,
    color: '#212529',
    fontWeight: 500,
  },

  languageLevel: {
    fontSize: 7,
    color: '#6c757d',
  },

  // Main content styles
  main: {
    width: '65%',
    padding: 16,
  },

  mainSection: {
    marginBottom: 20,
  },

  mainSectionTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: '#212529',
    marginBottom: 10,
  },

  // Projects
  projectsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  projectCardLink: {
    width: '47%',
    textDecoration: 'none',
  },

  projectCard: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 6,
    padding: 10,
    border: '1px solid #e9ecef',
    width: '100%',
  },

  projectIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
    marginRight: 8,
  },

  projectContent: {
    flex: 1,
  },

  projectName: {
    fontSize: 9,
    fontWeight: 600,
    color: '#212529',
    marginBottom: 2,
  },

  projectDescription: {
    fontSize: 7,
    color: '#6c757d',
    lineHeight: 1.2,
    marginBottom: 4,
  },

  projectUrl: {
    fontSize: 7,
    color: '#6f42c1',
  },

  // Experience
  timelineContainer: {
    position: 'relative',
  },

  timelineBackgroundLine: {
    position: 'absolute',
    left: 9,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: '#e9ecef',
  },

  timelineItem: {
    flexDirection: 'row',
    marginBottom: 16,
    position: 'relative',
  },

  timelineLeft: {
    width: 20,
    alignItems: 'center',
    marginRight: 12,
    position: 'relative',
  },

  timelineDotContainer: {
    position: 'relative',
    width: 14,
    height: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },

  timelineDotBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 14,
    height: 14,
    backgroundColor: '#ffffff',
    borderRadius: 7,
  },

  timelineDot: {
    position: 'absolute',
    top: 3,
    left: 3,
    width: 8,
    height: 8,
    backgroundColor: '#6f42c1',
    borderRadius: 4,
  },

  experienceItem: {
    flex: 1,
  },

  experienceHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },

  companyLogo: {
    width: 24,
    height: 24,
    borderRadius: 4,
    marginRight: 8,
  },

  experienceDetails: {
    flex: 1,
  },

  experienceTitle: {
    fontSize: 10,
    fontWeight: 600,
    color: '#212529',
    marginBottom: 1,
  },

  experienceCompany: {
    fontSize: 9,
    color: '#6f42c1',
    fontWeight: 500,
  },

  experienceMetadata: {
    alignItems: 'flex-end',
  },

  experienceDuration: {
    fontSize: 7,
    color: '#6c757d',
    marginBottom: 1,
  },

  experienceLocation: {
    fontSize: 7,
    color: '#6c757d',
  },

  experienceDescription: {
    fontSize: 8,
    color: '#495057',
    lineHeight: 1.3,
    marginLeft: 32,
  },

  // Education
  educationItem: {
    flex: 1,
  },

  educationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },

  educationLogo: {
    width: 24,
    height: 24,
    borderRadius: 4,
    marginRight: 8,
  },

  educationDetails: {
    flex: 1,
  },

  educationCourse: {
    fontSize: 10,
    fontWeight: 600,
    color: '#212529',
    marginBottom: 1,
  },

  educationInstitution: {
    fontSize: 9,
    color: '#6f42c1',
    fontWeight: 500,
  },

  educationMetadata: {
    alignItems: 'flex-end',
  },

  educationDate: {
    fontSize: 7,
    color: '#6c757d',
  },

  // Skills
  skillsContainer: {
    gap: 10,
  },

  skillCategory: {
    marginBottom: 10,
  },

  skillCategoryTitle: {
    fontSize: 10,
    fontWeight: 600,
    color: '#212529',
    marginBottom: 6,
  },

  skillTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },

  skillTag: {
    fontSize: 7,
    color: '#6f42c1',
    backgroundColor: '#f8f9ff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    border: '1px solid #e0e7ff',
  },

  // About section
  aboutText: {
    fontSize: 10,
    color: '#495057',
    lineHeight: 1.4,
  },
});
