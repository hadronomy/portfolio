import {
  Document,
  Font,
  Image,
  Link,
  Page,
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
      name: 'Powerful Design System',
      description:
        'Figma UI Kit and Design System targeting a wide variety of use cases.',
      url: 'https://figma.com',
    },
    {
      name: 'Modern Website',
      description:
        'Powerful website + dashboard template for your next Chakra UI project.',
      url: 'https://ui-8.net',
    },
  ],
  experience: [
    {
      title: 'Computer Science Student',
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
    },
  ],
  education: [
    {
      course: 'Computer Science Degree',
      institution: 'Universidad de La Laguna',
      date: '2021 - 2025',
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
                  <View style={styles.projectCard}>
                    <View style={styles.projectIcon} />
                    <View style={styles.projectContent}>
                      <Text style={styles.projectName}>{project.name}</Text>
                      <Text style={styles.projectDescription}>
                        {project.description}
                      </Text>
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
    backgroundColor: '#6f42c1',
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
});
