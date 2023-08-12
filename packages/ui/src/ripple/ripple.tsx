'use client';

import { motion, AnimatePresence  } from 'framer-motion';
import type {HTMLMotionProps} from 'framer-motion';
import type { RippleType } from './use-ripple';

export type RippleProps = HTMLMotionProps<'span'> & {
  ripples: RippleType[],
  color?: string,
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
};

export function Ripple({ ripples = [], color, style, ...props }: RippleProps) {
  return (
    <>
      {ripples.map(({key, size, x, y}) => {
        const duration = clamp(0.01 * size, 0.2, size > 100 ? 0.75 : 0.5);

        return (
          <AnimatePresence key={key} mode='popLayout'>
            <motion.span
              animate={{transform: "scale(2)", opacity: 0}}
              className='bg-muted'
              exit={{opacity: 0}}
              initial={{transform: "scale(0)", opacity: 0.35}}
              style={{
                position: "absolute",
                backgroundColor: color,
                borderRadius: "100%",
                transformOrigin: "center",
                pointerEvents: "none",
                zIndex: 10,
                top: y,
                left: x,
                width: `${size}px`,
                height: `${size}px`,
                ...style,
              }}
              transition={{duration}}
              {...props}
            >
            </motion.span>
          </AnimatePresence>
        )
      })}
    </>
  )
}

Ripple.displayName = 'Ripple';
