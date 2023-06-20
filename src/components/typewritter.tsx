'use client';

import TypewritterEffect from 'typewriter-effect';

export type TypewritterProps = {};

export function Typewritter({}: TypewritterProps) {
  return (
    <TypewritterEffect
      options={{ loop: true }}
      onInit={(typewriter) => {
        typewriter
          .typeString('Hi 👋')
          .pauseFor(500)
          .deleteAll()
          .typeString(`I'm a <b class="text-emerald-500">Developer</b>`)
          .pauseFor(1000)
          .deleteChars('Developer'.length)
          .pauseFor(1000)
          .deleteAll()
          .typeString(
            '<span>I 💕 <b class="text-amber-300">EVERYTHING</b></span> related to code'
          )
          .changeDeleteSpeed(50)
          .deleteAll()
          .start();
      }}
    />
  );
}
