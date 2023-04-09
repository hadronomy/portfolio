import Image from 'next/image'

export default function NavBar() {
  return (
    <div className="flex justify-start items-center h-25 p-3 pt-5 pr-10 bg-black/10 backdrop-blur-md">
      <Image
        className="relative dark:drop-shadow-[0_0_0.3rem_#ffffff70] dark:invert ml-5"
        src="/next.svg"
        alt="Next.js Logo"
        width={90}
        height={40}
        priority
        />
      <div className="flex-auto"/>
      <div className="flex">
        <div className="flex gap-x-10 font-thin uppercase">
          <a 
            className="dark:hover:drop-shadow-[0_0_0.3rem_#ffffff70]"
            href="/about"
            >
            About
          </a>
          <a 
            className="dark:hover:drop-shadow-[0_0_0.3rem_#ffffff70]"
            href="/about"
            >
            Contact
          </a>
        </div>
      </div>
    </div>
  )
}
