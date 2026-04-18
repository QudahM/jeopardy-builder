import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, ArrowLeft, Plus, Settings } from 'lucide-react';
import { createGame } from '../api/client';

export default function GameBuilder() {
  const navigate = useNavigate();
  const [config, setConfig] = useState({
    title: 'New Game',
    num_categories: 6,
    questions_per_category: 5,
    base_point_value: 100,
  });

  const [categories, setCategories] = useState(
    Array(config.num_categories).fill(null).map((_, i) => ({
      name: `Category ${i + 1}`,
      position: i,
      questions: Array(config.questions_per_category).fill(null).map((_, j) => ({
        tier: j + 1,
        clue: '',
        answer: '',
      })),
    }))
  );

  const handleConfigChange = (e) => {
    const { name, value } = e.target;
    const numValue = parseInt(value, 10) || value;
    setConfig((prev) => ({ ...prev, [name]: numValue }));
    
    // Simplification for the exercise: If num_categories or questions change, we reset the board array.
    // In a fully robust app, it would append/remove to preserve data.
    if (name === 'num_categories' || name === 'questions_per_category') {
      const numCat = name === 'num_categories' ? numValue : config.num_categories;
      const numQ = name === 'questions_per_category' ? numValue : config.questions_per_category;
      
      setCategories(
        Array(numCat).fill(null).map((_, i) => ({
          name: `Category ${i + 1}`,
          position: i,
          questions: Array(numQ).fill(null).map((_, j) => ({
            tier: j + 1,
            clue: '',
            answer: '',
          })),
        }))
      );
    }
  };

  const handleCategoryNameChange = (catIdx, name) => {
    const newCats = [...categories];
    newCats[catIdx].name = name;
    setCategories(newCats);
  };

  const handleQuestionChange = (catIdx, qIdx, field, value) => {
    const newCats = [...categories];
    newCats[catIdx].questions[qIdx][field] = value;
    setCategories(newCats);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...config,
        categories
      };
      await createGame(payload);
      navigate('/');
    } catch (err) {
      alert('Error creating game');
      console.error(err);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate(-1)} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-3xl font-bold">Game Builder</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-12">
        {/* Config Section */}
        <section className="bg-jeopardy-blue/20 p-8 rounded-3xl border border-jeopardy-blue/30 backdrop-blur-md">
          <div className="flex items-center gap-3 mb-6">
            <Settings className="text-jeopardy-gold" size={28} />
            <h2 className="text-2xl font-semibold">Game Settings</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Game Title</label>
              <input
                type="text"
                name="title"
                value={config.title}
                onChange={handleConfigChange}
                className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-jeopardy-gold transition"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Categories (Max 6)</label>
              <input
                type="number"
                name="num_categories"
                value={config.num_categories}
                onChange={handleConfigChange}
                min="1" max="6"
                className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-jeopardy-gold transition"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Questions per Category</label>
              <input
                type="number"
                name="questions_per_category"
                value={config.questions_per_category}
                onChange={handleConfigChange}
                min="1" max="10"
                className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-jeopardy-gold transition"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Base Value ($)</label>
              <input
                type="number"
                name="base_point_value"
                value={config.base_point_value}
                onChange={handleConfigChange}
                step="100" min="100"
                className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-jeopardy-gold transition"
                required
              />
            </div>
          </div>
        </section>

        {/* Board Builder */}
        <section className="space-y-8">
          <h2 className="text-2xl font-semibold flex items-center gap-2">Board Content</h2>
          <div className="flex gap-6 overflow-x-auto pb-4 snap-x pr-8">
            {categories.map((cat, catIdx) => (
              <div key={catIdx} className="min-w-[320px] snap-center bg-white/5 p-4 rounded-2xl border border-white/10 shrink-0">
                <input
                  type="text"
                  value={cat.name}
                  onChange={(e) => handleCategoryNameChange(catIdx, e.target.value)}
                  className="w-full bg-jeopardy-blue text-white text-center font-bold text-xl uppercase p-3 rounded-xl mb-4 focus:outline-none focus:ring-2 focus:ring-jeopardy-gold"
                  placeholder="CATEGORY NAME"
                  required
                />
                
                <div className="space-y-4">
                  {cat.questions.map((q, qIdx) => (
                    <div key={qIdx} className="bg-black/20 p-4 rounded-xl border border-white/5 relative">
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-jeopardy-gold text-jeopardy-dark font-extrabold px-3 py-1 rounded-full text-xs">
                        ${q.tier * config.base_point_value}
                      </div>
                      <div className="space-y-3 mt-2">
                        <div>
                          <label className="text-xs text-blue-300 font-semibold uppercase tracking-wider block mb-1">Clue</label>
                          <textarea
                            value={q.clue}
                            onChange={(e) => handleQuestionChange(catIdx, qIdx, 'clue', e.target.value)}
                            className="w-full bg-white/5 rounded-lg p-2 text-sm text-white resize-none h-20 focus:outline-none focus:border focus:border-jeopardy-gold"
                            placeholder="Enter the clue..."
                            required
                          />
                        </div>
                        <div>
                          <label className="text-xs text-jeopardy-gold font-semibold uppercase tracking-wider block mb-1">Answer</label>
                          <input
                            type="text"
                            value={q.answer}
                            onChange={(e) => handleQuestionChange(catIdx, qIdx, 'answer', e.target.value)}
                            className="w-full bg-white/5 rounded-lg p-2 text-sm text-white focus:outline-none focus:border focus:border-jeopardy-gold"
                            placeholder="What is..."
                            required
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="fixed bottom-0 left-0 right-0 bg-jeopardy-dark/90 backdrop-blur-md p-4 border-t border-white/10 flex justify-center z-50">
          <button
            type="submit"
            className="flex items-center gap-2 bg-jeopardy-gold text-jeopardy-dark px-12 py-4 rounded-full font-extrabold text-lg hover:bg-yellow-400 transition-all transform hover:scale-105 shadow-xl shadow-jeopardy-gold/20"
          >
            <Save size={24} />
            Save Game Configuration
          </button>
        </div>
      </form>
      <div className="h-24"></div>
    </div>
  );
}
