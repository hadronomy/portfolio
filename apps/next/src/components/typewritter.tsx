'use client';

import TypewritterEffect from 'typewriter-effect';

export type TypewritterProps = Record<string, never>;

export function Typewritter({}: TypewritterProps) {
  return (
    <TypewritterEffect
      options={{ loop: true }}
      onInit={(typewriter) => {
        typewriter
          .typeString('Hi 👋')
          .pauseFor(200)
          .deleteAll()
          .typeString(`Full Stack <b class="text-emerald-500">Developer</b>`)
          .pauseFor(1000)
          .deleteChars('Developer'.length)
          .pauseFor(1000)
          .deleteAll()
          .typeString(
            '<span>Lover💕 of <b class="text-amber-300">EVERYTHING</b></span> related to code'
          )
          .changeDeleteSpeed(50)
          .deleteAll()
          .start();
      }}
    />
  );
}
