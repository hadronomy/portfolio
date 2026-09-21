import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { renderSvg } from 'takumi-js';
import { render } from 'takumi-pdf';
import portrait from '../assets/cv-portrait.png?inline';
import bodyBold from '../assets/pdf-fonts/DMSans-Bold.ttf?inline';
import bodyRegular from '../assets/pdf-fonts/DMSans-Regular.ttf?inline';
import displayBold from '../assets/pdf-fonts/SpaceGrotesk-Bold.ttf?inline';
import displayLight from '../assets/pdf-fonts/SpaceGrotesk-Light.ttf?inline';

const projects = [
  {
    name: 'Autographa',
    url: 'https://github.com/hadronomy/autographa',
    description: 'A tool to generate animated signatures.',
  },
  {
    name: 'Canary',
    url: 'https://github.com/hadronomy/canary',
    description: 'An agentic legal assistant.',
  },
  {
    name: 'RAM Language',
    url: 'https://github.com/hadronomy/ram',
    description: 'A Random Access Machine language and emulator.',
  },
  {
    name: 'VRPT-SWTS',
    url: 'https://github.com/hadronomy/VRPT-SWTS',
    description:
      'Algorithms for the Vehicle Routing Problem with Transshipments.',
  },
  {
    name: 'King of the Hollywood Hill',
    url: 'https://github.com/SistemasInteligentesHL/Proyecto-Sistemas-Inteligentes',
    description: 'An interactive movie recommendation system.',
  },
];

const development = [
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
];
const tools = [
  'Docker',
  'PostgreSQL',
  'Git',
  'Linux',
  'Kubernetes',
  'Prisma',
  'Vite',
  'Tauri',
];

const css = `
  * { box-sizing: border-box; }
  main { font-family: 'DM Sans'; color: #20201e; font-size: 13px; line-height: 1.48; background: #f7f5f2; padding: 24px; }
  h1, h2, h3, p, ul { margin: 0; }
  a { color: inherit; text-decoration: none; }
  .folio { display: flex; justify-content: space-between; font-family: 'Geist Mono'; font-size: 9px; color: #65625c; margin-bottom: 14px; }
  .frame { border: 1px solid #cfcbc3; }
  .identity { display: flex; align-items: stretch; }
  .name { flex: 1; padding: 28px 26px 25px; }
  h1 { font-family: 'Space Grotesk'; font-size: 53px; line-height: 1.12; letter-spacing: -1px; font-kerning: none; font-weight: 700; }
  .first { display: block; font-weight: 300; }
  .last { display: block; }
  .role { font-family: 'Geist Mono'; color: #0033df; font-size: 12px; margin-top: 15px; font-weight: 600; letter-spacing: 1px; }
  .portrait { width: 206px; height: 206px; object-fit: cover; border-left: 1px solid #cfcbc3; }
  .contacts { display: flex; background: #ebe8e1; border-top: 1px solid #cfcbc3; border-bottom: 1px solid #cfcbc3; }
  .contact { flex: 1; padding: 15px 18px; border-right: 1px solid #cfcbc3; font-size: 11.5px; line-height: 1.6; }
  .contact:last-child { border-right: 0; }
  .label { display: block; font-family: 'Geist Mono'; font-size: 8px; letter-spacing: 1px; color: #59564f; margin-bottom: 5px; }
  .columns { display: flex; align-items: stretch; }
  .primary { width: 61%; border-right: 1px solid #cfcbc3; }
  .secondary { width: 39%; }
  section { padding: 24px 26px; border-bottom: 1px solid #cfcbc3; break-inside: avoid; }
  section:last-child { border-bottom: 0; }
  h2 { display: flex; justify-content: space-between; align-items: baseline; font-family: 'Space Grotesk'; font-size: 19px; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 16px; }
  .number { font-family: 'Geist Mono'; font-weight: 400; font-size: 9px; color: #77736b; letter-spacing: 0; }
  h3 { font-size: 13.5px; font-weight: 700; line-height: 1.4; }
  .body { color: #55524c; }
  .date { font-family: 'Geist Mono'; font-size: 10px; color: #0033df; margin: 5px 0 12px; }
  ul { padding-left: 16px; color: #55524c; }
  li { margin-top: 7px; padding-left: 2px; }
  .project { margin-top: 14px; break-inside: avoid; }
  .project:first-of-type { margin-top: 0; }
  .project h3 { font-family: 'Space Grotesk'; font-size: 13px; }
  .project p { font-size: 12.5px; color: #55524c; margin-top: 4px; }
  .project a { display: flex; justify-content: space-between; align-items: baseline; }
  .arrow { color: #0033df; font-family: 'DM Sans'; font-size: 14px; font-weight: 400; }
  .category { font-family: 'Geist Mono'; font-size: 9px; letter-spacing: 1px; color: #59564f; margin-bottom: 10px; }
  .keys { display: flex; flex-wrap: wrap; gap: 7px 6px; margin-bottom: 23px; }
  .keys:last-child { margin-bottom: 0; }
  .key { font-family: 'Geist Mono'; font-size: 10px; padding: 4px 6px 3px; background: #fffefa; border: 1px solid #c8c4bc; border-bottom: 3px solid #b9b5ad; border-radius: 3px; white-space: nowrap; }
  .institution { margin-top: 8px; color: #55524c; font-size: 12.5px; }
  .degree { font-size: 11.5px; color: #55524c; margin-top: 10px; }
  .language { display: flex; justify-content: space-between; margin-top: 10px; font-size: 12.5px; }
  .level { font-family: 'Geist Mono'; font-size: 10px; color: #55524c; }
`;

