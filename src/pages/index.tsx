import NavBar from '@components/NavBar';
import InteractiveRoom from '@components/InteractiveRoom';

export default function Home() {
  return (
    <>
      <NavBar />
      <main className="flex min-h-screen flex-col">
        <div className="flex flex-grow justify-center">
          <div className="flex-grow">
            <InteractiveRoom />
          </div>
        </div>
      </main>
    </>
  );
}
