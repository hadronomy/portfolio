import type { ReactNode } from 'react';
import type { WorkProject } from '~/lib/work';
import WorkCanvas from './work/WorkCanvas';
import './work/work.css';

export interface WorkGalleryProps {
  readonly projects: readonly WorkProject[];
  readonly demo?: boolean;
  readonly terrain?: ReactNode;
}

export default function WorkGallery({
  projects,
  demo = false,
  terrain,
}: WorkGalleryProps) {
  if (projects.length === 0) return null;
  return (
    <div className="work-gallery" data-variant="stacks">
      <div className="work-header work-measure">
        <div className="work-heading">
          <h2 className="type-overline">Selected work</h2>
          <span className="work-caption">
            {demo ? 'Demo collection' : `${projects.length} projects`}
          </span>
        </div>
      </div>
      <WorkCanvas projects={projects} terrain={terrain} />
    </div>
  );
}
