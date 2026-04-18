import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Play, Plus, Trash2 } from 'lucide-react';
import { getGames, deleteGame } from '../api/client';

export default function Home() {
  const [games, setGames] = useState([]);

  useEffect(() => {
    let mounted = true;
    const loadGames = async () => {
      const data = await getGames();
      if (mounted) {
        setGames(data || []);
      }
    };
    loadGames();
    return () => { mounted = false; };
  }, []);

  const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this game?')) {
      await deleteGame(id);
      const data = await getGames();
      setGames(data || []);
    }
  };

  return (
    <div className="container mx-auto px-4 py-12">
      <header className="flex justify-between items-center mb-12">
        <h1 className="text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-linear-to-r from-jeopardy-gold to-yellow-200 drop-shadow-sm">
          JEOPARDY! <span className="text-2xl font-normal text-white">Creator</span>
        </h1>
        <Link
          to="/create"
          className="flex items-center gap-2 bg-jeopardy-gold text-jeopardy-dark px-6 py-3 rounded-full font-bold hover:bg-yellow-400 transition-all transform hover:scale-105 shadow-lg shadow-jeopardy-gold/20"
        >
          <Plus size={20} />
          Create Game
        </Link>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {games.map((game) => (
          <div
            key={game.id}
            className="group relative bg-jeopardy-blue/20 backdrop-blur-md rounded-2xl p-6 border border-jeopardy-gold/30 hover:border-jeopardy-gold transition-all duration-300 shadow-xl"
          >
            <h2 className="text-2xl font-bold mb-2 text-white">{game.title}</h2>
            <div className="text-gray-300 text-sm mb-6 flex flex-col gap-1">
              <span>{game.num_categories} Categories</span>
              <span>{game.questions_per_category} Questions each</span>
              <span>Base Value: ${game.base_point_value}</span>
            </div>

            <div className="flex justify-between items-center mt-auto">
              <Link
                to={`/setup/${game.id}`}
                className="flex items-center gap-2 bg-jeopardy-blue hover:bg-blue-600 text-white px-5 py-2 rounded-lg font-semibold transition-colors"
              >
                <Play size={18} />
                Play Now
              </Link>
              <button
                onClick={() => handleDelete(game.id)}
                className="text-red-400 hover:text-red-300 p-2 rounded-lg hover:bg-red-400/10 transition-colors"
                title="Delete Game"
              >
                <Trash2 size={20} />
              </button>
            </div>
          </div>
        ))}

        {games.length === 0 && (
          <div className="col-span-full text-center py-24 bg-jeopardy-blue/10 rounded-3xl border border-dashed border-jeopardy-blue/50">
            <h3 className="text-2xl font-medium text-gray-300 mb-4">No games created yet!</h3>
            <p className="text-gray-500 mb-6">Create your first custom Jeopardy board to get started.</p>
            <Link
              to="/create"
              className="inline-flex items-center gap-2 bg-jeopardy-gold text-jeopardy-dark px-6 py-3 rounded-full font-bold hover:bg-yellow-400 transition-colors"
            >
              <Plus size={20} />
              Create Game
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
