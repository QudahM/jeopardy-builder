import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import GameBuilder from './pages/GameBuilder';
import GameSetup from './pages/GameSetup';
import PlayBoard from './pages/PlayBoard';

function App() {
  return (
    <div className="min-h-screen bg-jeopardy-dark text-white font-sans selection:bg-jeopardy-gold selection:text-jeopardy-dark">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/create" element={<GameBuilder />} />
        <Route path="/edit/:id" element={<GameBuilder />} />
        <Route path="/setup/:id" element={<GameSetup />} />
        <Route path="/play/:sessionId" element={<PlayBoard />} />
      </Routes>
    </div>
  );
}

export default App;
