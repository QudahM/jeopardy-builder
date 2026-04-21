import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, ArrowLeft, Plus, Settings, Trophy } from 'lucide-react';
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
        options: '',
        answer: '',
        answer_media_type: 'none',
        answer_media_url: '',
        answer_media_file: null,
      })),
    }))
  );

  const [finalJeopardy, setFinalJeopardy] = useState({
    category: '',
    clue: '',
    answer: '',
    media_type: 'none',
    media_url: '',
    media_file: null,
    answer_media_type: 'none',
    answer_media_url: '',
    answer_media_file: null,
  });

  const handleFinalJeopardyChange = (field, value) => {
    setFinalJeopardy(prev => ({ ...prev, [field]: value }));
  };

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
              answer_media_file: null,
            })),
          }))
        );
        setFinalJeopardy({
          category: game.final_jeopardy_category || '',
          clue: game.final_jeopardy_clue || '',
          answer: game.final_jeopardy_answer || '',
          media_type: game.final_jeopardy_media_type || 'none',
          media_url: game.final_jeopardy_media_url || '',
          media_file: null,
          answer_media_type: game.final_jeopardy_answer_media_type || 'none',
          answer_media_url: game.final_jeopardy_answer_media_url || '',
          answer_media_file: null,
        });
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
            options: '',
            answer: '',
            answer_media_type: 'none',
            answer_media_url: '',
            answer_media_file: null,
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

  const parseOptions = (optionsStr) => {
    if (!optionsStr) return [];
    try { return JSON.parse(optionsStr); } catch { return []; }
  };

  const updateOption = (catIdx, qIdx, optionIdx, value) => {
    const newCats = [...categories];
    const opts = parseOptions(newCats[catIdx].questions[qIdx].options);
    opts[optionIdx] = value;
    newCats[catIdx].questions[qIdx].options = JSON.stringify(opts);
    setCategories(newCats);
  };

  const addOption = (catIdx, qIdx) => {
    const newCats = [...categories];
    const opts = parseOptions(newCats[catIdx].questions[qIdx].options);
    opts.push('');
    newCats[catIdx].questions[qIdx].options = JSON.stringify(opts);
    setCategories(newCats);
  };

  const removeOption = (catIdx, qIdx, optionIdx) => {
    const newCats = [...categories];
    const opts = parseOptions(newCats[catIdx].questions[qIdx].options);
    opts.splice(optionIdx, 1);
    newCats[catIdx].questions[qIdx].options = opts.length > 0 ? JSON.stringify(opts) : '';
    setCategories(newCats);
  };

  const toggleMultipleChoice = (catIdx, qIdx) => {
    const newCats = [...categories];
    const q = newCats[catIdx].questions[qIdx];
    if (parseOptions(q.options).length > 0) {
      q.options = '';
    } else {
      q.options = JSON.stringify(['', '', '', '']);
    }
    setCategories(newCats);
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

          // Handle answer media uploads
          if (q.answer_media_type !== 'none' && q.answer_media_file) {
            const result = await uploadMedia(q.answer_media_file);
            q.answer_media_url = result.url;
          } else if (q.answer_media_type !== 'none' && !q.answer_media_url) {
            q.answer_media_type = 'none';
          }
          delete q.answer_media_file;
        }
      }

      // Upload Final Jeopardy media
      const fjPayload = { ...finalJeopardy };
      if (fjPayload.media_type !== 'none' && fjPayload.media_file) {
        const result = await uploadMedia(fjPayload.media_file);
        fjPayload.media_url = result.url;
      } else if (fjPayload.media_type !== 'none' && !fjPayload.media_url) {
        fjPayload.media_type = 'none';
      }
      delete fjPayload.media_file;

      if (fjPayload.answer_media_type !== 'none' && fjPayload.answer_media_file) {
        const result = await uploadMedia(fjPayload.answer_media_file);
        fjPayload.answer_media_url = result.url;
      } else if (fjPayload.answer_media_type !== 'none' && !fjPayload.answer_media_url) {
        fjPayload.answer_media_type = 'none';
      }
      delete fjPayload.answer_media_file;

      const payload = {
        ...config,
        categories: payloadCats,
        final_jeopardy_category: fjPayload.category,
        final_jeopardy_clue: fjPayload.clue,
        final_jeopardy_answer: fjPayload.answer,
        final_jeopardy_media_type: fjPayload.media_type,
        final_jeopardy_media_url: fjPayload.media_url,
        final_jeopardy_answer_media_type: fjPayload.answer_media_type,
        final_jeopardy_answer_media_url: fjPayload.answer_media_url,
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
                              className="bg-jeopardy-blue/80 border border-jeopardy-gold/40 rounded-lg px-3 py-1.5 text-xs text-jeopardy-gold font-semibold focus:outline-none focus:border-jeopardy-gold focus:ring-1 focus:ring-jeopardy-gold/50 cursor-pointer appearance-none pr-6"
                              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23ffcc00' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center' }}
                            >
                              <option value="none" className="bg-[#0a1128] text-white">Text Only</option>
                              <option value="image" className="bg-[#0a1128] text-white">Image</option>
                              <option value="audio" className="bg-[#0a1128] text-white">Audio</option>
                              <option value="video" className="bg-[#0a1128] text-white">Video</option>
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

                          {/* Multiple Choice Toggle */}
                          <button
                            type="button"
                            onClick={() => toggleMultipleChoice(catIdx, qIdx)}
                            className={`w-full text-xs font-semibold py-1.5 rounded-lg border transition-all ${
                              parseOptions(q.options).length > 0
                                ? 'bg-jeopardy-gold/20 border-jeopardy-gold/50 text-jeopardy-gold'
                                : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:border-white/20'
                            }`}
                          >
                            {parseOptions(q.options).length > 0 ? '✓ Multiple Choice Enabled' : '+ Add Multiple Choice Options'}
                          </button>

                          {/* Multiple Choice Options */}
                          {parseOptions(q.options).length > 0 && (
                            <div className="space-y-1.5 mt-1">
                              {parseOptions(q.options).map((opt, optIdx) => (
                                <div key={optIdx} className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-jeopardy-gold w-5 shrink-0">
                                    {String.fromCharCode(65 + optIdx)})
                                  </span>
                                  <input
                                    type="text"
                                    value={opt}
                                    onChange={(e) => updateOption(catIdx, qIdx, optIdx, e.target.value)}
                                    className="flex-1 bg-white/5 rounded-md p-1.5 text-xs text-white focus:outline-none focus:border focus:border-jeopardy-gold"
                                    placeholder={`Option ${String.fromCharCode(65 + optIdx)}...`}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removeOption(catIdx, qIdx, optIdx)}
                                    className="text-red-400 hover:text-red-300 text-xs px-1"
                                    title="Remove option"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))}
                              <button
                                type="button"
                                onClick={() => addOption(catIdx, qIdx)}
                                className="w-full text-xs text-blue-300 hover:text-blue-200 py-1 border border-dashed border-white/10 rounded-md hover:border-white/20 transition"
                              >
                                + Add Option
                              </button>
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="text-xs text-jeopardy-gold font-semibold uppercase tracking-wider block">Answer</label>
                            <select
                              value={q.answer_media_type || 'none'}
                              onChange={(e) => handleQuestionChange(catIdx, qIdx, 'answer_media_type', e.target.value)}
                              className="bg-jeopardy-blue/80 border border-jeopardy-gold/40 rounded-lg px-3 py-1.5 text-xs text-jeopardy-gold font-semibold focus:outline-none focus:border-jeopardy-gold focus:ring-1 focus:ring-jeopardy-gold/50 cursor-pointer appearance-none pr-6"
                              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23ffcc00' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center' }}
                            >
                              <option value="none" className="bg-[#0a1128] text-white">Text Only</option>
                              <option value="image" className="bg-[#0a1128] text-white">Image</option>
                              <option value="video" className="bg-[#0a1128] text-white">Video</option>
                            </select>
                          </div>
                          {(q.answer_media_type && q.answer_media_type !== 'none') && (
                            <div className="mb-2">
                              {q.answer_media_url && !q.answer_media_file && (
                                <div className="text-xs text-green-400 mb-1 truncate" title={q.answer_media_url}>
                                  ✓ Current: {q.answer_media_url.split('/').pop().replace(/^\d+_/, '')}
                                </div>
                              )}
                              <input
                                type="file"
                                accept={getAcceptTypes(q.answer_media_type)}
                                onChange={(e) => handleQuestionChange(catIdx, qIdx, 'answer_media_file', e.target.files[0])}
                                className="w-full bg-white/5 rounded-lg p-2 text-sm text-white focus:outline-none focus:border focus:border-jeopardy-gold block file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-jeopardy-gold file:text-jeopardy-dark hover:file:bg-yellow-400"
                              />
                            </div>
                          )}
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

        {/* Final Jeopardy Section */}
        <section className="bg-linear-to-r from-red-900/30 to-red-800/20 p-10 rounded-3xl border border-red-500/30 backdrop-blur-md shadow-2xl relative overflow-hidden">
          {/* Decorative element */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-jeopardy-gold/5 rounded-full blur-3xl -mr-32 -mt-32"></div>
          
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-10 relative z-10">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-jeopardy-gold/10 rounded-2xl border border-jeopardy-gold/20">
                <Trophy className="text-jeopardy-gold" size={32} />
              </div>
              <div>
                <h2 className="text-3xl font-bold text-white tracking-tight">Final Jeopardy</h2>
                <p className="text-sm text-gray-400 mt-1">Configure the climactic final question of your game</p>
              </div>
            </div>
            <div className="px-4 py-2 bg-black/30 rounded-full border border-white/10 backdrop-blur-sm text-xs font-medium text-gray-400 whitespace-nowrap">
               Optional — wagers set by host during play
            </div>
          </div>

          <div className="space-y-10 relative z-10">
            {/* Row 1: Category Name - Centered focus */}
            <div className="max-w-3xl mx-auto space-y-3">
              <div className="flex justify-center">
                <label className="text-xs text-jeopardy-gold font-bold uppercase tracking-[0.3em] mb-1">Final Category</label>
              </div>
              <input
                type="text"
                value={finalJeopardy.category}
                onChange={(e) => handleFinalJeopardyChange('category', e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-2xl p-5 text-white text-center font-black text-2xl uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-jeopardy-gold/50 focus:border-jeopardy-gold transition shadow-inner placeholder:text-white/10"
                placeholder="ENTER CATEGORY NAME..."
              />
            </div>

            {/* Row 2: Clue and Answer mirrored cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Clue Card */}
              <div className="bg-black/40 p-8 rounded-3xl border border-white/5 space-y-5 shadow-xl hover:border-white/10 transition group">
                <div className="flex justify-between items-center">
                  <label className="text-xs text-blue-300 font-bold uppercase tracking-widest">The Clue</label>
                  <select
                    value={finalJeopardy.media_type || 'none'}
                    onChange={(e) => handleFinalJeopardyChange('media_type', e.target.value)}
                    className="bg-jeopardy-blue/60 border border-jeopardy-gold/30 rounded-xl px-4 py-2 text-xs text-jeopardy-gold font-bold focus:outline-none focus:ring-1 focus:ring-jeopardy-gold cursor-pointer appearance-none pr-8 transition"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23ffcc00' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
                  >
                    <option value="none">Text Only</option>
                    <option value="image">Image</option>
                    <option value="audio">Audio</option>
                    <option value="video">Video</option>
                  </select>
                </div>
                
                {(finalJeopardy.media_type && finalJeopardy.media_type !== 'none') && (
                  <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                    {finalJeopardy.media_url && !finalJeopardy.media_file && (
                      <div className="text-xs text-green-400 mb-2 font-medium flex items-center gap-1.5 px-3 py-1 bg-green-400/5 rounded-full border border-green-400/10 w-fit">
                        <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
                        Current: {finalJeopardy.media_url.split('/').pop().replace(/^\d+_/, '')}
                      </div>
                    )}
                    <input
                      type="file"
                      accept={getAcceptTypes(finalJeopardy.media_type)}
                      onChange={(e) => handleFinalJeopardyChange('media_file', e.target.files[0])}
                      className="w-full bg-white/5 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-jeopardy-gold block file:mr-4 file:py-1.5 file:px-4 file:rounded-full file:border-0 file:text-[10px] file:font-black file:uppercase file:bg-jeopardy-gold file:text-jeopardy-dark hover:file:bg-yellow-400 transition"
                    />
                  </div>
                )}
                
                <textarea
                  value={finalJeopardy.clue}
                  onChange={(e) => handleFinalJeopardyChange('clue', e.target.value)}
                  className="w-full bg-white/5 rounded-2xl p-4 text-base text-white resize-none h-32 focus:outline-none focus:ring-1 focus:ring-jeopardy-gold/30 focus:bg-white/10 transition placeholder:text-white/20"
                  placeholder="Enter the cryptic clue text..."
                />
              </div>

              {/* Answer Card */}
              <div className="bg-black/40 p-8 rounded-3xl border border-white/5 space-y-5 shadow-xl hover:border-white/10 transition group">
                <div className="flex justify-between items-center">
                  <label className="text-xs text-jeopardy-gold font-bold uppercase tracking-widest">The Answer</label>
                  <select
                    value={finalJeopardy.answer_media_type || 'none'}
                    onChange={(e) => handleFinalJeopardyChange('answer_media_type', e.target.value)}
                    className="bg-jeopardy-blue/60 border border-jeopardy-gold/30 rounded-xl px-4 py-2 text-xs text-jeopardy-gold font-bold focus:outline-none focus:ring-1 focus:ring-jeopardy-gold cursor-pointer appearance-none pr-8 transition"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23ffcc00' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
                  >
                    <option value="none">Text Only</option>
                    <option value="image">Image</option>
                    <option value="video">Video</option>
                  </select>
                </div>

                {(finalJeopardy.answer_media_type && finalJeopardy.answer_media_type !== 'none') && (
                  <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                    {finalJeopardy.answer_media_url && !finalJeopardy.answer_media_file && (
                      <div className="text-xs text-green-400 mb-2 font-medium flex items-center gap-1.5 px-3 py-1 bg-green-400/5 rounded-full border border-green-400/10 w-fit">
                        <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
                        Current: {finalJeopardy.answer_media_url.split('/').pop().replace(/^\d+_/, '')}
                      </div>
                    )}
                    <input
                      type="file"
                      accept={getAcceptTypes(finalJeopardy.answer_media_type)}
                      onChange={(e) => handleFinalJeopardyChange('answer_media_file', e.target.files[0])}
                      className="w-full bg-white/5 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-jeopardy-gold block file:mr-4 file:py-1.5 file:px-4 file:rounded-full file:border-0 file:text-[10px] file:font-black file:uppercase file:bg-jeopardy-gold file:text-jeopardy-dark hover:file:bg-yellow-400 transition"
                    />
                  </div>
                )}
                
                <textarea
                  value={finalJeopardy.answer}
                  onChange={(e) => handleFinalJeopardyChange('answer', e.target.value)}
                  className="w-full bg-white/5 rounded-2xl p-4 text-base text-white resize-none h-32 focus:outline-none focus:ring-1 focus:ring-jeopardy-gold/30 focus:bg-white/10 transition placeholder:text-white/20"
                  placeholder="What is the correct response? (the 'What is...' format)"
                />
              </div>
            </div>
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
