import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Play } from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-jeopardy-dark">
      {/* Dynamic Background Elements */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-jeopardy-blue/20 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-jeopardy-gold/10 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* Content Container */}
      <div className="relative z-10 flex flex-col items-center text-center px-4 max-w-4xl">
        {/* Decorative Grid Lines (Jeopardy Style) */}
        <div className="absolute -top-24 -left-24 w-48 h-48 border border-jeopardy-gold/10 grid grid-cols-3 grid-rows-3 opacity-20">
            {Array.from({ length: 9 }).map((_, i) => <div key={i} className="border border-jeopardy-gold/20" />)}
        </div>

        <div className="mb-8 p-1 px-3 rounded-full bg-white/5 border border-white/10 backdrop-blur-md text-jeopardy-gold text-xs font-bold tracking-[0.3em] uppercase animate-in fade-in slide-in-from-top duration-1000">
          The Ultimate Trivia Builder
        </div>

        <h1 className="text-7xl md:text-9xl font-black mb-6 tracking-tighter animate-in zoom-in duration-700">
          <span className="text-transparent bg-clip-text bg-linear-to-b from-white via-jeopardy-gold to-yellow-600 drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)]">
            JEOPARDY!
          </span>
        </h1>

        <p className="text-xl md:text-2xl text-gray-400 mb-12 font-medium max-w-2xl leading-relaxed animate-in fade-in slide-in-from-bottom duration-1000 delay-300">
          Create, customize, and host your own professional trivia sessions with stunning visuals and real-time score tracking.
        </p>

        <div className="flex flex-col md:flex-row gap-6 animate-in fade-in slide-in-from-bottom duration-1000 delay-500">
          <button 
            onClick={() => navigate('/dashboard')}
            className="group relative flex items-center gap-3 bg-jeopardy-gold text-jeopardy-dark px-10 py-5 rounded-2xl font-black text-xl hover:bg-yellow-400 transition-all hover:scale-105 active:scale-95 shadow-[0_0_40px_rgba(255,204,0,0.3)] hover:shadow-[0_0_60px_rgba(255,204,0,0.5)]"
          >
            <Play className="fill-jeopardy-dark group-hover:translate-x-1 transition-transform" />
            ENTER ARENA
          </button>
        </div>

        {/* Board Preview Hint */}
        <div className="mt-20 grid grid-cols-4 gap-2 opacity-30 animate-in fade-in duration-1000 delay-1000">
            {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="w-12 h-16 bg-jeopardy-blue border-2 border-black rounded-sm shadow-inner" />
            ))}
        </div>
      </div>

      <footer className="absolute bottom-8 left-0 right-0 text-center text-gray-600 text-sm tracking-widest uppercase">
        Built for competition &bull; Driven by curiosity
      </footer>
    </div>
  );
}
