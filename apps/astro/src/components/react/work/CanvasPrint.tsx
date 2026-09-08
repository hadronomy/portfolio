import { useReducedMotion, useSpring } from 'motion/react';
import * as m from 'motion/react-m';
import { useRef } from 'react';
import type { WorkProject } from '~/lib/work';
import { type PrintPlacement, printHeight } from './canvas-layout';
import { Arrow, ProjectCover } from './WorkShared';

const spring = { stiffness: 260, damping: 26, mass: 0.6 };

interface Props {
  project: WorkProject;
  index: number;
  placement: PrintPlacement;
  selected: boolean;
  keyboard: boolean;
  onHover: (index: number | null) => void;
  onFocus: (index: number) => void;
  onChoose: (index: number, keyboard: boolean) => void;
}

export default function CanvasPrint({
  project,
  index,
  placement,
  selected,
  keyboard,
  onHover,
  onFocus,
  onChoose,
}: Props) {
  const reduced = useReducedMotion();
  const bounds = useRef<DOMRect | null>(null);
  const tiltX = useSpring(0, spring);
  const tiltY = useSpring(0, spring);
  function settle() {
    tiltX.set(0);
    tiltY.set(0);
  }

  return (
    <m.article
      className="canvas-node"
      data-project={project.id}
      data-selected={selected}
      initial={false}
      animate={{
        x: placement.x,
        y: placement.y,
        rotate: reduced ? 0 : placement.rotation,
      }}
      transition={
        keyboard || reduced ? { duration: 0 } : { type: 'spring', ...spring }
      }
      style={{
        width: placement.width,
        marginLeft: -placement.width / 2,
        marginTop: -printHeight(placement.width) / 2,
        zIndex: placement.depth,
      }}
      onPointerEnter={(event) => {
        if (event.pointerType !== 'mouse' || event.buttons || reduced) return;
        bounds.current = event.currentTarget.getBoundingClientRect();
        onHover(index);
      }}
      onPointerMove={(event) => {
        const box = bounds.current;
        if (event.pointerType !== 'mouse' || reduced || !box || event.buttons)
          return;
        const x = Math.max(
          -0.5,
          Math.min(0.5, (event.clientX - box.left) / box.width - 0.5),
        );
        const y = Math.max(
          -0.5,
          Math.min(0.5, (event.clientY - box.top) / box.height - 0.5),
        );
        tiltX.set(-y * 5);
        tiltY.set(x * 5);
      }}
      onPointerLeave={() => {
        settle();
        onHover(null);
      }}
      onPointerDown={settle}
      onPointerCancel={settle}
    >
      <m.button
        type="button"
        aria-pressed={selected}
        onClick={(event) => onChoose(index, event.detail === 0)}
        className="canvas-print"
        aria-label={`Select ${project.title}`}
        data-cursor="hint"
        data-cursor-label="Select or drag"
        style={{
          rotateX: reduced ? 0 : tiltX,
          rotateY: reduced ? 0 : tiltY,
          transformPerspective: 1000,
        }}
        onFocus={(event) => {
          if (event.currentTarget.matches(':focus-visible')) {
            tiltX.jump(0);
            tiltY.jump(0);
            onFocus(index);
          }
        }}
        onBlur={settle}
      >
        <span className="canvas-art">
          <ProjectCover project={project} />
        </span>
        <span className="canvas-caption">
          <span className="canvas-name">
            <strong>{project.title}</strong>
            <span>{project.category}</span>
          </span>
          <span className="canvas-print-arrow">
            <Arrow />
          </span>
        </span>
      </m.button>
    </m.article>
  );
}
