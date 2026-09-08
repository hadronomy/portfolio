import {
  domMax,
  LazyMotion,
  useDragControls,
  useReducedMotion,
  useTransform,
} from 'motion/react';
import * as m from 'motion/react-m';
import { type ReactNode, useId, useRef, useState } from 'react';
import type { WorkProject } from '~/lib/work';
import { CanvasDetails, CanvasIcon, CanvasToolbar } from './CanvasControls';
import CanvasPrint from './CanvasPrint';
import { placePrints } from './canvas-layout';
import { useCanvasSession } from './use-canvas-session';
import { useWorkCamera } from './use-work-camera';
import './canvas.css';

interface Props {
  projects: readonly WorkProject[];
  terrain?: ReactNode;
}

function Canvas({ projects, terrain }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const initialIndex = 0;
  const selectedIndex = Math.max(
    0,
    selectedId === null
      ? initialIndex
      : projects.findIndex((p) => p.id === selectedId),
  );
  const [spread, setSpread] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);
  const [keyboard, setKeyboard] = useState(false);
  const [touchPan, setTouchPan] = useState(false);
  const suppressClick = useRef(false);
  const drag = useDragControls();
  const reduced = useReducedMotion();
  const viewportId = useId();
  const helpId = useId();
  const placements = placePrints(
    projects.length,
    selectedIndex,
    spread,
    hovered,
  );
  const camera = useWorkCamera(placements, selectedIndex);
  useCanvasSession(camera, selectedId, spread, (saved) => {
    if (projects.some((project) => project.id === saved.selectedId))
      setSelectedId(saved.selectedId);
    setSpread(saved.spread);
  });
  const groundX = useTransform(
    camera.x,
    (value) => Math.tanh(value / 600) * 80,
  );
  const groundY = useTransform(
    camera.y,
    (value) => Math.tanh(value / 600) * 60,
  );

  function choose(index: number, fromKeyboard: boolean) {
    const next = Math.max(0, Math.min(projects.length - 1, index));
    setSelectedId(projects[next].id);
    setKeyboard(fromKeyboard);
    setHovered(null);
    const prints = placePrints(projects.length, next, spread, null);
    if (!spread && (camera.viewport.current?.clientWidth ?? 0) >= 700)
      camera.fit(fromKeyboard, prints);
    else camera.focus(next, fromKeyboard, prints);
  }

  return (
    <div
      className="work-canvas-layout"
      data-layout="stacks"
      data-keyboard={keyboard}
    >
      <section
        className="canvas-stage"
        ref={camera.viewport}
        id={viewportId}
        aria-label="Stacked project canvas"
        aria-describedby={helpId}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: The canvas supports keyboard pan, zoom, and recentering.
        tabIndex={0}
        data-touch-pan={touchPan}
        data-cursor="hint"
        data-cursor-label="Drag to explore"
        style={{ touchAction: touchPan ? 'none' : 'pan-y' }}
        onPointerMove={(event) => {
          if (
            keyboard &&
            event.pointerType === 'mouse' &&
            (event.movementX || event.movementY)
          )
            setKeyboard(false);
        }}
        onPointerDown={(event) => {
          suppressClick.current = false;
          if (
            (event.pointerType === 'touch' && !touchPan) ||
            (event.pointerType === 'mouse' && event.button !== 0)
          )
            return;
          setKeyboard(false);
          setHovered(null);
          camera.x.stop();
          camera.y.stop();
          camera.scale.stop();
          drag.start(event, { distanceThreshold: 7 });
        }}
        onPointerCancel={() => {
          drag.cancel();
          camera.viewport.current?.removeAttribute('data-dragging');
        }}
        onDragStart={(event) => event.preventDefault()}
        onClickCapture={(event) => {
          if (suppressClick.current && event.detail !== 0) {
            event.preventDefault();
            event.stopPropagation();
            suppressClick.current = false;
          }
        }}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          const shifts: Record<string, [number, number]> = {
            ArrowLeft: [100, 0],
            ArrowRight: [-100, 0],
            ArrowUp: [0, 100],
            ArrowDown: [0, -100],
          };
          const shift = shifts[event.key];
          if (shift) {
            event.preventDefault();
            setKeyboard(true);
            camera.move(
              {
                x: camera.x.get() + shift[0],
                y: camera.y.get() + shift[1],
                scale: camera.scale.get(),
              },
              true,
            );
          } else if (event.key === '+' || event.key === '=') {
            event.preventDefault();
            setKeyboard(true);
            camera.zoomBy(1.2, true);
          } else if (event.key === '-') {
            event.preventDefault();
            setKeyboard(true);
            camera.zoomBy(1 / 1.2, true);
          } else if (
            event.key === 'Home' ||
            event.key === '0' ||
            event.key === 'Escape'
          ) {
            event.preventDefault();
            setKeyboard(true);
            setTouchPan(false);
            camera.fit(true);
          }
        }}
      >
        <div className="canvas-ground-mask" aria-hidden="true">
          <m.div
            className="canvas-ground"
            style={{ x: reduced ? 0 : groundX, y: reduced ? 0 : groundY }}
          >
            {terrain}
          </m.div>
        </div>
        <m.div
          className="canvas-camera"
          style={{
            x: camera.x,
            y: camera.y,
            scale: camera.scale,
            touchAction: touchPan ? 'none' : 'pan-y',
          }}
          drag
          dragListener={false}
          dragControls={drag}
          dragMomentum={!reduced}
          dragTransition={{ power: 0.16, timeConstant: 200 }}
          onDragStart={() => {
            suppressClick.current = true;
            camera.viewport.current?.setAttribute('data-dragging', 'true');
          }}
          onDragEnd={() =>
            camera.viewport.current?.removeAttribute('data-dragging')
          }
        >
          {projects.map((project, index) => (
            <CanvasPrint
              key={project.id}
              project={project}
              index={index}
              placement={placements[index]}
              selected={index === selectedIndex}
              keyboard={keyboard}
              onHover={setHovered}
              onFocus={(index) => choose(index, true)}
              onChoose={choose}
            />
          ))}
        </m.div>
      </section>
      <CanvasToolbar
        camera={camera}
        viewportId={viewportId}
        selectedIndex={selectedIndex}
        count={projects.length}
        onChoose={choose}
      />
      <div className="canvas-below work-measure">
        <div className="canvas-instructions">
          <button
            type="button"
            className="canvas-touch-move"
            aria-pressed={touchPan}
            aria-controls={viewportId}
            onClick={() => setTouchPan(!touchPan)}
          >
            <CanvasIcon kind="move" />
            <span>Move</span>
          </button>
          <p className="work-caption" id={helpId}>
            <span className="canvas-mouse-help">
              Select a print to read about it. Drag to explore.
            </span>
            <span className="canvas-touch-help">
              Tap a print to select it. Turn on Move to explore.
            </span>
            <span className="sr-only">
              Focus the canvas to pan with arrow keys. Press Home to fit all
              projects.
            </span>
          </p>
          {
            <button
              type="button"
              className="canvas-spread"
              aria-expanded={spread}
              aria-controls={viewportId}
              onClick={(event) => {
                setSpread(!spread);
                setKeyboard(event.detail === 0);
                camera.fit(
                  event.detail === 0,
                  placePrints(projects.length, selectedIndex, !spread, null),
                );
              }}
            >
              {spread ? 'Gather prints' : 'Spread prints'}
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
          }
        </div>
        <CanvasDetails
          projects={projects}
          selectedIndex={selectedIndex}
          onChoose={choose}
        />
      </div>
    </div>
  );
}

export default function WorkCanvas(props: Props) {
  return (
    <LazyMotion features={domMax} strict>
      <Canvas {...props} />
    </LazyMotion>
  );
}
