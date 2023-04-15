import { Baloo_Chettan_2, Bellota } from 'next/font/google';
import Typewritter from 'typewriter-effect';
import InteractiveRoom from '@components/InteractiveRoom';

const balooChettan2 = Baloo_Chettan_2({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700']
});

const bellota = Bellota({
  subsets: ['latin'],
  weight: ['400', '400', '700']
});

type Props = {};

export default function Hero({}: Props) {
  return (
    <div className="relative flex flex-grow grid-cols-12 grid-rows-6 gap-4 p-10">
      <div className="z-10 flex h-auto w-auto justify-center rounded-2xl p-5 pt-40 text-left">
        <div className="flex flex-col">
          <span className="text-6xl md:text-8xl">
            <span className={`${balooChettan2.className} `}>I&apos;m </span>
            <span className="font-semibold">Pablo</span>
          </span>
          <span
            className={`${bellota.className} text-5xl font-semibold underline decoration-sky-500 md:text-8xl`}
          >
            Hernandez
          </span>
          <span className="mt-4 text-4xl will-change-contents">
            <Typewritter
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
          </span>
        </div>
      </div>
      <div className="bottom-0 right-0 z-0 hidden h-full w-full overflow-clip rounded-2xl md:absolute md:flex">
        <InteractiveRoom />
      </div>
    </div>
  );
}
