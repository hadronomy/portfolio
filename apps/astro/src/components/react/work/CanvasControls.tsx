import type { WorkProject } from '~/lib/work';
import { Arrow } from './WorkShared';

export function CanvasDetails({
  projects,
  selectedIndex,
  onChoose,
  spread,
  onSpread,
  onReset,
}: {
  projects: readonly WorkProject[];
  selectedIndex: number;
  onChoose: (index: number, keyboard: boolean) => void;
  spread: boolean;
  onSpread: (keyboard: boolean) => void;
  onReset: (keyboard: boolean) => void;
}) {
  return (
    <div className="canvas-below work-measure">
      <div className="canvas-caption-head">
        <div className="canvas-title-stack">
          {projects.map((project, index) => (
            <a
              key={project.id}
              href={project.href}
              className="canvas-project-title t-panel-slide"
              data-open={index === selectedIndex}
              inert={index !== selectedIndex}
              tabIndex={index === selectedIndex ? 0 : -1}
              data-cursor="hint"
              data-cursor-label={`Explore ${project.title}`}
            >
              {project.title}
              <Arrow />
            </a>
          ))}
        </div>
        <div className="canvas-actions">
          <button
            type="button"
            aria-label="Previous project"
            onClick={(event) =>
              onChoose(
                (selectedIndex - 1 + projects.length) % projects.length,
                event.detail === 0,
              )
            }
          >
            <Arrow direction="left" />
          </button>
          <span
            className="canvas-position"
            aria-live="polite"
            aria-atomic="true"
          >
            <span className="sr-only">Project </span>
            <span className="canvas-count-stack" aria-hidden="true">
              {projects.map((project, index) => (
                <span
                  key={project.id}
                  className="t-panel-slide"
                  data-open={index === selectedIndex}
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
              ))}
            </span>
            <span className="sr-only">{selectedIndex + 1}</span>
            <span className="canvas-position-total">
              {' '}
              / {String(projects.length).padStart(2, '0')}
            </span>
          </span>
          <button
            type="button"
            aria-label="Next project"
            onClick={(event) =>
              onChoose(
                (selectedIndex + 1) % projects.length,
                event.detail === 0,
              )
            }
          >
            <Arrow direction="right" />
          </button>
          <button
            type="button"
            className="canvas-spread"
            aria-label={spread ? 'Gather prints' : 'Spread prints'}
            aria-pressed={spread}
            data-cursor="hint"
            data-cursor-label={spread ? 'Gather prints' : 'Spread prints'}
            onClick={(event) => onSpread(event.detail === 0)}
          >
            <svg
              aria-hidden="true"
              width="18"
              height="18"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
            >
              <path d="m4 5 7-1 2 11-7 1z" />
              <path className="spread-leaf" d="m10 5 6 1-2 10-3-.5" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Reset canvas"
            data-cursor="hint"
            data-cursor-label="Reset view"
            onClick={(event) => onReset(event.detail === 0)}
          >
            <svg
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 7a6.5 6.5 0 1 1-.3 5M4 3v4h4" />
            </svg>
          </button>
        </div>
      </div>
      <div className="canvas-description-stack">
        {projects.map((project, index) => (
          <p
            key={project.id}
            className="canvas-description t-panel-slide"
            data-open={index === selectedIndex}
            aria-hidden={index !== selectedIndex}
          >
            {project.summary}
          </p>
        ))}
      </div>
    </div>
  );
}
