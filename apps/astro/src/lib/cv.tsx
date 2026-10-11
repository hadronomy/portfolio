import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { renderSvg } from 'takumi-js';
import { render } from 'takumi-pdf';
import portrait from '../assets/cv-portrait.png?inline';
import bodyBold from '../assets/pdf-fonts/DMSans-Bold.ttf?inline';
import bodyRegular from '../assets/pdf-fonts/DMSans-Regular.ttf?inline';
import displayBold from '../assets/pdf-fonts/SpaceGrotesk-Bold.ttf?inline';
import displayLight from '../assets/pdf-fonts/SpaceGrotesk-Light.ttf?inline';
import { cvCopy, cvProjects } from '../i18n/cv';
import { defaultLocale, type Locale } from '../i18n/locales';
import { engineeringExperience, engineeringSkills, profile } from './profile';

const css = `
  * { box-sizing: border-box; }
  main { font-family: 'DM Sans'; color: #20201e; font-size: 13px; line-height: 1.48; background: #f7f5f2; padding: 24px; }
  h1, h2, h3, p, ul { margin: 0; }
  a { color: inherit; text-decoration: none; }
  .folio { display: flex; justify-content: space-between; font-family: 'Geist Mono'; font-size: 9px; color: #65625c; margin-bottom: 14px; }
  .frame { border: 1px solid #cfcbc3; }
  .identity { display: flex; align-items: stretch; }
  .name { flex: 1; padding: 20px 26px; }
  h1 { font-family: 'Space Grotesk'; font-size: 48px; line-height: 1.12; letter-spacing: -1px; font-kerning: none; font-weight: 700; }
  .first { display: block; font-weight: 300; }
  .last { display: block; }
  .role { font-family: 'Geist Mono'; color: #0033df; font-size: 12px; margin-top: 15px; font-weight: 600; letter-spacing: 1px; }
  .portrait { width: 180px; height: 180px; object-fit: cover; border-left: 1px solid #cfcbc3; }
  .contacts { display: flex; background: #ebe8e1; border-top: 1px solid #cfcbc3; border-bottom: 1px solid #cfcbc3; }
  .contact { flex: 1; padding: 15px 18px; border-right: 1px solid #cfcbc3; font-size: 11.5px; line-height: 1.6; }
  .contact:last-child { border-right: 0; }
  .label { display: block; font-family: 'Geist Mono'; font-size: 8px; letter-spacing: 1px; color: #59564f; margin-bottom: 5px; }
  .columns { display: flex; align-items: stretch; }
  .primary { width: 61%; border-right: 1px solid #cfcbc3; }
  .secondary { width: 39%; }
  section { padding: 14px 22px; border-bottom: 1px solid #cfcbc3; break-inside: avoid; }
  section:last-child { border-bottom: 0; }
  h2 { display: flex; justify-content: space-between; align-items: baseline; font-family: 'Space Grotesk'; font-size: 19px; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 12px; }
  .number { font-family: 'Geist Mono'; font-weight: 400; font-size: 9px; color: #77736b; letter-spacing: 0; }
  h3 { font-size: 13.5px; font-weight: 700; line-height: 1.4; }
  .body { color: #55524c; }
  .engagement { color: #55524c; font-size: 12px; margin-top: 4px; }
  .date { font-family: 'Geist Mono'; font-size: 10px; color: #0033df; margin: 5px 0 12px; }
  ul { padding-left: 16px; color: #55524c; }
  li { margin-top: 5px; padding-left: 2px; }
  .project { margin-top: 8px; break-inside: avoid; }
  .project:first-of-type { margin-top: 0; }
  .project h3 { font-family: 'Space Grotesk'; font-size: 13px; }
  .project p { font-size: 12.5px; color: #55524c; margin-top: 4px; }
  .project a { display: flex; justify-content: space-between; align-items: baseline; }
  .arrow { color: #0033df; font-family: 'DM Sans'; font-size: 14px; font-weight: 400; }
  .category { font-family: 'Geist Mono'; font-size: 9px; letter-spacing: 1px; color: #59564f; margin-bottom: 10px; }
  .skill-group + .skill-group { margin-top: 18px; }
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

function CVDocument({ locale }: { locale: Locale }) {
  const copy = cvCopy[locale];
  return (
    <main lang={locale}>
      <div className="folio" aria-hidden="true">
        <span>{copy.folio.toLocaleUpperCase(locale)}</span>
        <span>HADRONOMY / {new Date().getFullYear()}</span>
      </div>
      <div className="frame">
        <div className="identity">
          <div className="name">
            <h1>
              <span className="first">PABLO</span>
              <span className="last">HERNÁNDEZ</span>
            </h1>
            <p className="role" lang="en">
              — {engineeringExperience.role.toUpperCase()}
            </p>
          </div>
          <img className="portrait" src="portrait" alt={copy.portraitAlt} />
        </div>
        <div className="contacts">
          <div className="contact">
            <p className="label">
              {copy.labels.location.toLocaleUpperCase(locale)}
            </p>
            <p>{copy.location}</p>
          </div>
          <div className="contact">
            <p className="label">
              {copy.labels.contact.toLocaleUpperCase(locale)}
            </p>
            <p>
              <a href={`mailto:${profile.email}`}>{profile.email}</a>
            </p>
            <p>
              <a href="tel:+34608733118">+34 608 73 31 18</a>
            </p>
          </div>
          <div className="contact">
            <p className="label">
              {copy.labels.online.toLocaleUpperCase(locale)}
            </p>
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
              <SectionTitle
                title={copy.labels.profile.toLocaleUpperCase(locale)}
                number="01"
              />
              <p className="body">{copy.summary}</p>
            </section>
            <section>
              <SectionTitle
                title={copy.labels.experience.toLocaleUpperCase(locale)}
                number="02"
              />
              <h3 lang="en">{engineeringExperience.role}</h3>
              <p className="engagement">{copy.engagement}</p>
              <ul>
                {copy.highlights.map((highlight) => (
                  <li key={highlight}>{highlight}</li>
                ))}
              </ul>
            </section>
            <section>
              <SectionTitle
                title={copy.labels.projects.toLocaleUpperCase(locale)}
                number="03"
              />
              {cvProjects.map((project) => (
                <div className="project" key={project.name}>
                  <h3>
                    <a href={project.url}>
                      {project.name}
                      <span className="arrow" aria-hidden="true">
                        ↗
                      </span>
                    </a>
                  </h3>
                  <p>{copy.projectDescriptions[project.id]}</p>
                </div>
              ))}
            </section>
          </div>
          <div className="secondary">
            <section>
              <SectionTitle
                title={copy.labels.skills.toLocaleUpperCase(locale)}
                number="04"
              />
              {engineeringSkills.map((group) => (
                <div className="skill-group" key={group.label}>
                  <p className="category">
                    {copy.skillGroups[group.id].toLocaleUpperCase(locale)}
                  </p>
                  <div className="keys">
                    {group.items.map((skill) => (
                      <span className="key" key={skill}>
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </section>
            <section>
              <SectionTitle
                title={copy.labels.education.toLocaleUpperCase(locale)}
                number="05"
              />
              <h3>{copy.educationTitle}</h3>
              <p className="institution">Universidad de La Laguna</p>
              <p className="date">2022-2026</p>
              <p className="degree">Grado en Ingeniería Informática</p>
            </section>
            <section>
              <SectionTitle
                title={copy.labels.languages.toLocaleUpperCase(locale)}
                number="06"
              />
              <p className="language">
                <strong>{copy.languages.spanish}</strong>
                <span className="level">{copy.languages.native}</span>
              </p>
              <p className="language">
                <strong>{copy.languages.english}</strong>
                <span className="level">C2</span>
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
  };
}

export async function renderCVSvg(locale: Locale = defaultLocale) {
  return renderSvg(<CVDocument locale={locale} />, {
    lang: locale,
    ...(await cvResources()),
    width: (210 / 25.4) * 96,
    height: (297 / 25.4) * 96,
  });
}

export async function renderCV(locale: Locale = defaultLocale) {
  const copy = cvCopy[locale];
  return render(<CVDocument locale={locale} />, {
    lang: locale,
    ...(await cvResources()),
    size: 'a4',
    margin: 0,
    tagged: 'ua1',
    outline: true,
    metadata: {
      title: `${profile.name} — ${engineeringExperience.role}`,
      authors: ['Pablo Hernández'],
      description: copy.metadataDescription,
    },
  });
}
