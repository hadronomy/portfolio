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
import { CanvasDetails } from './CanvasControls';
import CanvasPrint from './CanvasPrint';
import { placePrints } from './canvas-layout';
import { useCanvasGestures } from './use-canvas-gestures';
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

  function reset(fromKeyboard: boolean) {
    setKeyboard(fromKeyboard);
    camera.fit(fromKeyboard);
  }

  function toggleSpread(fromKeyboard: boolean) {
    setSpread(!spread);
    setKeyboard(fromKeyboard);
    setHovered(null);
    camera.fit(
      fromKeyboard,
      placePrints(projects.length, selectedIndex, !spread, null),
    );
  }

  const gestures = useCanvasGestures(
    camera,
    suppressClick,
    (direction) =>
      choose(
        (selectedIndex + direction + projects.length) % projects.length,
        false,
      ),
    () => setKeyboard(false),
  );

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
        data-cursor="hint"
        data-cursor-label="Drag to explore"
        style={{ touchAction: 'pan-y pinch-zoom' }}
        onDoubleClick={(event) => {
          if (!(event.target as Element).closest('button')) toggleSpread(false);
        }}
        onPointerUp={gestures.end}
        onPointerMove={(event) => {
          gestures.move(event);
          if (
            keyboard &&
            event.pointerType === 'mouse' &&
            (event.movementX || event.movementY)
          )
            setKeyboard(false);
        }}
        onPointerDown={(event) => {
          suppressClick.current = false;
          if (event.pointerType === 'touch') {
            gestures.start(event);
            return;
          }
          if (event.pointerType === 'mouse' && event.button !== 0) return;
          setKeyboard(false);
          setHovered(null);
          camera.x.stop();
          camera.y.stop();
          camera.scale.stop();
          drag.start(event, { distanceThreshold: 7 });
        }}
        onPointerCancel={() => {
          gestures.cancel();
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
            ArrowUp: [0, 100],
            ArrowDown: [0, -100],
          };
          const shift = shifts[event.key];
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault();
            choose(
              (selectedIndex +
                (event.key === 'ArrowRight' ? 1 : -1) +
                projects.length) %
                projects.length,
              true,
            );
          } else if (event.key.toLowerCase() === 's') {
            event.preventDefault();
            toggleSpread(true);
          } else if (shift) {
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
            touchAction: 'pan-y pinch-zoom',
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
      <p className="sr-only" id={helpId}>
        Select a print or swipe horizontally to browse. Drag with a mouse to
        explore. Pinch a trackpad to zoom. Left and right arrow keys select
        projects. Press S to spread or gather prints. Press Home to reset the
        view.
      </p>
      <CanvasDetails
        projects={projects}
        selectedIndex={selectedIndex}
        onChoose={choose}
        spread={spread}
        onSpread={toggleSpread}
        onReset={reset}
      />
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
