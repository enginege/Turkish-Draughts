import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthForm } from './components/auth/auth-form';
import { GameRoom } from './components/game/game-room';
import { Lobby } from './components/lobby/lobby';
import { Navbar } from './components/ui/navbar';
import { useAuth } from './hooks/use-auth';

function App() {
  const { user } = useAuth();

  return (
    <>
      <Router>
        {user && <Navbar />}
        <div className={user ? 'pl-20' : ''}>
          <Routes>
            <Route path="/" element={user ? <Lobby /> : <AuthForm />} />
            <Route path="/room/:roomId" element={<GameRoom />} />
          </Routes>
        </div>
      </Router>
      <Toaster position="top-right" />
    </>
  );
}

export default App;