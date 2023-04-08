import Image from 'next/image'
import { Roboto } from 'next/font/google'
import NavBar from '@components/NavBar'

const roboto = Roboto({ subsets: ['latin'], weight: ['100', '300', '400', '500', '700', '900']})

export default function Home() {
  return (
    <main className={`${roboto.className} flex flex-col min-h-screen`}>
      <NavBar />
      <div className="flex flex-grow justify-center">
        <div className="flex-grow">

        </div>
      </div>
    </main>  
  )
}
