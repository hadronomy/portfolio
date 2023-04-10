import NavBar from '@components/NavBar'
import InteractiveRoom from '@components/InteractiveRoom'

export default function Home() {
  return (
    <>
      <NavBar />
      <main className="flex flex-col min-h-screen">
        <div className="flex flex-grow justify-center">
          <div className="flex-grow">
            <InteractiveRoom />
          </div>
        </div>
      </main>
    </>
  )
}
