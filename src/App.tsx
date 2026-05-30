/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { GamePhase } from './types';
import MainMenu from './components/MainMenu';
import GameCanvas from './components/GameCanvas';
import { audio } from './lib/audio';
import { Shield, ShieldCheck, RefreshCw, VolumeX, Volume2 } from 'lucide-react';

export default function App() {
  const [phase, setPhase] = useState<GamePhase>(GamePhase.MENU);
  const [success, setSuccess] = useState(false);
  const [muted, setMuted] = useState(false);
  const [multiplayerConfig, setMultiplayerConfig] = useState<{ roomId: string; playerId: string; initialRoom: any } | null>(null);

  const handleGameEnd = (escaped: boolean) => {
    setSuccess(escaped);
    setPhase(GamePhase.ENDING);
    audio.stopAll();
  };

  const restartGame = () => {
    setPhase(GamePhase.MENU);
    setSuccess(false);
    setMultiplayerConfig(null);
  };

  const toggleMute = () => {
    const isMuted = audio.toggleMute();
    setMuted(isMuted);
  };

  const handleStartGame = (config?: { roomId: string; playerId: string; initialRoom: any }) => {
    if (config) {
      setMultiplayerConfig(config);
      setPhase(GamePhase.PLAYING); // Launch directly into playing for multiplayer sync
    } else {
      setMultiplayerConfig(null);
      setPhase(GamePhase.INTRO);
    }
  };

  return (
    <div id="game-phase-wrapper" className="w-full h-screen bg-[#050505] overflow-hidden select-none">
      {/* 1. MAIN MENU */}
      {phase === GamePhase.MENU && (
        <MainMenu onStartGame={handleStartGame} />
      )}

      {/* 2. GAME RECONSTRUCTIONS - INTRO & PLAYING */}
      {(phase === GamePhase.INTRO || phase === GamePhase.PLAYING) && (
        <GameCanvas
          currentPhase={phase}
          onTransitionPhase={setPhase}
          onGameEnd={handleGameEnd}
          multiplayerConfig={multiplayerConfig}
        />
      )}

      {/* 3. EXPERIENCE CONDLUDED / ENDING SCREEN */}
      {phase === GamePhase.ENDING && (
        <div className="relative w-full h-screen flex flex-col justify-between p-8 text-[#cecece] font-mono animate-fade-in">
          {/* Heavy VHS Noise Scans */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.06] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-neutral-200 via-neutral-900 to-black mix-blend-overlay z-40 bg-[size:100%_4px]" />
          <div className="absolute inset-0 bg-black opacity-[0.98] z-0 animate-pulse duration-[200ms]" />

          <header className="w-full flex justify-between items-center z-10 border-b border-neutral-900 pb-3 text-[10px] text-neutral-500 tracking-widest">
            <div>TERMINATION//CORRIDOR_6_CLOSE</div>
            <div className="flex items-center gap-4">
              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                INTEGRITY RESTORED
              </span>
              <button 
                onClick={toggleMute}
                className="text-neutral-500 hover:text-neutral-200 transition-colors cursor-pointer uppercase"
              >
                {muted ? 'MUTED' : 'LIVE'}
              </button>
            </div>
          </header>

          <main className="max-w-xl mx-auto flex-1 flex flex-col justify-center items-center text-center z-13">
            <div className="mb-4 text-emerald-500 text-[11px] tracking-[0.3em] uppercase animate-pulse">
              EXCAVATION CONCLUDED
            </div>

            <h1 className="text-3xl md:text-4xl font-extrabold tracking-[0.2em] uppercase text-neutral-100 mb-8 font-mono">
              CORRIDOR_6_RESOLVED.BIN
            </h1>

            <div className="space-y-5 text-left border-l-2 border-neutral-800 pl-6 py-4 bg-neutral-950/40 rounded max-w-lg mb-10">
              <div className="text-[10px] text-neutral-500 tracking-widest uppercase">
                DECRYPTED TRANSACTION DATA (0x02AA):
              </div>
              
              <p className="text-xs text-neutral-400 leading-relaxed font-sans mt-2">
                "You walked through the recursive corridors. There was no weapons, and nothing that pursued you besides your own reflection and fear."
              </p>

              <blockquote className="text-[11px] font-mono text-neutral-500 border-t border-neutral-900 pt-4 italic leading-relaxed uppercase tracking-wider">
                "THE LONGEST ESCAPE IS REMEMBERING THAT THE MAZE WAS ARCHITECTED BY YOU."
              </blockquote>
            </div>

            <button
              id="reinitialize-btn"
              onClick={restartGame}
              className="px-8 py-3.5 bg-neutral-100 text-neutral-950 font-extrabold uppercase text-xs tracking-widest hover:bg-neutral-800 hover:text-neutral-100 border border-neutral-100 hover:border-neutral-800 transition-all cursor-pointer flex items-center gap-2 rounded shadow-2xl"
            >
              <RefreshCw className="w-4 h-4 animate-[spin_4s_linear_infinite]" />
              RE-INITIALIZE MODULE
            </button>
          </main>

          <footer className="w-full text-center text-[9px] text-neutral-600 tracking-[0.25em] pt-4 z-10 border-t border-neutral-900 uppercase">
            SAD_SATAN_STYLE EXPERIENCE COMPLETED // STABLE RECORD STORED
          </footer>
        </div>
      )}
    </div>
  );
}
