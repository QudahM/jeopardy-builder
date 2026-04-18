import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Users, Play, Plus, Trash2 } from 'lucide-react';
import { createSession } from '../api/client';

export default function GameSetup() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [contestants, setContestants] = useState([{ name: '' }, { name: '' }, { name: '' }]);

  const handleStartSession = async (e) => {
    e.preventDefault();
    try {
      const validContestants = contestants.filter(c => c.name.trim() !== '').map(c => ({ name: c.name, score: 0 }));
      if (validContestants.length === 0) {
        alert("Please add at least one contestant.");
        return;
      }
      
      const payload = {
        game_id: parseInt(id, 10),
        contestants: validContestants,
      };
      
      const session = await createSession(payload);
      navigate(`/play/${session.id}`);
    } catch (err) {
      alert("Error starting game session");
      console.error(err);
    }
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      <div className="flex items-center gap-4 mb-10">
        <button onClick={() => navigate(-1)} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-4xl font-black">Game Setup</h1>
      </div>

      <div className="bg-jeopardy-blue/10 backdrop-blur-md rounded-3xl p-8 border border-white/10 shadow-2xl">
        <div className="flex items-center gap-3 mb-8">
          <Users className="text-jeopardy-gold" size={32} />
          <h2 className="text-2xl font-bold text-white">Who is playing?</h2>
        </div>

        <form onSubmit={handleStartSession} className="space-y-6">
          {contestants.map((c, i) => (
            <div key={i} className="flex gap-4">
              <input
                type="text"
                placeholder={`Contestant or Team ${i + 1} Name`}
                value={c.name}
                onChange={(e) => {
                  const newC = [...contestants];
                  newC[i].name = e.target.value;
                  setContestants(newC);
                }}
                className="flex-1 bg-white/5 border border-white/20 rounded-xl px-5 py-4 text-xl text-white outline-none focus:border-jeopardy-gold focus:bg-white/10 transition-all font-semibold"
              />
              {contestants.length > 1 && (
                <button
                  type="button"
                  onClick={() => setContestants(contestants.filter((_, idx) => idx !== i))}
                  className="p-4 bg-red-500/20 text-red-400 rounded-xl hover:bg-red-500/30 transition-colors"
                >
                  <Trash2 size={24} />
                </button>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={() => setContestants([...contestants, { name: '' }])}
            className="w-full py-4 rounded-xl border-2 border-dashed border-white/20 text-gray-400 hover:text-white hover:border-white/40 flex justify-center items-center gap-2 font-bold transition-colors"
          >
            <Plus size={20} />
            Add Contestant
          </button>

          <div className="pt-8">
            <button
              type="submit"
              className="w-full py-5 rounded-2xl bg-linear-to-r from-jeopardy-gold to-yellow-400 text-jeopardy-dark text-xl font-black flex justify-center items-center gap-3 hover:scale-[1.02] active:scale-95 transition-transform shadow-xl shadow-yellow-500/20"
            >
              <Play fill="currentColor" size={24} />
              BEGIN GAME
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
