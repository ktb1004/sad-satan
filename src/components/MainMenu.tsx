/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { audio } from '../lib/audio';
import { 
  Volume2, 
  VolumeX, 
  Eye, 
  Flame, 
  ShieldAlert, 
  ArrowRight, 
  Users, 
  Copy, 
  Check, 
  ChevronLeft, 
  Loader2, 
  Plus, 
  LogIn, 
  Skull, 
  Network
} from 'lucide-react';

interface MainMenuProps {
  onStartGame: (multiplayerConfig?: { roomId: string; playerId: string; initialRoom: any }) => void;
}

export default function MainMenu({ onStartGame }: MainMenuProps) {
  const [muted, setMuted] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [scrollyText, setScrollyText] = useState('SYSTEM CHECK: OK... ANALOG AUDIO FEED... SEEDING DECAY...');
  
  // Game Setup Mode Screen States: 'mode_select' | 'username_setup' | 'lobby_room'
  const [menuView, setMenuView] = useState<'mode_select' | 'username_setup' | 'lobby_room'>('mode_select');
  const [multiplayerMode, setMultiplayerMode] = useState(false);
  
  // Multiplayer setup variables
  const [username, setUsername] = useState(() => {
    return localStorage.getItem('satan_decay_username') || `Explorer_${Math.floor(1000 + Math.random() * 9000)}`;
  });
  const [targetRoomCode, setTargetRoomCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Active Lobby variables
  const [room, setRoom] = useState<any | null>(null);
  const [playerId, setPlayerId] = useState<string>('');
  
  const pollingRef = useRef<any>(null);

  useEffect(() => {
    // Spooky slow crawling diagnostic string
    const texts = [
      'SYSTEM CHECK: OK... ANALOG AUDIO FEED... SEEDING DECAY...',
      'WARNING: DETECTING UNUSUALLY HIGH DECAY RATIO IN CORRIDOR 6...',
      'INTERACTION REQUIRED TO ESTABLISH COMPANION REVERB...',
      'REMEMBER: THE CORED ENVIROMENT FEEDS ON MULTIPLE INTEGRITIES...',
      'SAD_SATAN_DECRYPTED_STAGE_4.BIN LOADED...'
    ];
    let i = 0;
    const interval = setInterval(() => {
      i = (i + 1) % texts.length;
      setScrollyText(texts[i]);
    }, 4500);
    return () => clearInterval(interval);
  }, []);

  // Poll room state while in lobby_room
  useEffect(() => {
    if (menuView === 'lobby_room' && room?.id && playerId) {
      pollingRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/rooms/${room.id}/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerId })
          });
          const data = await res.json();
          if (data.success) {
            setRoom(data.room);
            // If host has changed the status to playing, start game immediately!
            if (data.room.status === 'playing') {
              cleanupLobbyInterval();
              await audio.init();
              onStartGame({ roomId: room.id, playerId, initialRoom: data.room });
            }
          } else {
            setErrorMsg('Lobby synchronisation lost.');
            setMenuView('username_setup');
            cleanupLobbyInterval();
          }
        } catch (e) {
          console.error(e);
        }
      }, 1500);
    }

    return () => {
      cleanupLobbyInterval();
    };
  }, [menuView, room?.id, playerId]);

  const cleanupLobbyInterval = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const toggleMute = () => {
    const isMuted = audio.toggleMute();
    setMuted(isMuted);
  };

  const handleStartSingleplayer = async () => {
    // Standard Single player
    await audio.init();
    onStartGame();
  };

  const handleCreateLobby = async () => {
    if (!username.trim()) {
      setErrorMsg('A nickname is required to authenticate.');
      return;
    }
    localStorage.setItem('satan_decay_username', username);
    setLoading(true);
    setErrorMsg('');

    try {
      // 1. Create room
      const resCreate = await fetch('/api/rooms', { method: 'POST' });
      const dataCreate = await resCreate.json();

      if (!dataCreate.success) {
        throw new Error('Failed to create lobby room.');
      }

      const newRoom = dataCreate.room;

      // 2. Join the created room
      const resJoin = await fetch(`/api/rooms/${newRoom.id}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });
      const dataJoin = await resJoin.json();

      if (!dataJoin.success) {
        throw new Error(dataJoin.error || 'Failed to enter lobby.');
      }

      setRoom(dataJoin.room);
      setPlayerId(dataJoin.playerId);
      setMenuView('lobby_room');
    } catch (err: any) {
      setErrorMsg(err.message || 'Server connection failure.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinLobbyByCode = async () => {
    if (!username.trim()) {
      setErrorMsg('A nickname is required.');
      return;
    }
    if (!targetRoomCode.trim()) {
      setErrorMsg('A valid room code is required.');
      return;
    }
    localStorage.setItem('satan_decay_username', username);
    setLoading(true);
    setErrorMsg('');

    try {
      const trimmedCode = targetRoomCode.trim().toUpperCase();
      const resJoin = await fetch(`/api/rooms/${trimmedCode}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });
      const dataJoin = await resJoin.json();

      if (!dataJoin.success) {
        if (dataJoin.error === 'LOBBY_NOT_FOUND') {
          throw new Error('Active lobby code not found.');
        } else if (dataJoin.error === 'GAME_ALREADY_FINISHED') {
          throw new Error('This corridor exploration has already finished.');
        }
        throw new Error(dataJoin.error || 'Failed to join lobby.');
      }

      setRoom(dataJoin.room);
      setPlayerId(dataJoin.playerId);
      setMenuView('lobby_room');
    } catch (err: any) {
      setErrorMsg(err.message || 'Server join error.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartExpedition = async () => {
    if (!room) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/rooms/${room.id}/start`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        cleanupLobbyInterval();
        await audio.init();
        onStartGame({ roomId: room.id, playerId, initialRoom: data.room });
      } else {
        setErrorMsg('Failed to initiate co-op expedition.');
      }
    } catch (e) {
      setErrorMsg('Host activation failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveLobby = async () => {
    if (room && playerId) {
      fetch(`/api/rooms/${room.id}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId })
      }).catch(console.error);
    }
    cleanupLobbyInterval();
    setRoom(null);
    setPlayerId('');
    setMenuView('username_setup');
  };

  const copyRoomCode = () => {
    if (!room?.id) return;
    navigator.clipboard.writeText(room.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // The creator's ID will be the first entry in key sequence
  const isHost = room && Object.keys(room.players)[0] === playerId;
  const connectedPlayers = room ? Object.values(room.players) : [];

  return (
    <div id="main-menu-root" className="relative w-full h-screen bg-[#050505] text-[#dcdcdc] font-mono flex flex-col justify-between p-6 overflow-hidden select-none">
      {/* Heavy VHS Noise Scanline Layer */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.06] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-neutral-200 via-neutral-900 to-black mix-blend-overlay z-40 bg-[size:100%_4px]" />
      
      {/* Glitch flickering background shadow */}
      <div className="absolute inset-0 bg-black opacity-[0.98] z-0 animate-pulse duration-[200ms]" />

      {/* Header Info */}
      <header className="w-full flex justify-between items-center z-10 border-b border-neutral-900 pb-3 text-[10px] text-neutral-500 tracking-widest">
        <div>Z-SECTOR // PREVIEW_REPAIR_ON</div>
        <div className="flex items-center gap-4">
          <span className="animate-pulse text-red-700 flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-red-600 rounded-full inline-block animate-[ping_1.5s_infinite]" />
            LIVE SIGNAL
          </span>
          <button 
            id="menu-mute-btn"
            onClick={toggleMute}
            className="text-neutral-500 hover:text-neutral-200 transition-colors uppercase cursor-pointer"
          >
            {muted ? <VolumeX className="w-4 h-4 inline mr-1 text-red-800" /> : <Volume2 className="w-4 h-4 inline mr-1" />}
            {muted ? 'MUTED' : 'LIVE'}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center max-w-xl mx-auto z-10 w-full">
        {showWarning ? (
          /* Warning Screen */
          <div className="flex flex-col items-center text-center p-6 bg-neutral-950/60 border border-neutral-900 rounded-md shadow-2xl backdrop-blur-sm self-center">
            <div className="w-12 h-12 bg-red-950/50 border border-red-700/50 rounded-full flex items-center justify-center mb-4 text-red-500">
              <ShieldAlert className="w-6 h-6 animate-bounce" />
            </div>
            
            <h2 className="text-sm font-semibold tracking-widest uppercase mb-3 text-red-600">
              PSYCHOLOGICAL SENSITIVITY WARNING
            </h2>
            
            <p className="text-xs text-neutral-400 mb-5 leading-relaxed font-sans text-justify">
              This interactive application compiles and models structural visual and audio distortions 
              based on classic underground psychological analog-horror aesthetics (specifically <em className="text-neutral-200">Sad Satan</em>). It uses low-frequency procedural rumbles, claustrophobic narrow maze paths, flickering visuals, digital glitch artifacts, and sudden sound shifts.
            </p>

            <ul className="text-[11px] text-neutral-500 space-y-2 mb-6 text-left w-full border-t border-neutral-900 pt-4 font-mono">
              <li className="flex items-center gap-2"><Eye className="w-3.5 h-3.5 text-neutral-600" /> Co-op mode syncs flashlights, movements, and screamers.</li>
              <li className="flex items-center gap-2"><Flame className="w-3.5 h-3.5 text-neutral-600" /> Low frequency binaural pulses - headphones recommended.</li>
            </ul>

            <button
              id="warning-accept-btn"
              onClick={() => setShowWarning(false)}
              className="w-full py-2.5 bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-xs font-bold uppercase hover:border-red-900 text-red-500 shadow-md active:bg-neutral-950 transition-all cursor-pointer rounded"
            >
              ACKNOWLEDGE & PROCEED
            </button>
          </div>
        ) : (
          /* Main Interactive Menu Views */
          <div className="w-full flex flex-col items-center text-center animate-fade-in duration-500">
            {menuView === 'mode_select' && (
              <>
                <div className="mb-2 tracking-[0.4em] text-neutral-600 text-[11px] uppercase">
                  A RETRO 3D HORROR EXPEDITION
                </div>

                <h1 className="text-4xl md:text-5xl font-bold tracking-[0.3em] font-mono text-neutral-100 select-none cursor-pointer filter drop-shadow-[0_0_8px_rgba(255,255,255,0.1)] relative">
                  S▲T▲N_DEC▲Y
                  <span className="block h-[1px] bg-gradient-to-r from-transparent via-neutral-500 to-transparent w-3/4 mx-auto mt-2" />
                </h1>

                <p className="text-[11px] text-neutral-500 max-w-sm mt-3 mb-10 leading-relaxed uppercase tracking-wider">
                  "YOU ARE NOT SUPPOSED TO FIND THIS. EXCAVATE THE ENTAILED SYSTEM."
                </p>

                <div className="space-y-4 w-full max-w-[280px]">
                  {/* Singleplayer Button */}
                  <button
                    id="start-singleplayer-btn"
                    onClick={handleStartSingleplayer}
                    className="group w-full py-3 bg-neutral-100 text-neutral-950 font-extrabold uppercase text-xs tracking-widest hover:bg-black hover:text-white border border-neutral-100 hover:border-neutral-850 shadow-xl transition-all duration-300 transform hover:scale-[1.02] flex items-center justify-center gap-2 cursor-pointer rounded"
                  >
                    START EXPEDITION
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>

                  {/* Multiplayer Mode Button */}
                  <button
                    id="setup-multiplayer-btn"
                    onClick={() => {
                      setMultiplayerMode(true);
                      setMenuView('username_setup');
                    }}
                    className="group w-full py-3 bg-transparent text-neutral-200 border border-neutral-700 hover:border-red-900 hover:text-red-500 font-bold uppercase text-xs tracking-widest transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer rounded bg-neutral-950/20"
                  >
                    <Users className="w-4 h-4 text-neutral-500 group-hover:text-red-500" />
                    CO-OP MULTIPLAYER
                  </button>

                  <div className="text-[9px] text-neutral-600 tracking-tight pt-2">
                    WASD / ARRROWS TO EXPLORE · CAMERA DRAG TO LOOK · BUILT WITH PROCEDURAL WEB AUDIO
                  </div>
                </div>
              </>
            )}

            {menuView === 'username_setup' && (
              <div className="w-full max-w-xs p-6 bg-neutral-950/60 border border-neutral-900 rounded shadow-2xl backdrop-blur text-left">
                <button
                  onClick={() => setMenuView('mode_select')}
                  className="flex items-center gap-1 text-[10px] text-neutral-500 hover:text-neutral-200 uppercase mb-4 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-3 h-3" /> Back
                </button>

                <h3 className="text-xs font-semibold tracking-widest uppercase text-neutral-100 mb-4 border-b border-neutral-900 pb-2 flex items-center gap-2">
                  <Network className="w-4 h-4 text-red-500" />
                  CO-OP ESTABLISHMENT
                </h3>

                {errorMsg && (
                  <div className="text-[10px] text-red-500 bg-red-950/20 border border-red-900/30 p-2.5 rounded mb-4 font-mono">
                    ERROR: {errorMsg.toUpperCase()}
                  </div>
                )}

                {/* Nickname Input */}
                <div className="mb-4">
                  <label className="block text-[9px] text-neutral-500 tracking-widest uppercase mb-1.5">
                    CO-OP IDENTITY (NICKNAME)
                  </label>
                  <input
                    type="text"
                    value={username}
                    maxLength={14}
                    onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9가-힣_\s]/g, ''))}
                    placeholder="Enter moniker..."
                    className="w-full bg-neutral-900 border border-neutral-800 text-neutral-200 text-xs px-3 py-2 rounded focus:outline-none focus:border-red-900 text-center uppercase tracking-wider font-mono"
                  />
                </div>

                <div className="border-t border-neutral-900 pt-4 space-y-4">
                  {/* Create Option */}
                  <button
                    onClick={handleCreateLobby}
                    disabled={loading}
                    className="w-full py-2.5 bg-neutral-100 text-neutral-950 font-extrabold uppercase text-xs tracking-widest hover:bg-neutral-800 hover:text-neutral-100 hover:border-neutral-800 border transition-all cursor-pointer rounded flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        CREATE LOBBY
                      </>
                    )}
                  </button>

                  {/* Or Joining divider */}
                  <div className="flex items-center justify-center gap-2 py-1">
                    <span className="h-[1px] bg-neutral-900 flex-1" />
                    <span className="text-[9px] text-neutral-600 tracking-wider">OR JOIN</span>
                    <span className="h-[1px] bg-neutral-900 flex-1" />
                  </div>

                  {/* Code Input & Join */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={targetRoomCode}
                      maxLength={4}
                      onChange={(e) => setTargetRoomCode(e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase())}
                      placeholder="CODE"
                      className="w-20 bg-neutral-900 border border-neutral-800 text-neutral-200 text-xs px-2 py-2 rounded focus:outline-none focus:border-red-900 text-center uppercase tracking-widest font-mono font-bold"
                    />
                    <button
                      onClick={handleJoinLobbyByCode}
                      disabled={loading || !targetRoomCode}
                      className="flex-1 py-2 bg-neutral-950 hover:bg-neutral-900 border border-neutral-800 hover:border-red-950 text-neutral-200 text-xs font-bold uppercase transition-all cursor-pointer rounded flex items-center justify-center gap-1.5"
                    >
                      {loading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <>
                          <LogIn className="w-3.5 h-3.5" />
                          JOIN
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {menuView === 'lobby_room' && room && (
              <div className="w-full max-w-sm p-6 bg-neutral-950/60 border border-neutral-900 rounded shadow-2xl backdrop-blur text-left">
                <header className="flex justify-between items-center mb-6 border-b border-neutral-900 pb-3">
                  <div>
                    <h3 className="text-xs font-bold tracking-widest uppercase text-red-500">
                      CORRIDOR_LOBBY SECURED
                    </h3>
                    <p className="text-[9px] text-neutral-500 uppercase mt-0.5">
                      SECTOR_B6_ACTIVE
                    </p>
                  </div>
                  <button
                    onClick={handleLeaveLobby}
                    className="px-2.5 py-1 bg-red-950/10 border border-red-950/40 hover:border-red-650 hover:bg-red-950/30 text-[9px] text-red-500 rounded uppercase font-bold transition-all cursor-pointer"
                  >
                    Disconnect
                  </button>
                </header>

                {errorMsg && (
                  <div className="text-[10px] text-red-500 bg-red-950/20 border border-red-900/30 p-2.5 rounded mb-4 font-mono uppercase">
                    ERROR: {errorMsg}
                  </div>
                )}

                {/* Display Room Code */}
                <div className="mb-6 bg-neutral-900/60 border border-neutral-900 p-4 rounded flex justify-between items-center">
                  <div>
                    <span className="block text-[9px] text-neutral-500 tracking-wider uppercase mb-0.5">
                      INVITATION ACCESS CODE
                    </span>
                    <span className="text-xl font-black text-neutral-200 tracking-widest font-mono">
                      {room.id}
                    </span>
                  </div>
                  <button
                    onClick={copyRoomCode}
                    className="p-2 bg-neutral-950 hover:bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-neutral-100 rounded transition-all cursor-pointer flex items-center justify-center"
                    title="Copy Code"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                {/* List players in lobby */}
                <div className="mb-6">
                  <label className="block text-[9px] text-neutral-500 tracking-widest uppercase mb-2">
                    CONNECTED CO-EXPLORERS ({connectedPlayers.length})
                  </label>
                  <div className="space-y-2 max-h-[140px] overflow-y-auto border border-neutral-900 rounded p-2 bg-neutral-900/10">
                    {connectedPlayers.map((p: any, idx: number) => (
                      <div
                        key={p.id}
                        className="flex justify-between items-center py-1.5 px-2 bg-neutral-950 hover:bg-neutral-900/50 rounded transition-colors text-xs text-neutral-300 font-mono"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-red-500 text-[10px]">
                            #{idx + 1}
                          </span>
                          <span className="font-semibold uppercase tracking-wide">
                            {p.username}
                          </span>
                          {p.id === playerId && (
                            <span className="text-[8px] px-1 bg-neutral-800 text-neutral-500 border border-neutral-700/50 rounded uppercase">
                              YOU
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[9px]">
                          {idx === 0 ? (
                            <span className="text-amber-500 border border-amber-950 py-0.5 px-1.5 rounded text-[8px] bg-amber-950/10 font-bold uppercase">
                              HOST
                            </span>
                          ) : (
                            <span className="text-emerald-500 border border-emerald-950 py-0.5 px-1.5 rounded text-[8px] bg-emerald-955/15 uppercase">
                              READY
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Start Expedition button */}
                <div className="border-t border-neutral-900 pt-4">
                  {isHost ? (
                    <button
                      onClick={handleStartExpedition}
                      disabled={loading || connectedPlayers.length === 0}
                      className="w-full py-3 bg-red-950/40 hover:bg-red-700 border border-red-900/40 hover:border-red-500 text-red-400 hover:text-white font-extrabold uppercase text-xs tracking-widest transition-all rounded cursor-pointer shadow-lg hover:shadow-red-900/20 flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Skull className="w-4 h-4" />
                          START EXPEDITION
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="flex items-center justify-center gap-2 py-3 bg-neutral-900/30 border border-neutral-900/50 rounded text-neutral-500 select-none">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-red-500" />
                      <span className="text-[10px] tracking-widest uppercase font-bold animate-pulse">
                        WAITING FOR HOST TO EXPEDITION...
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer System Status Bar */}
      <footer className="w-full border-t border-neutral-900 pt-3 z-10 flex flex-col sm:flex-row justify-between items-center text-[9px] text-neutral-600 tracking-widest">
        <div className="text-left py-1 truncate max-w-full sm:max-w-xs uppercase">
          {scrollyText}
        </div>
        <div className="py-1">
          ANALOG MODEL v1.0.6 // STABLE_INGRESS
        </div>
      </footer>
    </div>
  );
}
