import {
  Document,
  Font,
  Page,
  StyleSheet,
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
  }>;
  education: Array<{
    course: string;
    institution: string;
    date: string;
    logo?: string;
  }>;
  skills: {
    design: string[];
    development: string[];
    tools: string[];
  };
}

const defaultData: CVData = {
  personalInfo: {
    name: 'John Smith',
    title: 'UX Designer',
    email: 'chiara.bianchi@gmail.com',
    phone: '(+39) 333 0123 765',
    location: 'Bologna, Italy',
    website: 'https://aldesign.it',
    quote: 'Every great design begins with an even better story.',
    quoteAuthor: 'Lorinda Mamo',
  },
  socials: [
    { platform: 'Instagram', handle: '@chiara.designs' },
    { platform: 'Dribbble', handle: '@chiara-designs' },
    { platform: 'Twitter', handle: '@chiaradesigns' },
    { platform: 'LinkedIn', handle: 'chiara-bianchi-123' },
  ],
  languages: [
    { name: 'Italian', level: 'Native' },
    { name: 'Greek', level: 'Native' },
    { name: 'English', level: 'Professional working' },
    { name: 'Spanish', level: 'Elementary' },
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
      title: 'Product designer',
      company: 'Apple',
      duration: 'Jul 20 - Jan 2022',
      location: 'Cupertino',
      description:
        'Omnis minima inventore minus. Aut et incidunt. Aut fugiat culpa illum optio dolorum aut maxima ipsa. Liborum molestiae enim consectetur perspiciatis. Dolore ullam dolor magnis dolorum recusandae facilis quis qui officiis.',
    },
    {
      title: 'UX designer',
      company: 'Tesla',
      duration: 'Oct 2019 - Mar 2020',
      location: 'Austin',
      description:
        'Consequatur ullam aut eos assumenda autem aperiam occaecat voluptates. Fugit quasi est soluta nesciunt et beatae. Maiores repudiandae quisquam autem enim ut in possimus est.',
    },
    {
      title: 'Design system architect',
      company: 'Google',
      duration: 'Sep 2014 - Aug 2015',
      location: 'Mountain View',
      description:
        'Ut molestias omnis. Fugue voluptate velit corporis adipisci voluptate et qui sed neque. Inventore eos non. Qui eveniet quo incidunt nemo.',
    },
    {
      title: 'Design system architect',
      company: 'Vectornator',
      duration: 'Sep 2010 - Jul 2013',
      location: 'Berlin',
      description:
        'Nam in fugiat aut consequatur dolorem. Commodi animi impedit modi aspernatur imperdiet ut qui aut eligendi quibusdam. Fugit laborum ducimus filo tempore velit. Sed vitae et commodi odit tempor. Unde voluptates quaerat sit nihil aspernatur vitae et commodi odit tempor. Unde voluptates quaerat sit nihil aspernatur eveniet voluptatum.',
    },
  ],
  education: [
    {
      course: 'Build a design system',
      institution: 'Memorisely',
      date: 'Oct 2021',
    },
    {
      course: 'UX Design certificate',
      institution: 'UX academy',
      date: 'Feb 2020',
    },
    {
      course: 'User research course',
      institution: 'Coursera',
      date: 'Dec 2019',
    },
  ],
  skills: {
    design: ['Wireframing', 'Prototyping', 'Testing'],
    development: ['React JS', 'Chakra UI', 'Emotion', 'Framer'],
    tools: ['Figma', 'Maze', 'Spline', 'Zeplin'],
  },
};

export function CVDocument({ data = defaultData }: { data?: CVData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Left Sidebar */}
        <View style={styles.sidebar}>
          {/* Profile Section */}
          <View style={styles.profileSection}>
            <View style={styles.profileImageContainer}>
              <View style={styles.profileImagePlaceholder} />
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
                <View key={project.name} style={styles.projectCard}>
                  <View style={styles.projectIcon} />
                  <View style={styles.projectContent}>
                    <Text style={styles.projectName}>{project.name}</Text>
                    <Text style={styles.projectDescription}>
                      {project.description}
                    </Text>
                    <Text style={styles.projectUrl}>{project.url}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Experience */}
          <View style={styles.mainSection}>
            <Text style={styles.mainSectionTitle}>Experience</Text>
            <View style={styles.timelineContainer}>
              {data.experience.map((exp, index) => (
                <View
                  key={`${exp.company}-${exp.title}-${exp.duration}`}
                  style={styles.timelineItem}
                >
                  <View style={styles.timelineLeft}>
                    <View style={styles.timelineDot} />
                    {index < data.experience.length - 1 && (
                      <View style={styles.timelineLine} />
                    )}
                  </View>
                  <View style={styles.experienceItem}>
                    <View style={styles.experienceHeader}>
                      <View style={styles.companyLogo} />
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
            <View style={styles.educationGrid}>
              {data.education.map((edu, _) => (
                <View
                  key={`${edu.institution}-${edu.course}-${edu.date}`}
                  style={styles.educationCard}
                >
                  <View style={styles.educationIcon} />
                  <View style={styles.educationContent}>
                    <Text style={styles.educationCourse}>{edu.course}</Text>
                    <Text style={styles.educationInstitution}>
                      {edu.institution}
                    </Text>
                    <Text style={styles.educationDate}>{edu.date}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Skills */}
          <View style={styles.mainSection}>
            <Text style={styles.mainSectionTitle}>Skills</Text>
            <View style={styles.skillsContainer}>
              <View style={styles.skillCategory}>
                <Text style={styles.skillCategoryTitle}>Design</Text>
                <View style={styles.skillTags}>
                  {data.skills.design.map((skill) => (
                    <Text key={skill} style={styles.skillTag}>
                      {skill}
                    </Text>
                  ))}
                </View>
              </View>
              <View style={styles.skillCategory}>
                <Text style={styles.skillCategoryTitle}>Development</Text>
                <View style={styles.skillTags}>
                  {data.skills.development.map((skill) => (
                    <Text key={skill} style={styles.skillTag}>
                      {skill}
                    </Text>
                  ))}
                </View>
              </View>
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
    width: '80%',
    height: 80,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    backgroundColor: '#e9ecef',
    marginLeft: -16,
    paddingLeft: 16,
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

  projectCard: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 6,
    padding: 10,
    border: '1px solid #e9ecef',
    width: '47%',
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

  timelineItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },

  timelineLeft: {
    width: 20,
    alignItems: 'center',
    marginRight: 12,
  },

  timelineDot: {
    width: 8,
    height: 8,
    backgroundColor: '#6f42c1',
    borderRadius: 4,
    zIndex: 1,
  },

  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#e9ecef',
    marginTop: 4,
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
    backgroundColor: '#e9ecef',
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
  educationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  educationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 6,
    padding: 8,
    border: '1px solid #e9ecef',
    width: '31%',
  },

  educationIcon: {
    width: 24,
    height: 24,
    backgroundColor: '#e9ecef',
    borderRadius: 4,
    marginRight: 6,
  },

  educationContent: {
    flex: 1,
  },

  educationCourse: {
    fontSize: 8,
    fontWeight: 600,
    color: '#212529',
    marginBottom: 1,
  },

  educationInstitution: {
    fontSize: 7,
    color: '#6f42c1',
    marginBottom: 1,
  },

  educationDate: {
    fontSize: 6,
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
