import NavBar from '@components/NavBar'
import InteractiveRoom from '@components/InteractiveRoom'

export default function Home() {
  return (
    <main className="flex flex-col min-h-screen">
      <NavBar />
      <div className="flex flex-grow justify-center">
        <div className="flex-grow">
          <InteractiveRoom />
        </div>
      </div>
    </main>  
  )
}
