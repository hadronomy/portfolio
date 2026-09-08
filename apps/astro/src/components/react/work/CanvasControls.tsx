import type { WorkProject } from '~/lib/work';
import type { useWorkCamera } from './use-work-camera';
import { Arrow, ProjectLink } from './WorkShared';

export function CanvasIcon({
  kind,
}: {
  kind: 'plus' | 'minus' | 'fit' | 'move';
}) {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {kind === 'plus' ? (
        <path d="M4 10h12M10 4v12" />
      ) : kind === 'minus' ? (
        <path d="M4 10h12" />
      ) : kind === 'fit' ? (
        <path d="M7 3H3v4m10-4h4v4M3 13v4h4m10-4v4h-4" />
      ) : (
        <path d="M10 2v16M2 10h16M7 5l3-3 3 3M7 15l3 3 3-3M5 7l-3 3 3 3m10-6 3 3-3 3" />
      )}
    </svg>
  );
}

export function CanvasToolbar({
  camera,
  viewportId,
  selectedIndex,
  count,
  onChoose,
}: {
  camera: ReturnType<typeof useWorkCamera>;
  viewportId: string;
  selectedIndex: number;
  count: number;
  onChoose: (index: number, keyboard: boolean) => void;
}) {
  return (
    <div className="canvas-controls work-measure">
      <fieldset className="canvas-tools" aria-label="Canvas controls">
        <button
          type="button"
          aria-label="Zoom out"
          aria-controls={viewportId}
          disabled={camera.zoom <= 0.1}
          onClick={(event) => camera.zoomBy(1 / 1.2, event.detail === 0)}
        >
          <CanvasIcon kind="minus" />
        </button>
        <button
          type="button"
          className="canvas-fit"
          aria-label="Fit all projects"
          aria-controls={viewportId}
          onClick={(event) => camera.fit(event.detail === 0)}
        >
          <CanvasIcon kind="fit" />
          <span>{Math.round(camera.zoom * 100)}%</span>
        </button>
        <button
          type="button"
          aria-label="Zoom in"
          aria-controls={viewportId}
          disabled={camera.zoom >= 1.6}
          onClick={(event) => camera.zoomBy(1.2, event.detail === 0)}
        >
          <CanvasIcon kind="plus" />
        </button>
      </fieldset>
      <div className="canvas-pager">
        <span className="canvas-position" aria-live="polite" aria-atomic="true">
          <span className="sr-only">Project </span>
          {selectedIndex + 1}
          <span className="canvas-position-total"> / {count}</span>
        </span>
        <button
          type="button"
          aria-label="Previous project"
          disabled={selectedIndex === 0}
          onClick={(event) => onChoose(selectedIndex - 1, event.detail === 0)}
        >
          <Arrow direction="left" />
        </button>
        <button
          type="button"
          aria-label="Next project"
          disabled={selectedIndex === count - 1}
          onClick={(event) => onChoose(selectedIndex + 1, event.detail === 0)}
        >
          <Arrow direction="right" />
        </button>
      </div>
    </div>
  );
}

export function CanvasDetails({
  projects,
  selectedIndex,
  onChoose,
}: {
  projects: readonly WorkProject[];
  selectedIndex: number;
  onChoose: (index: number, keyboard: boolean) => void;
}) {
  const selected = projects[selectedIndex];
  return (
    <>
      {' '}
      <fieldset className="canvas-project-picker" aria-label="Choose a project">
        {projects.map((project, index) => (
          <button
            key={project.id}
            type="button"
            aria-pressed={index === selectedIndex}
            onClick={(event) => onChoose(index, event.detail === 0)}
          >
            <span className="canvas-picker-number" aria-hidden="true">
              {String(index + 1).padStart(2, '0')}
            </span>
            {project.title}
          </button>
        ))}
      </fieldset>
      <div className="canvas-detail">
        <div className="canvas-description-stack">
          {projects.map((project) => (
            <p
              key={project.id}
              className="canvas-description"
              data-active={project.id === selected.id}
              aria-hidden={project.id !== selected.id}
            >
              {project.summary}
            </p>
          ))}
        </div>
        <ProjectLink project={selected} />
      </div>
    </>
  );
}