function SectionTitle({ title, number }: { title: string; number: string }) {
  return (
    <h2>
      {title}
      <span className="number" aria-hidden="true">
        [{number}]
      </span>
    </h2>
  );
}

function CVDocument() {
  return (
    <main>
      <div className="folio" aria-hidden="true">
        <span>CURRICULUM VITAE</span>
        <span>HADRONOMY / {new Date().getFullYear()}</span>
      </div>
      <div className="frame">
        <div className="identity">
          <div className="name">
            <h1>
              <span className="first">PABLO</span>
              <span className="last">HERNÁNDEZ</span>
            </h1>
            <p className="role">— FULL-STACK ENGINEER</p>
          </div>
          <img
            className="portrait"
            src="portrait"
            alt="Portrait of Pablo Hernández"
          />
        </div>
        <div className="contacts">
          <div className="contact">
            <p className="label">LOCATION</p>
            <p>Canary Islands, Spain</p>
          </div>
          <div className="contact">
            <p className="label">CONTACT</p>
            <p>
              <a href="mailto:hadronomy@gmail.com">hadronomy@gmail.com</a>
            </p>
            <p>
              <a href="tel:+34608733118">+34 608 73 31 18</a>
            </p>
          </div>
          <div className="contact">
            <p className="label">ONLINE</p>
            <p>
              <a href="https://hadronomy.com">hadronomy.com</a>
            </p>
            <p>
              <a href="https://github.com/hadronomy">github.com/hadronomy</a>
            </p>
          </div>
        </div>
        <div className="columns">
          <div className="primary">
            <section>
              <SectionTitle title="PROFILE" number="01" />
              <p className="body">
                Full-stack engineer with a focus on web applications, systems
                programming, and open-source tools. Computer Engineering student
                at Universidad de La Laguna.
              </p>
            </section>
            <section>
              <SectionTitle title="EXPERIENCE" number="02" />
              <h3>Independent Developer</h3>
              <p className="date">Independent / 2014–Present</p>
              <ul>
                <li>
                  Develop open-source tools and applications, from systems
                  software to AI-driven web applications.
                </li>
                <li>
                  Mentor peer developers and student project teams in
                  maintainable code and software architecture.
                </li>
              </ul>
            </section>
            <section>
              <SectionTitle title="PROJECTS" number="03" />
              {projects.map((project) => (
                <div className="project" key={project.name}>
                  <h3>
                    <a href={project.url}>
                      {project.name}
                      <span className="arrow" aria-hidden="true">
                        ↗
                      </span>
                    </a>
                  </h3>
                  <p>{project.description}</p>
                </div>
              ))}
            </section>
          </div>
          <div className="secondary">
            <section>
              <SectionTitle title="SKILLS" number="04" />
              <p className="category">DEVELOPMENT</p>
              <div className="keys">
                {development.map((skill) => (
                  <span className="key" key={skill}>
                    {skill}
                  </span>
                ))}
              </div>
              <p className="category">TOOLS</p>
              <div className="keys">
                {tools.map((skill) => (
                  <span className="key" key={skill}>
                    {skill}
                  </span>
                ))}
              </div>
            </section>
            <section>
              <SectionTitle title="EDUCATION" number="05" />
              <h3>B.S. in Computer Engineering</h3>
              <p className="institution">Universidad de La Laguna</p>
              <p className="date">2021–Present</p>
              <p className="degree">
                Grado en Ingeniería Informática
                <br />
                In progress
              </p>
            </section>
            <section>
              <SectionTitle title="LANGUAGES" number="06" />
              <p className="language">
                <strong>Spanish</strong>
                <span className="level">Native</span>
              </p>
              <p className="language">
                <strong>English</strong>
                <span className="level">C1</span>
              </p>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

async function cvResources() {
  const require = createRequire(import.meta.url);
  const mono = await readFile(
    require.resolve(
      '@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2',
    ),
  );
  const bytes = (asset: string) =>
    Buffer.from(asset.slice(asset.indexOf(',') + 1), 'base64');

  return {
    css,
    fonts: [
      mono,
      bytes(displayLight),
      bytes(displayBold),
      bytes(bodyRegular),
      bytes(bodyBold),
    ],
    images: [{ src: 'portrait', data: bytes(portrait) }],
    fontFamilies: ['DM Sans'],
    lang: 'en',
  };
}

export async function renderCVSvg() {
  return renderSvg(<CVDocument />, {
    ...(await cvResources()),
    width: (210 / 25.4) * 96,
    height: (297 / 25.4) * 96,
  });
}

export async function renderCV() {
  return render(<CVDocument />, {
    ...(await cvResources()),
    size: 'a4',
    margin: 0,
    tagged: 'ua1',
    outline: true,
    metadata: {
      title: 'Pablo Hernández — Full-Stack Engineer',
      authors: ['Pablo Hernández'],
      description: 'Experience, projects, education, and technical skills.',
    },
  });
}
