import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Home, X, Trophy } from 'lucide-react';

import { getSession, updateScore, markQuestion } from '../api/client';

export default function PlayBoard() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [activeQuestion, setActiveQuestion] = useState(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [loading, setLoading] = useState(true);

  // Final Jeopardy state
  const [fjActive, setFjActive] = useState(false);
  const [fjShowAnswer, setFjShowAnswer] = useState(false);
  const [fjWagers, setFjWagers] = useState({});
  const [fjUsed, setFjUsed] = useState(false);

  const fetchSessionData = useCallback(async (isRefresh = false) => {
    try {
      const data = await getSession(sessionId);
      setSession(data);
    } catch(err) {
      console.error(err);
      alert('Failed to load session');
    } finally {
      if (!isRefresh) {
        setLoading(false);
      }
    }
  }, [sessionId]);

  const loadSession = fetchSessionData;

  useEffect(() => {
    let ignore = false;
    
    async function initFetch() {
      try {
        const data = await getSession(sessionId);
        if (!ignore) {
          setSession(data);
        }
      } catch(err) {
        if (!ignore) {
          console.error(err);
          alert('Failed to load session');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }
    
    initFetch();
    
    return () => { ignore = true; };
  }, [sessionId]);

  const handleQuestionClick = (q) => {
    setActiveQuestion(q);
    setShowAnswer(false);
  };

  const closeQuestionModal = async () => {
    if (activeQuestion) {
      await markQuestion(session.id, activeQuestion.id);
      await loadSession(); // Refresh board state
    }
    setActiveQuestion(null);
    setShowAnswer(false);
  };

  const alterScore = async (contestantId, delta) => {
    await updateScore(session.id, contestantId, delta);
    await loadSession();
  };

  // Final Jeopardy handlers
  const openFinalJeopardy = () => {
    if (!session) return;
    const wagers = {};
    session.contestants.forEach(c => { wagers[c.id] = 0; });
    setFjWagers(wagers);
    setFjActive(true);
    setFjShowAnswer(false);
  };

  const closeFinalJeopardy = () => {
    setFjActive(false);
    setFjShowAnswer(false);
    setFjUsed(true);
  };

  const handleFjWagerChange = (contestantId, value) => {
    const num = parseInt(value, 10) || 0;
    setFjWagers(prev => ({ ...prev, [contestantId]: Math.abs(num) }));
  };

  if (loading) return <div className="h-screen flex items-center justify-center text-2xl font-bold text-jeopardy-gold">Loading...</div>;
  if (!session) return <div className="p-8">Session not found.</div>;

  const { game, contestants, used_questions } = session;
  const usedQIds = new Set(used_questions?.map(uq => uq.question_id) || []);

  const pointValue = activeQuestion ? activeQuestion.point_value : 0;

  const hasFinalJeopardy = game.final_jeopardy_clue || game.final_jeopardy_answer;

  const resolveUrl = (url) => url?.startsWith('/') ? `${window.location.origin}${url}` : url;

  return (
    <div className="h-screen flex flex-col bg-jeopardy-dark overflow-hidden">
      {/* HEADER */}
      <header className="px-6 py-4 flex justify-between items-center bg-black/40 border-b border-jeopardy-gold/20">
        <button onClick={() => navigate('/')} className="flex items-center gap-2 text-gray-400 hover:text-white transition">
           <Home size={20} />
           Exit Room
        </button>
        <h1 className="text-xl font-bold text-gray-200">{game.title}</h1>
      </header>

      {/* GAME BOARD GRID */}
      <main className="flex-1 flex flex-col justify-center items-center p-8">
        <div 
          className="grid gap-2 w-full h-full max-w-400"
          style={{ gridTemplateColumns: `repeat(${game.categories.length}, minmax(0, 1fr))` }}
        >
          {/* CATEGORIES HEADER */}
          {game.categories.map((cat) => (
            <div
              key={cat.id}
              className="relative h-full overflow-hidden bg-jeopardy-blue flex items-end text-center border-[3px] border-black shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]"
            >
              {cat.image_url && (
                <>
                  <img
                    src={resolveUrl(cat.image_url)}
                    alt={cat.name}
                    className="absolute inset-0 h-full w-full object-contain"
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/35 to-black/10" />
                </>
              )}
              <div className={`relative z-10 flex h-full w-full items-end p-4 ${cat.image_url ? '' : 'justify-center bg-jeopardy-blue'}`}>
                <h2 className="w-full text-white text-shadow uppercase font-black md:text-2xl lg:text-3xl tracking-widest">
                  {cat.name}
                </h2>
              </div>
            </div>
          ))}

          {/* QUESTIONS */}
          {Array.from({ length: game.questions_per_category }).map((_, qIndex) => (
            <React.Fragment key={qIndex}>
              {game.categories.map((cat) => {
                const q = cat.questions[qIndex];
                const isUsed = usedQIds.has(q.id);
                return (
                  <div 
                    key={q.id} 
                    onClick={() => !isUsed && handleQuestionClick(q)}
                    className={`bg-jeopardy-blue border-[3px] border-black flex flex-col items-center justify-center cursor-pointer transition-all ${isUsed ? 'opacity-0 invisible' : 'hover:bg-blue-700 shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] active:scale-95'}`}
                  >
                    {!isUsed && (
                      <span className="text-jeopardy-gold text-shadow font-black text-5xl lg:text-6xl drop-shadow-lg">
                        ${q.point_value}
                      </span>
                    )}
                  </div>
                );
              })}
            </React.Fragment>
          ))}

          {/* FINAL JEOPARDY ROW */}
          {hasFinalJeopardy && (
            <div
              onClick={() => !fjUsed && openFinalJeopardy()}
              className={`border-[3px] border-black flex items-center justify-center gap-3 p-4 transition-all cursor-pointer ${fjUsed ? 'bg-gray-800/50 opacity-40 cursor-default' : 'bg-linear-to-r from-red-800 to-red-900 hover:from-red-700 hover:to-red-800 shadow-[inset_0_0_30px_rgba(0,0,0,0.5)] active:scale-[0.99]'}`}
              style={{ gridColumn: `1 / -1` }}
            >
              <Trophy size={36} className="text-jeopardy-gold" />
              <span className="text-jeopardy-gold text-shadow font-black text-4xl lg:text-5xl uppercase tracking-[0.3em] drop-shadow-lg">
                Final Jeopardy
              </span>
              <Trophy size={36} className="text-jeopardy-gold" />
            </div>
          )}
        </div>
      </main>

      {/* FOOTER : SCOREBOARD */}
      <footer className="relative z-50 h-40 bg-black flex space-x-0.5 border-t-4 border-jeopardy-gold/40">
        {[...contestants].sort((a, b) => a.id - b.id).map((c) => (
          <div key={c.id} className="flex-1 flex flex-col items-center justify-between py-2 border-x border-gray-800 relative bg-linear-to-t from-gray-900 to-black">
             <div className="text-gray-300 font-bold uppercase tracking-wider text-xl mt-2 truncate w-full text-center px-2">{c.name}</div>
             <div className="font-extrabold text-5xl lg:text-6xl mb-2 text-white" style={{ textShadow: '0 0 10px rgba(255,255,255,0.3)' }}>
               {c.score < 0 && <span className="text-red-500">-</span>}${Math.abs(c.score)}
             </div>
             
             {/* Score Controls Overlay during Active Question */}
             {activeQuestion && (
               <div className="absolute inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-between p-3 z-20">
                 <div className="w-full text-center shrink-0">
                   <div className="text-white font-black text-xl lg:text-2xl uppercase tracking-widest drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">{c.name}</div>
                 </div>
                 <div className="flex w-full gap-3 justify-center items-center pb-1">
                   <button 
                    onClick={() => alterScore(c.id, pointValue)}
                    className="flex-1 bg-green-600 hover:bg-green-500 text-white font-black py-3 rounded-lg shadow-[0_0_15px_rgba(0,255,0,0.4)] transition-all active:scale-95 text-lg lg:text-xl border border-green-400/30"
                   >
                     +${pointValue}
                   </button>
                   <button 
                    onClick={() => alterScore(c.id, -pointValue)}
                    className="flex-1 bg-red-600 hover:bg-red-500 text-white font-black py-3 rounded-lg shadow-[0_0_15px_rgba(255,0,0,0.4)] transition-all active:scale-95 text-lg lg:text-xl border border-red-400/30"
                   >
                     -${pointValue}
                   </button>
                 </div>
               </div>
             )}

             {/* Final Jeopardy Wager Controls */}
             {fjActive && (
               <div className="absolute inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-between p-3 z-20">
                 <div className="w-full text-center shrink-0">
                   <div className="text-white font-black text-lg lg:text-xl uppercase tracking-widest drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">{c.name}</div>
                 </div>
                 <div className="w-full px-1">
                   <label className="text-xs text-jeopardy-gold font-semibold uppercase tracking-wider block text-center mb-1">Wager $</label>
                   <input
                     type="number"
                     min="0"
                     value={fjWagers[c.id] || 0}
                     onChange={(e) => handleFjWagerChange(c.id, e.target.value)}
                     className="w-full bg-white/10 border border-jeopardy-gold/40 rounded-lg p-2 text-center text-white font-bold text-lg focus:outline-none focus:border-jeopardy-gold"
                   />
                 </div>
                 <div className="flex w-full gap-2 justify-center items-center pb-1">
                   <button 
                    onClick={() => alterScore(c.id, fjWagers[c.id] || 0)}
                    className="flex-1 bg-green-600 hover:bg-green-500 text-white font-black py-2 rounded-lg shadow-[0_0_15px_rgba(0,255,0,0.4)] transition-all active:scale-95 text-sm lg:text-base border border-green-400/30"
                   >
                     +${fjWagers[c.id] || 0}
                   </button>
                   <button 
                    onClick={() => alterScore(c.id, -(fjWagers[c.id] || 0))}
                    className="flex-1 bg-red-600 hover:bg-red-500 text-white font-black py-2 rounded-lg shadow-[0_0_15px_rgba(255,0,0,0.4)] transition-all active:scale-95 text-sm lg:text-base border border-red-400/30"
                   >
                     -${fjWagers[c.id] || 0}
                   </button>
                 </div>
               </div>
             )}

             {/* Host Controls: +100 / -100 when no question is active */}
             {!activeQuestion && !fjActive && (
               <div className="flex w-full gap-2 justify-center items-center px-2 pb-1">
                 <button 
                   onClick={() => alterScore(c.id, 100)}
                   className="flex-1 bg-green-700/60 hover:bg-green-600 text-white font-bold py-1.5 rounded-md transition-all active:scale-95 text-sm border border-green-500/30"
                 >
                   +$100
                 </button>
                 <button 
                   onClick={() => alterScore(c.id, -100)}
                   className="flex-1 bg-red-700/60 hover:bg-red-600 text-white font-bold py-1.5 rounded-md transition-all active:scale-95 text-sm border border-red-500/30"
                 >
                   -$100
                 </button>
               </div>
             )}
          </div>
        ))}
      </footer>

      {/* ACTIVE QUESTION MODAL OVERLAY */}
      {activeQuestion && (
        <div className="fixed inset-x-0 top-0 bottom-40 z-40 bg-black/95 flex flex-col items-center justify-center overflow-y-auto p-4 sm:p-8 animate-in zoom-in duration-300">
          <button 
            onClick={closeQuestionModal}
            className="absolute top-4 right-4 sm:top-8 sm:right-8 text-gray-400 hover:text-white p-2 rounded-full hover:bg-white/10 z-50"
          >
            <X className="size-10 sm:size-12" />
          </button>
          
          <div className="w-full md:min-w-[500px] max-w-5xl flex flex-col items-center text-center gap-4 sm:gap-6 py-4">
            {!showAnswer && activeQuestion.media_type && activeQuestion.media_type !== 'none' && activeQuestion.media_url && (
              <div className="flex justify-center items-center w-full">
                {activeQuestion.media_type === 'image' && (
                  <img src={resolveUrl(activeQuestion.media_url)} referrerPolicy="no-referrer" alt="Clue Media" className="question-modal-media rounded-2xl shadow-2xl border-4 border-jeopardy-gold/40" />
                )}
                {activeQuestion.media_type === 'video' && (
                  <div className="max-h-[40vh] max-w-full rounded-2xl overflow-hidden shadow-2xl border-4 border-jeopardy-gold/40 bg-black flex justify-center items-center">
                    <video
                      src={resolveUrl(activeQuestion.media_url)}
                      autoPlay
                      controls
                      playsInline
                      style={{ maxWidth: '100%', maxHeight: '40vh' }}
                    />
                  </div>
                )}
                {activeQuestion.media_type === 'audio' && (
                  <div className="w-full max-w-2xl bg-black/50 p-2 rounded-xl border-2 border-jeopardy-gold/40">
                    <audio
                      src={resolveUrl(activeQuestion.media_url)}
                      autoPlay
                      controls
                      style={{ width: '100%' }}
                    />
                  </div>
                )}
              </div>
            )}
            
            {/* Clue text (shown when not revealing answer) */}
            {!showAnswer && (!activeQuestion.media_type || activeQuestion.media_type === 'none' || activeQuestion.clue) && (
              <h2 className={`${activeQuestion.media_type && activeQuestion.media_type !== 'none' ? 'text-4xl md:text-5xl' : 'text-6xl md:text-8xl'} font-bold uppercase text-white tracking-wide`} style={{ textShadow: '4px 4px 0 #000' }}>
                {activeQuestion.clue}
              </h2>
            )}

            {/* Answer media (shown when revealing answer) */}
            {showAnswer && activeQuestion.answer_media_type && activeQuestion.answer_media_type !== 'none' && activeQuestion.answer_media_url && (
              <div className="flex justify-center items-center w-full">
                {activeQuestion.answer_media_type === 'image' && (
                  <img src={resolveUrl(activeQuestion.answer_media_url)} referrerPolicy="no-referrer" alt="Answer Media" className="question-modal-media rounded-2xl shadow-2xl border-4 border-jeopardy-gold/40" />
                )}
                {activeQuestion.answer_media_type === 'video' && (
                  <div className="max-h-[40vh] max-w-full rounded-2xl overflow-hidden shadow-2xl border-4 border-jeopardy-gold/40 bg-black flex justify-center items-center">
                    <video
                      src={resolveUrl(activeQuestion.answer_media_url)}
                      autoPlay
                      controls
                      playsInline
                      style={{ maxWidth: '100%', maxHeight: '40vh' }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Answer text (shown when revealing answer) */}
            {showAnswer && (
              <h2 className={`${activeQuestion.answer_media_type && activeQuestion.answer_media_type !== 'none' ? 'text-4xl md:text-5xl' : 'text-6xl md:text-8xl'} font-bold uppercase text-white tracking-wide`} style={{ textShadow: '4px 4px 0 #000' }}>
                {activeQuestion.answer}
              </h2>
            )}

            {/* Multiple Choice Options */}
            {!showAnswer && activeQuestion.options && (() => {
              try {
                const opts = JSON.parse(activeQuestion.options);
                if (Array.isArray(opts) && opts.length > 0) {
                  return (
                    <div className="w-full max-w-3xl grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                      {opts.map((opt, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-4 bg-jeopardy-blue/40 border-2 border-jeopardy-gold/30 rounded-xl px-6 py-4 text-left"
                        >
                          <span className="text-jeopardy-gold font-black text-3xl md:text-4xl shrink-0">
                            {String.fromCharCode(65 + i)})
                          </span>
                          <span className="text-white font-bold text-2xl md:text-3xl">
                            {opt}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                }
              } catch { /* ignore parse errors */ }
              return null;
            })()}
          </div>

          <div className="mt-8 space-y-4">
            {!showAnswer ? (
              <button
                onClick={() => setShowAnswer(true)}
                className="bg-jeopardy-gold text-jeopardy-dark font-black text-2xl px-12 py-4 rounded-xl hover:bg-yellow-400 hover:scale-105 transition-all shadow-[0_0_30px_rgba(255,204,0,0.5)]"
              >
                REVEAL ANSWER
              </button>
            ) : (
              <button
                onClick={closeQuestionModal}
                className="bg-white/20 text-white font-black text-xl px-10 py-3 rounded-xl hover:bg-white/30 transition-all"
              >
                CLOSE & MARK USED
              </button>
            )}
          </div>
        </div>
      )}

      {/* FINAL JEOPARDY MODAL OVERLAY */}
      {fjActive && (
        <div className="fixed inset-x-0 top-0 bottom-40 z-40 bg-black/95 flex flex-col items-center overflow-y-auto p-8 animate-in zoom-in duration-300">
          <button 
            onClick={closeFinalJeopardy}
            className="absolute top-8 right-8 text-gray-400 hover:text-white p-2 rounded-full hover:bg-white/10 z-50"
          >
            <X size={48} />
          </button>

          {/* Category banner */}
          {game.final_jeopardy_category && (
            <div className="mb-6">
              <div className="bg-jeopardy-blue/70 border-2 border-jeopardy-gold/40 rounded-xl px-10 py-3">
                <span className="text-jeopardy-gold font-black text-2xl md:text-3xl uppercase tracking-[0.15em]">
                  {game.final_jeopardy_category}
                </span>
              </div>
            </div>
          )}
          
          <div className="w-full flex flex-col items-center max-w-6xl text-center gap-6 my-auto py-4">
            {/* Clue media */}
            {!fjShowAnswer && game.final_jeopardy_media_type && game.final_jeopardy_media_type !== 'none' && game.final_jeopardy_media_url && (
              <div className="flex justify-center items-center w-full max-h-[40vh]">
                {game.final_jeopardy_media_type === 'image' && (
                  <img src={resolveUrl(game.final_jeopardy_media_url)} referrerPolicy="no-referrer" alt="Final Jeopardy Clue" className="max-h-[40vh] max-w-full rounded-2xl shadow-2xl border-4 border-jeopardy-gold/40 object-contain" />
                )}
                {game.final_jeopardy_media_type === 'video' && (
                  <div className="max-h-[40vh] max-w-full rounded-2xl overflow-hidden shadow-2xl border-4 border-jeopardy-gold/40 bg-black flex justify-center items-center">
                    <video src={resolveUrl(game.final_jeopardy_media_url)} autoPlay controls playsInline style={{ maxWidth: '100%', maxHeight: '40vh' }} />
                  </div>
                )}
                {game.final_jeopardy_media_type === 'audio' && (
                  <div className="w-full max-w-2xl bg-black/50 p-2 rounded-xl border-2 border-jeopardy-gold/40">
                    <audio src={resolveUrl(game.final_jeopardy_media_url)} autoPlay controls style={{ width: '100%' }} />
                  </div>
                )}
              </div>
            )}

            {/* Clue text */}
            {!fjShowAnswer && game.final_jeopardy_clue && (
              <h2 className={`${game.final_jeopardy_media_type && game.final_jeopardy_media_type !== 'none' ? 'text-4xl md:text-5xl' : 'text-6xl md:text-8xl'} font-bold uppercase text-white tracking-wide`} style={{ textShadow: '4px 4px 0 #000' }}>
                {game.final_jeopardy_clue}
              </h2>
            )}

            {/* Answer media */}
            {fjShowAnswer && game.final_jeopardy_answer_media_type && game.final_jeopardy_answer_media_type !== 'none' && game.final_jeopardy_answer_media_url && (
              <div className="flex justify-center items-center w-full max-h-[40vh]">
                {game.final_jeopardy_answer_media_type === 'image' && (
                  <img src={resolveUrl(game.final_jeopardy_answer_media_url)} referrerPolicy="no-referrer" alt="Final Jeopardy Answer" className="max-h-[40vh] max-w-full rounded-2xl shadow-2xl border-4 border-jeopardy-gold/40 object-contain" />
                )}
                {game.final_jeopardy_answer_media_type === 'video' && (
                  <div className="max-h-[40vh] max-w-full rounded-2xl overflow-hidden shadow-2xl border-4 border-jeopardy-gold/40 bg-black flex justify-center items-center">
                    <video src={resolveUrl(game.final_jeopardy_answer_media_url)} autoPlay controls playsInline style={{ maxWidth: '100%', maxHeight: '40vh' }} />
                  </div>
                )}
              </div>
            )}

            {/* Answer text */}
            {fjShowAnswer && game.final_jeopardy_answer && (
              <h2 className={`${game.final_jeopardy_answer_media_type && game.final_jeopardy_answer_media_type !== 'none' ? 'text-4xl md:text-5xl' : 'text-6xl md:text-8xl'} font-bold uppercase text-white tracking-wide`} style={{ textShadow: '4px 4px 0 #000' }}>
                {game.final_jeopardy_answer}
              </h2>
            )}
          </div>

          <div className="mt-8 space-y-4">
            {!fjShowAnswer ? (
              <button
                onClick={() => setFjShowAnswer(true)}
                className="bg-jeopardy-gold text-jeopardy-dark font-black text-2xl px-12 py-4 rounded-xl hover:bg-yellow-400 hover:scale-105 transition-all shadow-[0_0_30px_rgba(255,204,0,0.5)]"
              >
                REVEAL ANSWER
              </button>
            ) : (
              <button
                onClick={closeFinalJeopardy}
                className="bg-white/20 text-white font-black text-xl px-10 py-3 rounded-xl hover:bg-white/30 transition-all"
              >
                CLOSE FINAL JEOPARDY
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
