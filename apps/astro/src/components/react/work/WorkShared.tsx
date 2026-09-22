import type { WorkProject } from '~/lib/work';
import ShaderCover from './ShaderCover';

export function Arrow({
  direction = 'out',
}: {
  direction?: 'out' | 'left' | 'right';
}) {
  return (
    <svg
      className={`work-arrow work-arrow-${direction}`}
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path
        d={
          direction === 'out'
            ? 'M6 18 18 6M6 6h12v12'
            : direction === 'left'
              ? 'M19 12H5m6-6-6 6 6 6'
              : 'M5 12h14m-6-6 6 6-6 6'
        }
      />
    </svg>
  );
}

export function ProjectCover({ project }: { project: WorkProject }) {
  if (project.cover.shader) {
    return <ShaderCover project={project} shader={project.cover.shader} />;
  }
  return (
    <img
      className="project-cover"
      src={project.cover.src}
      alt={project.cover.alt}
      width={project.cover.width}
      height={project.cover.height}
      loading="lazy"
      decoding="async"
      draggable={false}
    />
  );
}

export function ProjectLink({ project }: { project: WorkProject }) {
  return (
    <a
      className="work-project-link"
      href={project.href}
      data-cursor="preview"
      data-cursor-src={project.cover.src}
    >
      Explore {project.title}
      <Arrow />
    </a>
  );
}
