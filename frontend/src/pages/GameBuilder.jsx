import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, ArrowLeft, Plus, Settings } from 'lucide-react';
import { createGame, updateGame, uploadMedia, getGame } from '../api/client';

export default function GameBuilder() {
  const navigate = useNavigate();
  const { id: editId } = useParams();
  const isEditMode = Boolean(editId);

  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
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
        tier: j,
        point_value: (j + 1) * config.base_point_value,
        clue: '',
        media_type: 'none',
        media_url: '',
        media_file: null,
        answer: '',
      })),
    }))
  );

  // Load existing game data in edit mode
  useEffect(() => {
    if (!editId) return;
    let mounted = true;
    const loadGame = async () => {
      setIsLoading(true);
      try {
        const game = await getGame(editId);
        if (!mounted) return;
        setConfig({
          title: game.title,
          num_categories: game.num_categories,
          questions_per_category: game.questions_per_category,
          base_point_value: game.base_point_value,
        });
        setCategories(
          game.categories.map(cat => ({
            ...cat,
            questions: cat.questions.map(q => ({
              ...q,
              media_file: null,
            })),
          }))
        );
      } catch (err) {
        alert('Error loading game');
        console.error(err);
        navigate('/dashboard');
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    loadGame();
    return () => { mounted = false; };
  }, [editId, navigate]);

  const handleConfigChange = (e) => {
    const { name, value } = e.target;
    const numValue = parseInt(value, 10) || value;
    setConfig((prev) => ({ ...prev, [name]: numValue }));
    
    if (name === 'num_categories' || name === 'questions_per_category') {
      const numCat = name === 'num_categories' ? numValue : config.num_categories;
      const numQ = name === 'questions_per_category' ? numValue : config.questions_per_category;
      
      setCategories(
        Array(numCat).fill(null).map((_, i) => ({
          name: `Category ${i + 1}`,
          position: i,
          questions: Array(numQ).fill(null).map((_, j) => ({
            tier: j,
            point_value: (j + 1) * (name === 'base_point_value' ? numValue : config.base_point_value),
            clue: '',
            media_type: 'none',
            media_url: '',
            media_file: null,
            answer: '',
          })),
        }))
      );
    }
  };

  const handleRowPointValueChange = (rowIdx, value) => {
    const numValue = parseInt(value, 10) || 0;
    const newCats = categories.map(cat => ({
      ...cat,
      questions: cat.questions.map((q, qIdx) => 
        qIdx === rowIdx ? { ...q, point_value: numValue } : q
      )
    }));
    setCategories(newCats);
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

  const getAcceptTypes = (mediaType) => {
    switch (mediaType) {
      case 'image': return '.jpeg,.jpg,.png,.gif,.svg,.webp';
      case 'video': return '.mp4,.mov,.mkv,.avi,.webm';
      case 'audio': return '.mp3,.aac,.wav,.flac,.m4a';
      default: return '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsUploading(true);
    try {
      const payloadCats = categories.map(cat => ({
        ...cat,
        questions: cat.questions.map(q => ({ ...q })),
      }));

      // Upload all new files before finalizing the payload
      for (let i = 0; i < payloadCats.length; i++) {
        for (let j = 0; j < payloadCats[i].questions.length; j++) {
          let q = payloadCats[i].questions[j];
          if (q.media_type !== 'none' && q.media_file) {
            const result = await uploadMedia(q.media_file);
            q.media_url = result.url;
          } else if (q.media_type !== 'none' && !q.media_url) {
            q.media_type = 'none';
          }
          delete q.media_file;
        }
      }

      const payload = {
        ...config,
        categories: payloadCats
      };

      if (isEditMode) {
        await updateGame(editId, payload);
      } else {
        await createGame(payload);
      }
      navigate('/dashboard');
    } catch (err) {
      alert(`Error ${isEditMode ? 'updating' : 'creating'} game`);
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-2xl text-jeopardy-gold animate-pulse">Loading game...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate(-1)} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-3xl font-bold">{isEditMode ? 'Edit Game' : 'Game Builder'}</h1>
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
                disabled={isEditMode}
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
                disabled={isEditMode}
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
                    <div key={qIdx} className="bg-black/20 p-4 rounded-xl border border-white/5 relative group">
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-jeopardy-gold text-jeopardy-dark font-extrabold px-3 py-1 rounded-full text-xs shadow-md z-10">
                        <input
                          type="number"
                          value={q.point_value}
                          onChange={(e) => handleRowPointValueChange(qIdx, e.target.value)}
                          className="bg-transparent border-none text-center w-16 focus:outline-none focus:ring-0 appearance-none m-0"
                          title="Click to change point value for this row"
                        />
                      </div>
                      <div className="space-y-3 mt-2">
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="text-xs text-blue-300 font-semibold uppercase tracking-wider block">Clue</label>
                            <select
                              value={q.media_type || 'none'}
                              onChange={(e) => handleQuestionChange(catIdx, qIdx, 'media_type', e.target.value)}
                              className="bg-black/50 border border-white/10 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-jeopardy-gold"
                            >
                              <option value="none">Text Only</option>
                              <option value="image">Image</option>
                              <option value="audio">Audio</option>
                              <option value="video">Video</option>
                            </select>
                          </div>
                          {(q.media_type && q.media_type !== 'none') && (
                            <div className="mb-2">
                              {q.media_url && !q.media_file && (
                                <div className="text-xs text-green-400 mb-1 truncate" title={q.media_url}>
                                  ✓ Current: {q.media_url.split('/').pop().replace(/^\d+_/, '')}
                                </div>
                              )}
                              <input
                                type="file"
                                accept={getAcceptTypes(q.media_type)}
                                onChange={(e) => handleQuestionChange(catIdx, qIdx, 'media_file', e.target.files[0])}
                                className="w-full bg-white/5 rounded-lg p-2 text-sm text-white focus:outline-none focus:border focus:border-jeopardy-gold block file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-jeopardy-gold file:text-jeopardy-dark hover:file:bg-yellow-400"
                              />
                            </div>
                          )}
                          <textarea
                            value={q.clue}
                            onChange={(e) => handleQuestionChange(catIdx, qIdx, 'clue', e.target.value)}
                            className="w-full bg-white/5 rounded-lg p-2 text-sm text-white resize-none h-20 focus:outline-none focus:border focus:border-jeopardy-gold"
                            placeholder="Enter the clue text..."
                            required={!q.media_type || q.media_type === 'none'}
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
            disabled={isUploading}
            className="flex items-center gap-2 bg-jeopardy-gold text-jeopardy-dark px-12 py-4 rounded-full font-extrabold text-lg transition-all transform hover:-translate-y-1 shadow-xl shadow-jeopardy-gold/20 disabled:opacity-75 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            <Save size={24} className={isUploading ? "animate-pulse" : ""} />
            {isUploading ? 'Uploading Media & Saving...' : (isEditMode ? 'Update Game' : 'Save Game Configuration')}
          </button>
        </div>
      </form>
      <div className="h-24"></div>
    </div>
  );
}
