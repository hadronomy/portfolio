'use client';

import {
  type MotionValue,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface WorkPanel {
  /** Placement on the canvas, as the reference scatters them. */
  x: number;
  y: number;
  rotate: number;
  /** Painter's order at rest. */
  z: number;
  /** Where the capture leads. Placeholders have nowhere to go yet. */
  href?: string;
  label?: string;
}

interface Props {
  panels: WorkPanel[];
}

/** One spring for the whole group, so nothing moves on a different clock. */
const SPRING = {
  type: 'spring',
  stiffness: 260,
  damping: 26,
  mass: 0.6,
} as const;

/**
 * How far a card slides against the pointer, in px at the edge of the frame.
 * Cards further from the middle take more of it, and that difference is the
 * only thing doing the work — parallax is a disagreement about distance, so
 * moving them all by the same amount would just slide the picture.
 */
const PARALLAX = 14;

const card = {
  rest: { scale: 1, y: 0 },
  lifted: { scale: 1.035, y: -10 },
  pressed: { scale: 0.995, y: -4 },
};

const badge = {
  rest: { opacity: 0, scale: 0.85 },
  lifted: { opacity: 1, scale: 1 },
  pressed: { opacity: 1, scale: 1 },
};

function Card({
  panel,
  index,
  total,
  pointerX,
  pointerY,
  still,
  raised,
  onRaise,
}: {
  panel: WorkPanel;
  index: number;
  total: number;
  pointerX: MotionValue<number>;
  pointerY: MotionValue<number>;
  still: boolean;
  raised: boolean;
  onRaise: (index: number | null) => void;
}) {
  // Outer cards travel furthest; the middle of the group is the hinge.
  const spread = (total - 1) / 2 || 1;
  const depth = (index - (total - 1) / 2) / spread;

  const driftX = useSpring(
    useTransform(pointerX, [-1, 1], [-PARALLAX * depth, PARALLAX * depth]),
    SPRING,
  );
  const driftY = useSpring(
    useTransform(pointerY, [-1, 1], [-PARALLAX * 0.5, PARALLAX * 0.5]),
    SPRING,
  );

  const interactive = Boolean(panel.href);
  const Panel = interactive ? motion.a : motion.div;

  return (
    <motion.div
      className="absolute"
      style={{
        x: still ? 0 : driftX,
        y: still ? 0 : driftY,
        translateX: panel.x,
        translateY: panel.y,
        zIndex: raised ? 50 : panel.z,
      }}
    >
      {/* The lift is a separate element so it composes with the drift instead
          of competing with it for the same transform. */}
      <Panel
        {...(interactive
          ? { href: panel.href, 'aria-label': panel.label, rel: 'noreferrer' }
          : {})}
        className="work-panel relative block h-[248px] w-[300px] rounded-[12px] bg-white p-[5px]"
        style={{ rotate: panel.rotate }}
        variants={card}
        initial="rest"
        animate="rest"
        whileHover={still ? undefined : 'lifted'}
        whileFocus={still ? undefined : 'lifted'}
        whileTap={still ? undefined : 'pressed'}
        transition={SPRING}
        onHoverStart={() => onRaise(index)}
        onHoverEnd={() => onRaise(null)}
      >
        {/*
          The mat is white in both themes because the reference hardcodes it,
          and it is what makes the group read as objects lit against the canvas
          rather than holes cut out of it.

          The reference gets away with a white mat in light mode because every
          capture behind it is a dark interface. A pale placeholder has nothing
          carrying it, so the frames disappear into the page; this grey is dark
          enough to hold the shape until real captures arrive. Dropping one in
          means replacing this single element.
        */}
        <div className="grid h-full w-full place-items-center rounded-[6px] bg-[rgb(206,206,206)]">
          <span className="type-overline text-[rgb(140,140,140)]">—</span>
        </div>

        {/*
          Only where there is somewhere to go. An arrow on a placeholder is a
          control that does nothing, which is worse than no arrow.
        */}
        {interactive && (
          <motion.span
            aria-hidden="true"
            className="pointer-events-none absolute right-4 bottom-4 grid size-8 place-items-center rounded-pill bg-[rgb(18,18,18)] text-white"
            variants={badge}
            transition={SPRING}
          >
            <svg
              viewBox="0 0 24 24"
              className="size-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M7 17 17 7M9 7h8v8" />
            </svg>
          </motion.span>
        )}
      </Panel>
    </motion.div>
  );
}

export default function WorkGallery({ panels }: Props) {
  const frame = useRef<HTMLDivElement>(null);
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const [raised, setRaised] = useState<number | null>(null);

  const reduced = useReducedMotion();
  const [coarse, setCoarse] = useState(true);

  // Assume coarse until proven otherwise, so a touch device never gets a frame
  // of pointer-driven motion it cannot drive.
  useEffect(() => {
    const query = window.matchMedia('(hover: hover) and (pointer: fine)');
    const sync = () => setCoarse(!query.matches);

    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  const still = Boolean(reduced) || coarse;

  const track = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const box = frame.current?.getBoundingClientRect();
      if (!box) return;

      pointerX.set(((event.clientX - box.left) / box.width) * 2 - 1);
      pointerY.set(((event.clientY - box.top) / box.height) * 2 - 1);
    },
    [pointerX, pointerY],
  );

  const settle = useCallback(() => {
    pointerX.set(0);
    pointerY.set(0);
    setRaised(null);
  }, [pointerX, pointerY]);

  return (
    <div
      ref={frame}
      className="absolute inset-0 flex scale-[0.55] items-center justify-center tablet:scale-100"
      onPointerMove={still ? undefined : track}
      onPointerLeave={still ? undefined : settle}
    >
      {panels.map((panel, index) => (
        <Card
          key={`${panel.x}:${panel.y}`}
          panel={panel}
          index={index}
          total={panels.length}
          pointerX={pointerX}
          pointerY={pointerY}
          still={still}
          raised={raised === index}
          onRaise={setRaised}
        />
      ))}
    </div>
  );
}
