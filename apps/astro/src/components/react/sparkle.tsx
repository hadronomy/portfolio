import React from 'react';

import random from 'random';

import { usePrefersReducedMotion, useRandomInterval } from './hooks';

// Helper function to generate a range of numbers
const range = (start: number, end?: number, step = 1) => {
  const output = [];
  let actualStart = start;
  let actualEnd = end;

  if (typeof actualEnd === 'undefined') {
    actualEnd = start;
    actualStart = 0;
  }
  for (let i = actualStart; i < actualEnd; i += step) {
    output.push(i);
  }
  return output;
};

// Define the Sparkle type based on generateSparkle's return
interface Sparkle {
  id: string;
  createdAt: number;
  color: string;
  size: number;
  style: {
    top: string;
    left: string;
    zIndex: number;
  };
}

interface SparklesProps extends React.ComponentProps<'span'> {
  color?: string;
}

export function Sparkles({ children, color = DEFAULT_COLOR }: SparklesProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [sparkles, setSparkles] = React.useState<Sparkle[]>(() => {
    return range(3).map(() => generateSparkle(color));
  });

  useRandomInterval(
    () => {
      if (prefersReducedMotion) {
        return;
      }
      const now = Date.now();

      // Create a new sparkle
      const sparkle = generateSparkle(color);

      // Clean up any "expired" sparkles
      const nextSparkles = sparkles.filter((s: Sparkle) => {
        // Typed sparkle parameter
        const delta = now - s.createdAt;
        return delta < 1000;
      });

      // Include our new sparkle
      nextSparkles.push(sparkle);

      // Make it so!
      setSparkles(nextSparkles);
    },
    prefersReducedMotion ? null : 50, // Pass null to disable interval if prefersReducedMotion
    prefersReducedMotion ? null : 500,
  );

  return (
    <span className="relative inline-block">
      {sparkles.map((sparkle) => (
        <SparkleInstance
          key={sparkle.id}
          color={sparkle.color}
          size={sparkle.size}
          style={sparkle.style}
        />
      ))}
      <strong className="relative z-1 font-bold">{children}</strong>
    </span>
  );
}

const DEFAULT_COLOR = 'hsl(50deg, 100%, 50%)';

// Return type of generateSparkle matches the Sparkle interface
function generateSparkle(color: string = DEFAULT_COLOR): Sparkle {
  return {
    id: String(random.int(10000, 99999)),
    createdAt: Date.now(),
    // Bright yellow color:
    color,
    size: random.int(10, 20),
    style: {
      // Pick a random spot in the available space
      top: `${random.int(0, 100)}%`,
      left: `${random.int(0, 100)}%`,
      // Float sparkles above sibling content
      zIndex: 2,
    },
  };
}

interface SparkleInstanceProps {
  color: string;
  style: React.CSSProperties;
  size: string | number; // size can be number as per generateSparkle
}

export function SparkleInstance({ color, size, style }: SparkleInstanceProps) {
  return (
    <div
      className="absolute pointer-events-none z-2 motion-safe:animate-sparkle"
      style={style}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        fill="none"
        className="motion-safe:animate-spin"
        viewBox="0 0 160 160"
      >
        <path
          fill={color}
          d="M80 0s4.285 41.293 21.496 58.504S160 80 160 80s-41.293 4.285-58.504 21.496S80 160 80 160s-4.285-41.293-21.496-58.504S0 80 0 80s41.293-4.285 58.504-21.496S80 0 80 0"
        />
      </svg>
    </div>
  );
}
