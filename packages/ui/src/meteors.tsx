import type { JSX } from 'react';

import { cn } from './utils/cn';

export type MeteorsProps = {
  number?: number;
  className?: string;
};

export function Meteors({ number = 20, className }: MeteorsProps): JSX.Element {
  const meteors = Array.from({ length: number });

  return (
    <>
      {meteors.map((_, index) => (
        <span
          key={`meteor-${index}`}
          className={cn(
            'animate-meteor-effect absolute top-1/2 left-1/2 h-0.5 w-0.5 rounded-[9999px] bg-slate-500 shadow-[0_0_0_1px_#ffffff10] rotate-[215deg]',
            "before:content-[''] before:absolute before:top-1/2 before:transform before:-translate-y-[50%] before:w-[50px] before:h-[1px] before:bg-linear-to-r before:from-[#64748b] before:to-transparent",
            className,
          )}
          style={{
            top: 0,
            left: `${Math.floor(Math.random() * 800 - 400)}px`,
            animationDelay: `${Math.random() * 0.6 + 0.2}s`,
            animationDuration: `${Math.floor(Math.random() * 8 + 2)}s`,
          }}
        />
      ))}
    </>
  );
}
