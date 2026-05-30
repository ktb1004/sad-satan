/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState } from 'react';
import { audio } from '../lib/audio';
import { GamePhase, HorrorCue, MultiplayerRoom } from '../types';
import { Eye, ShieldAlert, Navigation, RotateCw, Play, SkipForward, Sun, Trophy, Users } from 'lucide-react';
import ScreamerCanvas from './ScreamerCanvas';
import { Peer } from 'peerjs';

interface GameCanvasProps {
  onGameEnd: (success: boolean) => void;
  onTransitionPhase: (phase: GamePhase) => void;
  currentPhase: GamePhase;
  multiplayerConfig?: { roomId: string; playerId: string; initialRoom: any; isP2PFallback?: boolean } | null;
}

// 24x24 Map Grid representing the corridor maze
// 0 = Empty hallway
// 1 = Regular dirty concrete wall
// 2 = Wall type with Creepy Silhouette image
// 3 = Wall type with Screaming Face image
// 4 = Red pulsing static walls (disturbed anomaly)
// 5 = Extreme dark escape hatch / exit doorway
const MAP = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,0,0,0,0,1,0,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,1],
  [1,0,1,1,0,1,0,1,1,1,1,0,1,0,1,1,1,0,1,1,1,1,0,1],
  [1,0,1,0,0,0,0,1,0,0,1,0,1,0,1,0,0,0,1,0,0,1,0,1], // (1,3) start area
  [1,0,1,0,1,1,1,1,0,0,1,0,1,0,1,0,1,1,1,0,0,1,0,1],
  [1,0,0,0,1,0,0,0,0,1,1,0,0,0,1,0,1,0,0,0,1,1,0,1],
  [1,1,3,1,1,0,1,1,0,1,0,0,1,1,1,0,1,0,1,1,1,0,0,1], // Wall (2,6) has Screamer Face Wall
  [1,0,0,0,0,0,1,0,0,1,1,0,1,0,0,0,1,0,1,0,0,0,1,1],
  [1,0,1,1,2,1,1,0,1,1,0,0,1,0,1,1,1,0,1,0,1,1,1,1], // Wall (4,8) has Silhouette Wall
  [1,0,1,0,0,0,1,0,1,0,0,1,1,0,1,0,0,0,1,0,0,0,0,1],
  [1,0,1,0,1,0,1,0,1,0,1,1,0,0,1,0,1,1,1,1,1,1,0,1],
  [1,0,0,0,1,0,0,0,1,0,0,0,0,1,1,0,0,0,0,0,0,1,0,1],
  [1,1,1,4,1,1,1,0,1,1,1,1,0,1,0,0,1,1,1,1,0,1,0,1], // Wall (3,12) has red glitch anomaly
  [1,0,0,0,0,0,1,0,0,0,0,1,0,1,1,0,1,0,0,1,0,1,0,1],
  [1,0,1,1,1,0,1,1,1,1,0,1,0,0,1,0,1,0,1,1,0,1,0,1],
  [1,0,1,0,1,0,0,0,0,1,0,1,1,0,1,0,1,0,0,0,0,1,0,1],
  [1,0,1,0,1,1,1,1,0,1,0,0,0,0,1,0,1,1,1,1,1,1,0,1], // Corridor triggers creepy whisper
  [1,0,0,0,0,0,0,1,0,1,1,1,1,1,1,0,0,0,0,0,0,0,0,1],
  [1,1,1,1,1,1,0,1,0,0,0,0,0,0,1,1,1,1,1,1,1,1,0,1],
  [1,0,0,0,0,1,0,1,1,1,1,1,1,0,1,0,0,0,0,0,0,1,0,1],
  [1,0,1,1,0,1,0,0,0,0,0,0,1,0,1,0,1,1,1,1,0,1,0,1],
  [1,0,1,0,0,1,1,1,1,1,1,0,1,0,1,0,1,0,0,1,0,1,0,5], // (23,21) is near dark exit 5
  [1,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
];

export default function GameCanvas({ onGameEnd, onTransitionPhase, currentPhase, multiplayerConfig }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Game state refs (avoid closure stale properties in animation loop)
  const playerRef = useRef({
    x: 1.5,
    y: 1.5,
    angle: 0.8, // Face inward
    fov: 85, // Widen FOV for much wider range of view as requested
    bob: 0
  });

  const keysPressed = useRef<{ [key: string]: boolean }>({});
  
  // Image assets
  const figureImgRef = useRef<HTMLImageElement | null>(null);
  const faceImgRef = useRef<HTMLImageElement | null>(null);
  const textureCanvasesRef = useRef<{ [key: string]: HTMLCanvasElement }>({});

  const [loadingAssets, setLoadingAssets] = useState(true);
  const [fear, setFear] = useState(0);
  const [flashlightState, setFlashlightState] = useState({ strength: 1, timer: 0 });
  const [shaking, setShaking] = useState(false);
  const [flashScreamer, setFlashScreamer] = useState(false);
  const [screamerIndex, setScreamerIndex] = useState(0);
  const [introStep, setIntroStep] = useState(0);
  const [glitchText, setGlitchText] = useState('');
  const [isPointerLocked, setIsPointerLocked] = useState(false);
  const [brightness, setBrightness] = useState(2.6); // Increased base brightness for visual clarity
  const brightnessRef = useRef(2.6);
  const fearRef = useRef(0);
  const flashlightOnRef = useRef(true);

  useEffect(() => {
    fearRef.current = fear;
  }, [fear]);

  useEffect(() => {
    flashlightOnRef.current = flashlightState.strength > 0.05;
  }, [flashlightState.strength]);

  // Multiplayer-specific states and refs
  const [roomState, setRoomState] = useState<MultiplayerRoom | null>(multiplayerConfig?.initialRoom || null);
  const roomStateRef = useRef<MultiplayerRoom | null>(multiplayerConfig?.initialRoom || null);
  const [hasEscaped, setHasEscaped] = useState(false);
  const hasEscapedRef = useRef(false);
  const localScreamingRef = useRef(false);
  const localScreamerIndexRef = useRef(0);
  const zBuffer = useRef<number[]>([]);
  const previousScreamingRef = useRef<{ [id: string]: boolean }>({});

  const peerRef = useRef<Peer | null>(null);
  const peerConnectionsRef = useRef<{ [pId: string]: any }>({});

  const handleIncomingPeerData = (opId: string, payload: any) => {
    const current = roomStateRef.current;
    if (!current) return;

    // Handle P2P shard pick ups
    if (payload && payload.type === 'claim_shard') {
      setRoomState((prev) => {
        if (!prev) return null;
        if (prev.gatheredShards.includes(payload.shardId)) return prev;
        audio.triggerWhisper();
        return {
          ...prev,
          gatheredShards: [...prev.gatheredShards, payload.shardId]
        };
      });
      return;
    }

    // Adapt PeerJS target peer string back to local room state identifiers if needed
    let mappedOpId = opId;
    if (opId.includes('sadsatan-room-')) {
      if (opId.endsWith('-host')) {
        const foundHost = Object.keys(current.players).find(id => id.startsWith('p_host_') || id.includes('host'));
        mappedOpId = foundHost || opId;
      } else {
        const parts = opId.split('-peer-');
        if (parts.length > 1) {
          mappedOpId = parts[parts.length - 1];
        }
      }
    }

    if (!current.players[mappedOpId]) return;

    // Directly update ref coordinates for ultra-vibe smooth rendering update
    const op = current.players[mappedOpId];
    if (payload.x !== undefined) op.x = payload.x;
    if (payload.y !== undefined) op.y = payload.y;
    if (payload.angle !== undefined) op.angle = payload.angle;
    if (payload.bob !== undefined) op.bob = payload.bob;
    if (payload.fear !== undefined) op.fear = payload.fear;
    if (payload.flashlightOn !== undefined) op.flashlightOn = payload.flashlightOn;
    
    if (payload.screaming && !op.screaming) {
      // Directly trigger bloodcurdling scream instantly over WebRTC!
      audio.triggerScreech();
      setGlitchText(`${op.username.toUpperCase()} IS SCREAMING!`);
      setTimeout(() => setGlitchText(''), 1800);
    }
    
    if (payload.screaming !== undefined) op.screaming = payload.screaming;
    if (payload.screamerIndex !== undefined) op.screamerIndex = payload.screamerIndex;
    if (payload.escaped !== undefined) op.escaped = payload.escaped;
    op.lastSeen = Date.now();

    // Trigger state propagation for react UI HUD alerts
    setRoomState({
      ...current,
      players: {
        ...current.players,
        [mappedOpId]: { ...op }
      }
    });
  };

  // Synchronise room state reference
  useEffect(() => {
    roomStateRef.current = roomState;
  }, [roomState]);
  
  // Custom Touch Drag tracking specs
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const previousAngleRef = useRef<number>(0);

  // Track steps walked for dynamic random jumpscare checks
  const stepCountRef = useRef<number>(0);
  const lastScareTimeRef = useRef<number>(0);

  useEffect(() => {
    const handlePointerLockChange = () => {
      setIsPointerLocked(document.pointerLockElement === canvasRef.current);
    };

    document.addEventListener('pointerlockchange', handlePointerLockChange);
    return () => {
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
    };
  }, []);

  // Sync state loop with Server / P2P Fallback checks
  useEffect(() => {
    if (!multiplayerConfig) return;

    const { roomId, playerId, isP2PFallback } = multiplayerConfig;

    const getPeerJSId = (pId: string, rId: string) => {
      if (pId.startsWith('p_host_')) {
        return `sadsatan-room-${rId}-host`;
      }
      return `sadsatan-room-${rId}-peer-${pId}`;
    };

    if (isP2PFallback) {
      const intervalId = setInterval(() => {
        const current = roomStateRef.current;
        if (!current) return;

        // Verify and connect any unconnected full-mesh WebRTC data channels
        Object.keys(current.players).forEach((pId) => {
          if (pId !== playerId) {
            const p2pPeer = peerRef.current;
            if (p2pPeer && !p2pPeer.destroyed && !peerConnectionsRef.current[pId]) {
              // Ensure we don't double call: lower lex playerId initiates the data channel
              if (playerId < pId) {
                const targetPeerId = getPeerJSId(pId, roomId);
                console.log(`[P2P] Connecting WebRTC handshakes to peer: ${pId} (${targetPeerId})`);
                const conn = p2pPeer.connect(targetPeerId);
                peerConnectionsRef.current[pId] = conn;

                conn.on('open', () => {
                  console.log(`[P2P] WebRTC open with peer: ${pId}`);
                });
                conn.on('data', (payload: any) => {
                  handleIncomingPeerData(pId, payload);
                });
                conn.on('close', () => {
                  console.log(`[P2P] Co-op link disconnected: ${pId}`);
                  delete peerConnectionsRef.current[pId];
                });
                conn.on('error', (err) => {
                  console.warn(`[P2P] Link error with: ${pId}`, err);
                  delete peerConnectionsRef.current[pId];
                });
              }
            }
          }
        });

        // P2P game end observer
        const allPlayersEscapedOrFinished = Object.keys(current.players).every((id) => {
          if (id === playerId) return hasEscapedRef.current;
          return current.players[id].escaped;
        });

        if (allPlayersEscapedOrFinished && hasEscapedRef.current) {
          clearInterval(intervalId);
          audio.stopAll();
          onGameEnd(true);
        }
      }, 350);

      return () => {
        clearInterval(intervalId);
      };
    }

    const intervalId = setInterval(async () => {
      try {
        const p = playerRef.current;
        const res = await fetch(`/api/rooms/${roomId}/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerId,
            x: p.x,
            y: p.y,
            angle: p.angle,
            bob: p.bob,
            fear,
            flashlightOn: flashlightState.strength > 0.05,
            screaming: localScreamingRef.current,
            screamerIndex: localScreamerIndexRef.current,
            escaped: hasEscapedRef.current,
          })
        });
        const data = await res.json();
        if (data.success) {
          setRoomState(data.room);

          // Check if someone else just started screaming
          const prevScreaming = previousScreamingRef.current;
          const currentScreaming: { [id: string]: boolean } = {};

          Object.keys(data.room.players).forEach((pId) => {
            if (pId !== playerId) {
              const op = data.room.players[pId];
              currentScreaming[pId] = op.screaming;

              if (op.screaming && !prevScreaming[pId]) {
                // Play spook distant scream sound!
                audio.triggerScreech();
                setGlitchText(`${op.username.toUpperCase()} IS SCREAMING!`);
                setTimeout(() => setGlitchText(''), 1800);
              }

              // [P2P Connection Handshake Check]
              const p2pPeer = peerRef.current;
              if (p2pPeer && !p2pPeer.destroyed && !peerConnectionsRef.current[pId]) {
                if (playerId < pId) {
                  console.log(`[P2P] Connecting WebRTC data channel with peer: ${pId}`);
                  const conn = p2pPeer.connect(pId);
                  peerConnectionsRef.current[pId] = conn;

                  conn.on('open', () => {
                    console.log(`[P2P] Outbound WebRTC open with: ${pId}`);
                  });
                  conn.on('data', (payload: any) => {
                    handleIncomingPeerData(pId, payload);
                  });
                  conn.on('close', () => {
                    console.log(`[P2P] WebRTC connection closed by peer: ${pId}`);
                    delete peerConnectionsRef.current[pId];
                  });
                  conn.on('error', (err) => {
                    console.warn(`[P2P] Connection error with peer: ${pId}`, err);
                    delete peerConnectionsRef.current[pId];
                  });
                }
              }
            }
          });

          previousScreamingRef.current = currentScreaming;

          // If room has ended, clean stop and finish
          if (data.room.status === 'ended') {
            clearInterval(intervalId);
            audio.stopAll();
            onGameEnd(true);
          }
        }
      } catch (err) {
        console.error('Co-op sync call failed:', err);
      }
    }, 280); // Quick responsive sync throttle

    return () => {
      clearInterval(intervalId);
    };
  }, [multiplayerConfig, fear, flashlightState.strength]);

  // PeerJS Client Instance Initialization & P2P High Frequency Broadcasting
  useEffect(() => {
    if (!multiplayerConfig) return;

    const { roomId, playerId, isP2PFallback } = multiplayerConfig;
    
    const getPeerJSId = (pId: string, rId: string) => {
      if (pId.startsWith('p_host_')) {
        return `sadsatan-room-${rId}-host`;
      }
      return `sadsatan-room-${rId}-peer-${pId}`;
    };

    const isSecure = window.location.protocol === 'https:';
    const host = window.location.hostname;
    // Calculate correct signaling port dynamically
    const port = window.location.port ? parseInt(window.location.port) : (isSecure ? 443 : 80);

    let peer: Peer;
    if (isP2PFallback) {
      const myId = getPeerJSId(playerId, roomId);
      console.log(`[P2P/WebRTC] Initializing Serverless Decoupled Peer: ${myId}`);
      peer = new Peer(myId, { debug: 1 });
    } else {
      console.log(`[P2P/WebRTC] Initializing Standard Peer for ${playerId} on ${host}:${port}`);
      peer = new Peer(playerId, {
        host: host,
        port: port,
        path: '/peerjs/myapp',
        secure: isSecure,
        debug: 1, // Only log errors
      });
    }

    peerRef.current = peer;

    peer.on('open', (id) => {
      console.log(`[P2P/WebRTC] Registered successfully on signaling server as: ${id}`);
    });

    peer.on('error', (err) => {
      console.warn('[P2P/WebRTC] Peer signaling trigger notice:', err);
    });

    // Accept incoming direct connections
    peer.on('connection', (conn) => {
      console.log(`[P2P/WebRTC] WebRTC connection accepted from: ${conn.peer}`);
      
      const cleanPeerId = isP2PFallback ? extractPlayerIdFromPeerJS(conn.peer) : conn.peer;
      peerConnectionsRef.current[cleanPeerId] = conn;

      conn.on('data', (data: any) => {
        handleIncomingPeerData(conn.peer, data);
      });

      conn.on('close', () => {
        console.log(`[P2P/WebRTC] WebRTC connection closed by peer: ${conn.peer}`);
        delete peerConnectionsRef.current[cleanPeerId];
      });

      conn.on('error', (err) => {
        console.warn(`[P2P/WebRTC] Connection channel error with ${conn.peer}:`, err);
        delete peerConnectionsRef.current[cleanPeerId];
      });
    });

    const extractPlayerIdFromPeerJS = (rawId: string) => {
      if (rawId.endsWith('-host')) {
        const foundHost = Object.keys(roomStateRef.current?.players || {}).find(id => id.startsWith('p_host_') || id.includes('host'));
        return foundHost || 'host';
      }
      const parts = rawId.split('-peer-');
      if (parts.length > 1) {
        return parts[parts.length - 1];
      }
      return rawId;
    };

    // High frequency (60ms) P2P position broadcaster
    const sendInterval = setInterval(() => {
      const p = playerRef.current;
      if (!p || !peer || peer.destroyed) return;

      const payload = {
        x: p.x,
        y: p.y,
        angle: p.angle,
        bob: p.bob,
        fear: fearRef.current,
        flashlightOn: flashlightOnRef.current,
        screaming: localScreamingRef.current,
        screamerIndex: localScreamerIndexRef.current,
        escaped: hasEscapedRef.current,
      };

      Object.values(peerConnectionsRef.current).forEach((conn: any) => {
        if (conn && conn.open) {
          conn.send(payload);
        }
      });
    }, 60);

    return () => {
      console.log('[P2P/WebRTC] Disposing P2P client resources on unmount');
      clearInterval(sendInterval);
      Object.values(peerConnectionsRef.current).forEach((conn: any) => {
        try { conn.close(); } catch (_) {}
      });
      peerConnectionsRef.current = {};
      try {
        peer.destroy();
      } catch (_) {}
      peerRef.current = null;
    };
  }, [multiplayerConfig]);

  // Set up Horror Triggers
  const triggersRef = useRef<HorrorCue[]>([
    { x: 1.5, y: 5.5, type: 'flash_face', triggered: false },   // Immediate early scary jumpscare
    { x: 3.5, y: 3.5, type: 'flash_face', triggered: false },   // Junction screamer
    { x: 1.5, y: 16.5, type: 'whisper', triggered: false },     // Narrow pass whisper
    { x: 5.5, y: 7.5, type: 'glitch', triggered: false },       // Corridor dead end glitch
    { x: 7.5, y: 2.5, type: 'glitch', triggered: false },       // Left pathway glitch
    { x: 10.5, y: 1.5, type: 'flash_face', triggered: false },  // Face scare
    { x: 4.5, y: 12.5, type: 'flash_figure', triggered: false },// Shadowy apparition
    { x: 12.5, y: 9.5, type: 'flash_face', triggered: false },  // Sudden middle maze screamer
    { x: 13.5, y: 15.5, type: 'flash_figure', triggered: false },// Flash shadowy visual figure
    { x: 15.5, y: 5.5, type: 'whisper', triggered: false },     // Ghost voice
    { x: 18.5, y: 4.5, type: 'flash_face', triggered: false },  // Late screamer junction
    { x: 13.5, y: 21.5, type: 'glitch', triggered: false },     // Red lights trigger
    { x: 9.5, y: 18.5, type: 'flash_face', triggered: false },  // Screaming face
    { x: 4.5, y: 19.5, type: 'heavy_rumble', triggered: false },// Metal dragging noises
    { x: 17.5, y: 17.5, type: 'flash_face', triggered: false }, // Near exit screamer 1
    { x: 19.5, y: 21.5, type: 'flash_face', triggered: false }, // Near exit screamer 2
    { x: 21.5, y: 15.5, type: 'flash_face', triggered: false }, // Scream jump incident close to exit
    { x: 20.5, y: 1.5, type: 'heavy_rumble', triggered: false }  // Creepy metal drag noise
  ]);

  useEffect(() => {
    // Generate Procedural Textures on mount
    generateTextures();

    // Load generated image assets
    let loadedCount = 0;
    const totalToLoad = 2;

    const onAssetLoaded = () => {
      loadedCount++;
      if (loadedCount >= totalToLoad) {
        setLoadingAssets(false);
      }
    };

    const figImg = new Image();
    figImg.src = '/src/assets/images/creepy_figure_1780100928837.png';
    figImg.referrerPolicy = 'no-referrer';
    figImg.onload = onAssetLoaded;
    figImg.onerror = () => {
      // Fallback procedural generation if image loads error
      console.warn('Fallen back to solid creepy figure simulation.');
      onAssetLoaded();
    };
    figureImgRef.current = figImg;

    const faceImg = new Image();
    faceImg.src = '/src/assets/images/screaming_face_1780100945280.png';
    faceImg.referrerPolicy = 'no-referrer';
    faceImg.onload = onAssetLoaded;
    faceImg.onerror = () => {
      console.warn('Fallen back to solid screaming face simulation.');
      onAssetLoaded();
    };
    faceImgRef.current = faceImg;

    // Key event listeners
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Set up procedural gray/mold textures for raycaster
  const generateTextures = () => {
    // Concrete tile texture (64x64)
    const concrete = document.createElement('canvas');
    concrete.width = 64;
    concrete.height = 64;
    const ctx = concrete.getContext('2d')!;
    const concreteData = ctx.createImageData(64, 64);
    for (let i = 0; i < concreteData.data.length; i += 4) {
      const val = 15 + Math.floor(Math.random() * 25); // low res mold grey
      concreteData.data[i] = val;
      concreteData.data[i+1] = val;
      concreteData.data[i+2] = val;
      concreteData.data[i+3] = 255;
    }
    ctx.putImageData(concreteData, 0, 0);

    // Add black vertical concrete block markings
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 1;
    for (let y = 0; y < 64; y += 16) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(64, y);
      ctx.stroke();
    }
    for (let y = 0; y < 64; y += 16) {
      const offset = (y % 32 === 0) ? 0 : 16;
      for (let x = offset; x < 64; x += 32) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + 16);
        ctx.stroke();
      }
    }

    // Red pulse glitch wall
    const redGlitch = document.createElement('canvas');
    redGlitch.width = 64;
    redGlitch.height = 64;
    const rgCtx = redGlitch.getContext('2d')!;
    rgCtx.fillStyle = '#080000';
    rgCtx.fillRect(0, 0, 64, 64);

    textureCanvasesRef.current = {
      concrete,
      redGlitch
    };
  };

  // Dynamically trigger randomized spooky happenings to maximize jumpscare density
  const triggerRandomScare = () => {
    const scareTypes = ['face', 'glitch', 'whisper'];
    const selectedSeer = scareTypes[Math.floor(Math.random() * scareTypes.length)];
    
    console.log(`RANDOM JUMPSCARE TRIGGERED: ${selectedSeer}`);
    
    if (selectedSeer === 'face') {
      audio.triggerScreech();
      // Randomize screamer visual style index (0-9)
      const targetIdx = Math.floor(Math.random() * 10);
      setScreamerIndex(targetIdx);
      localScreamingRef.current = true;
      localScreamerIndexRef.current = targetIdx;
      setFlashScreamer(true);
      setShaking(true);
      
      const scaryMsgs = [
        'WARNING: COGNITIVE SYSTEM OVERFLOW',
        'SYSTEM ERROR: FILE 666 ACCESSED',
        'DO NOT INGEST THE MOLD.',
        'RUN. RUN. RUN.',
        'IT HUNTS THE RED CORRIDOR.'
      ];
      setGlitchText(scaryMsgs[Math.floor(Math.random() * scaryMsgs.length)]);
      
      setTimeout(() => {
        setFlashScreamer(false);
        setShaking(false);
        setGlitchText('');
        localScreamingRef.current = false;
      }, 700);
    } else if (selectedSeer === 'glitch') {
      audio.triggerScreech();
      setShaking(true);
      
      const scaryMsgs = [
        'ITS RIGHT BEHIND YOU.',
        'SAD_SATAN_DECAY SEES YOU.',
        'THE WALLS ARE SHIVERING...',
        'GET OUT BEFORE SHE AWAKES.'
      ];
      setGlitchText(scaryMsgs[Math.floor(Math.random() * scaryMsgs.length)]);
      
      setTimeout(() => {
        setShaking(false);
        setGlitchText('');
      }, 950);
    } else {
      audio.triggerWhisper();
      audio.triggerCreak();
      setShaking(true);
      
      const scaryMsgs = [
        'CAN YOU HEAR THE SOBBING?',
        'YOU DESERVED THIS MAZE.',
        'SAD_SATAN_DECRYPT_0x93FF',
        'NO ESCAPING THE SIXTH CORRIDOR.'
      ];
      setGlitchText(scaryMsgs[Math.floor(Math.random() * scaryMsgs.length)]);
      
      setTimeout(() => {
        setShaking(false);
        setGlitchText('');
      }, 1100);
    }
  };

  // Main Raycast Render Loop
  useEffect(() => {
    if (loadingAssets || currentPhase !== GamePhase.PLAYING) return;

    let animFrame: number;
    let localFear = 0;
    let localFlashlightStrength = 1.0;
    let frameCount = 0;

    const gameLoop = () => {
      frameCount++;
      const player = playerRef.current;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Ensure canvas matches display size dynamically
      if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
      }

      const screenWidth = canvas.width;
      const screenHeight = canvas.height;

      // Prevent coordinate drift/spinning: reset translation matrices and save transform state
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.save();

      // 1. INPUT PROCESSING & COLLISION CHECKING
      let moveX = 0;
      let moveY = 0;
      const moveSpeed = hasEscapedRef.current ? 0 : 0.038; // Pacing: slow walk speed to build high psychological tension, frozen when escaped
      const rotateSpeed = hasEscapedRef.current ? 0.006 : 0.025;

      // Rotation Inputs (Left/Right Arrows or A/D keys mapping lookup)
      if (keysPressed.current['arrowleft'] || keysPressed.current['q']) {
        player.angle -= rotateSpeed;
      }
      if (keysPressed.current['arrowright'] || keysPressed.current['e']) {
        player.angle += rotateSpeed;
      }

      // Direction vectors values
      const forwardDirX = Math.cos(player.angle);
      const forwardDirY = Math.sin(player.angle);
      const rightDirX = -Math.sin(player.angle); // Strafe perpendicular definitions
      const rightDirY = Math.cos(player.angle);

      // Forward/Backward
      if (keysPressed.current['w'] || keysPressed.current['arrowup']) {
        moveX += forwardDirX * moveSpeed;
        moveY += forwardDirY * moveSpeed;
      }
      if (keysPressed.current['s'] || keysPressed.current['arrowdown']) {
        moveX -= forwardDirX * moveSpeed;
        moveY -= forwardDirY * moveSpeed;
      }
      // Strafe Left/Right
      if (keysPressed.current['a']) {
        moveX -= rightDirX * moveSpeed;
        moveY -= rightDirY * moveSpeed;
      }
      if (keysPressed.current['d']) {
        moveX += rightDirX * moveSpeed;
        moveY += rightDirY * moveSpeed;
      }

      // Check movement collision separately for sliding alongside boundaries
      const isPlayerMoving = Math.abs(moveX) > 0.001 || Math.abs(moveY) > 0.001;
      
      if (isPlayerMoving) {
        const nextX = player.x + moveX;
        const nextY = player.y + moveY;

        // Slide along X axis
        if (!checkCollision(nextX, player.y)) {
          player.x = nextX;
        }
        // Slide along Y axis
        if (!checkCollision(player.x, nextY)) {
          player.y = nextY;
        }

        // Bobbing sway effect calculation
        player.bob += 0.16;
        if (frameCount % 18 === 0) {
          // Play slow wet floor steps procedurally!
          audio.triggerFootstep();

          // Increment steps walked and trigger random screams (decreased frequency based on user critique)
          stepCountRef.current += 1;
          const now = Date.now();
          if (stepCountRef.current >= 24 && now - lastScareTimeRef.current > 18000) {
            // More spaced out, organic random occurrences with realistic 35% probability
            if (Math.random() < 0.35) {
              stepCountRef.current = 0;
              lastScareTimeRef.current = now;
              triggerRandomScare();
            }
          }
        }
      } else {
        // Quiet idle breathing sway
        player.bob += 0.035;
      }

      // Update Audio ambient fear factor
      audio.updateState(isPlayerMoving, localFear);

      // 2. CHECK HORROR CUES / TRIGGERS IN REAL-TIME
      checkCues(player.x, player.y, (intensity) => {
        localFear = Math.min(localFear + intensity, 1.0);
        setFear(localFear);
      });

      // Fear Decay (slow return over distance)
      if (localFear > 0.0) {
        localFear = Math.max(localFear - 0.001, 0.0);
        setFear(localFear);
      }

      // 3. FLASHLIGHT STRENGTH FLICKER SIMULATION
      localFlashlightStrength = simulateFlashlight(frameCount, localFear);

      // 4. RAYCAST SCENE RENDERING
      // Clear screen
      ctx.fillStyle = '#010101';
      ctx.fillRect(0, 0, screenWidth, screenHeight);

      // Scale floor and ceiling colors dynamically with user-controlled brightness
      const floorGray = Math.min(100, Math.floor(25 * brightnessRef.current));
      const ceilGray = Math.min(80, Math.floor(13 * brightnessRef.current));
      ctx.fillStyle = `rgb(${ceilGray}, ${ceilGray}, ${ceilGray})`; // Interactive ceiling
      ctx.fillRect(0, 0, screenWidth, screenHeight / 2);
      ctx.fillStyle = `rgb(${floorGray}, ${floorGray}, ${floorGray})`; // Interactive floor
      ctx.fillRect(0, screenHeight / 2, screenWidth, screenHeight / 2);

      // FOV math variables
      const halfFovRad = (player.fov * Math.PI) / 180 / 2;
      const planeX = -Math.sin(player.angle) * Math.tan(halfFovRad);
      const planeY = Math.cos(player.angle) * Math.tan(halfFovRad);

      // Draw columns and track wall depths in zBuffer
      zBuffer.current = new Array(screenWidth).fill(9999);
      for (let x = 0; x < screenWidth; x++) {
        // Calculate ray position & direction vector coords
        const cameraX = (2 * x) / screenWidth - 1; // x-coordinate in camera space
        const rayDirX = forwardDirX + planeX * cameraX;
        const rayDirY = forwardDirY + planeY * cameraX;

        // DDA (Digital Differential Analysis) setup
        let mapX = Math.floor(player.x);
        let mapY = Math.floor(player.y);

        // Length of ray from one x or y side to next x or y side
        const deltaDistX = Math.abs(1 / rayDirX);
        const deltaDistY = Math.abs(1 / rayDirY);

        let sideDistX = 0;
        let sideDistY = 0;

        let stepX = 0;
        let stepY = 0;

        let hit = 0; // Was wall hit?
        let side = 0; // 0 for vertical side, 1 for horizontal side
        let wallValue = 0;

        if (rayDirX < 0) {
          stepX = -1;
          sideDistX = (player.x - mapX) * deltaDistX;
        } else {
          stepX = 1;
          sideDistX = (mapX + 1.0 - player.x) * deltaDistX;
        }

        if (rayDirY < 0) {
          stepY = -1;
          sideDistY = (player.y - mapY) * deltaDistY;
        } else {
          stepY = 1;
          sideDistY = (mapY + 1.0 - player.y) * deltaDistY;
        }

        // DDA stepping loop
        const maxSteps = 40;
        let ddaStepCount = 0;
        while (hit === 0 && ddaStepCount < maxSteps) {
          ddaStepCount++;
          // Jump to next map square, either in x-dir or in y-dir
          if (sideDistX < sideDistY) {
            sideDistX += deltaDistX;
            mapX += stepX;
            side = 0;
          } else {
            sideDistY += deltaDistY;
            mapY += stepY;
            side = 1;
          }

          // Boundary checks
          if (mapX < 0 || mapX >= MAP[0].length || mapY < 0 || mapY >= MAP.length) {
            break;
          }

          if (MAP[mapY][mapX] > 0) {
            hit = 1;
            wallValue = MAP[mapY][mapX];
          }
        }

        if (hit === 1) {
          // Calculate distance projected on camera direction (unfish-eye calculation)
          let perpWallDist = 0;
          if (side === 0) {
            perpWallDist = (mapX - player.x + (1 - stepX) / 2) / rayDirX;
          } else {
            perpWallDist = (mapY - player.y + (1 - stepY) / 2) / rayDirY;
          }

          // Guard division of 0
          if (perpWallDist < 0.05) perpWallDist = 0.05;

          // Store in depth buffer
          zBuffer.current[x] = perpWallDist;

          // Calculate height of line to draw on screen
          const lineHeight = Math.floor(screenHeight / perpWallDist);

          // Head-bob height offset
          const bobOffset = Math.sin(player.bob) * (isPlayerMoving ? 8 : 2.5);
          
          // Calculate lowest and highest pixel to fill in current stripe
          const drawStart = Math.floor(-lineHeight / 2 + screenHeight / 2 + bobOffset);
          const drawEnd = Math.floor(lineHeight / 2 + screenHeight / 2 + bobOffset);

          // Textured rendering coordinates calculation
          let wallX = 0; // Exact hit coordinate on wall
          if (side === 0) {
            wallX = player.y + perpWallDist * rayDirY;
          } else {
            wallX = player.x + perpWallDist * rayDirX;
          }
          wallX -= Math.floor(wallX);

          const texWidth = 64;
          let texX = Math.floor(wallX * texWidth);
          if (side === 0 && rayDirX > 0) texX = texWidth - texX - 1;
          if (side === 1 && rayDirY < 0) texX = texWidth - texX - 1;

          // Decide texture buffer
          let texCanvas: HTMLCanvasElement | HTMLImageElement = textureCanvasesRef.current.concrete;
          
          if (wallValue === 2 && figureImgRef.current) {
            // Silhouette Custom Spooky Image
            texCanvas = figureImgRef.current;
          } else if (wallValue === 3 && faceImgRef.current) {
            // Screamer Ghost image
            texCanvas = faceImgRef.current;
          } else if (wallValue === 4) {
            // Dynamic red flickering anomaly wall
            texCanvas = textureCanvasesRef.current.redGlitch;
            // Draw red flashing noise dynamically
            const rgCtx = textureCanvasesRef.current.redGlitch.getContext('2d')!;
            rgCtx.fillStyle = frameCount % 6 < 3 ? '#3f0000' : '#030000';
            rgCtx.fillRect(0, 0, 64, 64);
          } else if (wallValue === 5) {
            // Flat pure endless black void door
            ctx.fillStyle = '#000000';
            ctx.fillRect(x, Math.max(0, drawStart), 1, Math.min(screenHeight, drawEnd - drawStart));
            continue;
          }

          // Draw the textured vertical slice
          try {
            ctx.drawImage(
              texCanvas,
              texX, 0, 1, 64, // Source segment
              x, drawStart, 1, drawEnd - drawStart // Destination vertical slice
            );
          } catch (e) {
            // Fail safe fallback - generic gray wall
            ctx.fillStyle = '#202020';
            ctx.fillRect(x, drawStart, 1, drawEnd - drawStart);
          }

          // 5. LIGHTING DECAY & FLASHLIGHT CONE OVERLAY
          const fogMaxDistance = 4.0;
          let fogRatio = perpWallDist / fogMaxDistance;
          
          // Flashlight falloff calculation: stronger in center column, decays at sides
          const screenCenterDistance = Math.abs(x - screenWidth / 2) / (screenWidth / 2);
          // Spotlight cone widened based on user brightness selection to prevent thick dark side borders
          const coneBeamFactor = Math.max(0.45, 1.0 - screenCenterDistance * (0.6 / brightnessRef.current)); 
          
          // Base wall illuminance scales strongly using brightnessRef.current
          // We make it much higher than before (up to 4.2x)
          let illuminance = (4.2 / (perpWallDist * 0.16 + 0.18)) * coneBeamFactor * localFlashlightStrength * (brightnessRef.current / 2.0);
          
          // Apply a rich base ambient visibility that scales directly with our slider
          // Set standard starting ambient from 0.32 up to 0.70 at maximum brightness!
          const minAmbient = Math.min(0.85, 0.32 + (brightnessRef.current - 1.0) * 0.16);
          illuminance = Math.min(Math.max(illuminance, minAmbient), 1.0); // Keep bounds

          // Shade slice with black depending on darkness
          const darkness = 1.0 - illuminance;
          if (darkness > 0) {
            ctx.fillStyle = `rgba(0, 0, 0, ${darkness})`;
            ctx.fillRect(x, drawStart, 1, drawEnd - drawStart);
          }

          // Shade shadows on side walls (dimmed when brightness is turned up high)
          if (side === 1) {
            const sideShadow = Math.max(0.1, 0.35 - (brightnessRef.current - 1.0) * 0.08);
            ctx.fillStyle = `rgba(0, 0, 0, ${sideShadow})`;
            ctx.fillRect(x, drawStart, 1, drawEnd - drawStart);
          }
        }
      }

      // 5.5 MULTIPLAYER CO-OP BILLBOARD SPRITES & GATES (OTHER PLAYERS AND SPECTRAL SHARDS)
      const currentRoom = roomStateRef.current;
      if (currentRoom) {
        const spritesToDraw: { x: number; y: number; type: 'player' | 'shard'; label: string; data?: any }[] = [];

        // Accumulate active other players
        Object.keys(currentRoom.players).forEach((pId) => {
          if (pId !== multiplayerConfig?.playerId) {
            const op = currentRoom.players[pId];
            if (!op.escaped) {
              spritesToDraw.push({
                x: op.x,
                y: op.y,
                type: 'player',
                label: op.username,
                data: op
              });
            }
          }
        });

        // Accumulate uncollected shards
        currentRoom.shardPositions.forEach((shard: any) => {
          if (!currentRoom.gatheredShards.includes(shard.id)) {
            spritesToDraw.push({
              x: shard.x,
              y: shard.y,
              type: 'shard',
              label: 'SPECTRAL SHARD',
              data: shard
            });
          }
        });

        // Compute distance from player to sprites & sort using Painter's Algorithm
        spritesToDraw.forEach((s) => {
          (s as any).dist = Math.hypot(s.x - player.x, s.y - player.y);
        });
        spritesToDraw.sort((a, b) => (b as any).dist - (a as any).dist);

        // Render each sorted sprite in 3D projection
        spritesToDraw.forEach((s) => {
          const dx = s.x - player.x;
          const dy = s.y - player.y;

          // Inverse camera projection matrix math
          const invDet = 1.0 / (planeX * forwardDirY - forwardDirX * planeY);
          const transformX = invDet * (forwardDirY * dx - forwardDirX * dy);
          const transformY = invDet * (-planeY * dx + planeX * dy);

          if (transformY > 0.08) { // Visible in front of player viewport
            const spriteScreenX = Math.floor((screenWidth / 2) * (1 + transformX / transformY));
            const bobOffset = Math.sin(player.bob) * (isPlayerMoving ? 8 : 2.5);

            // Sprite scaling factors
            const spriteHeight = Math.abs(Math.floor(screenHeight / transformY));
            const drawStartY = Math.floor(-spriteHeight / 2 + screenHeight / 2 + bobOffset);
            const drawEndY = Math.floor(spriteHeight / 2 + screenHeight / 2 + bobOffset);

            const spriteWidth = Math.abs(Math.floor(screenHeight / transformY));
            const drawStartX = Math.floor(-spriteWidth / 2 + spriteScreenX);
            const drawEndX = Math.floor(spriteWidth / 2 + spriteScreenX);

            // Color palette definition: glowing emerald green for explorers, cyan/sapphire for shards
            const color = s.type === 'player' ? '0, 255, 102' : '0, 180, 255';

            // Draw slice columns
            for (let stripe = drawStartX; stripe < drawEndX; stripe++) {
              if (stripe >= 0 && stripe < screenWidth && transformY < zBuffer.current[stripe]) {
                const pctX = (stripe - drawStartX) / spriteWidth;

                // Glowing vertical light-shaft gradient
                const opacity = Math.max(0, 0.52 - Math.abs(pctX - 0.5) * 1.05) * (1.2 / (transformY * 0.25 + 0.8));
                ctx.fillStyle = `rgba(${color}, ${opacity})`;
                ctx.fillRect(stripe, drawStartY, 1, drawEndY - drawStartY);

                // High density white core beam
                if (Math.abs(pctX - 0.5) < 0.07) {
                  const coreOpacity = (1.0 / (transformY * 0.25 + 0.8)) * 0.75;
                  ctx.fillStyle = `rgba(255, 255, 255, ${coreOpacity})`;
                  ctx.fillRect(stripe, drawStartY, 1, drawEndY - drawStartY);
                }
              }
            }

            // Draw text labels / Nickname tags above the center column of the sprite
            if ((s as any).dist < 7.5) {
              const textOpacity = Math.max(0.15, 1.0 - (s as any).dist / 7.5);
              ctx.save();
              ctx.fillStyle = s.type === 'player' ? `rgba(180, 255, 180, ${textOpacity})` : `rgba(150, 225, 255, ${textOpacity})`;
              ctx.shadowColor = 'black';
              ctx.shadowBlur = 4;
              ctx.font = 'bold 9px "JetBrains Mono"';
              ctx.textAlign = 'center';
              ctx.fillText(s.label, spriteScreenX, drawStartY - 10);

              // Jumpscare screaming feedback status alert
              if (s.type === 'player' && s.data?.screaming) {
                ctx.fillStyle = `rgba(255, 50, 50, ${Math.sin(Date.now() * 0.12) * 0.5 + 0.5})`;
                ctx.fillText('▲ DISTORTED CRY!', spriteScreenX, drawStartY - 24);
              }
              ctx.restore();
            }
          }
        });

        // 5.6 CHECK SHARDS TRIGGER DISTANCE (CLIENT RUNTIME THRESHOLD)
        currentRoom.shardPositions.forEach((shard: any) => {
          if (!currentRoom.gatheredShards.includes(shard.id)) {
            const dist = Math.hypot(player.x - shard.x, player.y - shard.y);
            if (dist < 0.45) {
              // Whisper trigger local alert sound & request server collection claim
              audio.triggerWhisper();
              
              if (multiplayerConfig?.isP2PFallback) {
                // Update local state directly
                setRoomState((prev) => {
                  if (!prev) return null;
                  if (prev.gatheredShards.includes(shard.id)) return prev;
                  return {
                    ...prev,
                    gatheredShards: [...prev.gatheredShards, shard.id]
                  };
                });
                // Broadcast shard claim directly to all connected P2P peers
                Object.values(peerConnectionsRef.current).forEach((conn: any) => {
                  if (conn && conn.open) {
                    conn.send({ type: 'claim_shard', shardId: shard.id });
                  }
                });
              } else {
                fetch(`/api/rooms/${currentRoom.id}/claim-shard`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ shardId: shard.id })
                }).catch(console.error);
              }
            }
          }
        });
      }

      // 6. POST PROCESSING LAYER: VIGNETTE + FILM GRAIN + CHROMATIC ABERRATION
      // Apply dark circular vignetting overlay (classic tunnel vision, softened by brightness)
      const vignetteInnerRad = Math.min(screenWidth / 2, (screenWidth / 4) * (brightnessRef.current / 1.5));
      const vignetteOuterRad = Math.min(screenWidth * 1.5, (screenWidth / 1.1) * (brightnessRef.current / 1.5));
      const vignette = ctx.createRadialGradient(
        screenWidth / 2, screenHeight / 2, vignetteInnerRad,
        screenWidth / 2, screenHeight / 2, vignetteOuterRad
      );
      // Fear turns vignette slightly bloody red
      const redVal = Math.floor(localFear * 35);
      vignette.addColorStop(0, `rgba(${redVal}, 0, 0, 0)`);
      // Soften maximum vignette edge darkness when high brightness is chosen!
      const vignetteMaxDarkness = Math.max(0.1, 0.82 - (brightnessRef.current - 1.0) * 0.2);
      vignette.addColorStop(1, `rgba(0, 0, 0, ${vignetteMaxDarkness + localFear * 0.06})`);
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, screenWidth, screenHeight);

      // CRT Scanline horizontal grid
      ctx.fillStyle = 'rgba(0,0,0,0.06)';
      for (let y = 0; y < screenHeight; y += 4) {
        ctx.fillRect(0, y, screenWidth, 1);
      }

      // Fast procedural film grain noise overlay
      ctx.fillStyle = 'rgba(255, 255, 255, 0.055)';
      for (let j = 0; j < 12; j++) {
        const h = Math.random() * screenHeight;
        const w = 4 + Math.random() * 12;
        ctx.fillRect(Math.random() * screenWidth, h, w, 1);
      }

      // Fear glitch scan displacements
      if (localFear > 0.65 && frameCount % 22 < 3) {
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fillRect(0, Math.random() * screenHeight, screenWidth, 1 + Math.random() * 8);
        ctx.translate((Math.random() * 12 - 6), 0); // Horizontal frame displacement shaker
      }

      // End trigger escape success transition check
      const exitDistance = Math.hypot(player.x - 23.5, player.y - 21.5);
      if (exitDistance < 0.6) {
        if (multiplayerConfig) {
          const currentRoom = roomStateRef.current;
          const totalShards = currentRoom?.shardPositions?.length || 5;
          const collectedCount = currentRoom?.gatheredShards?.length || 0;
          
          if (collectedCount >= totalShards) {
            if (!hasEscapedRef.current) {
              console.log("Co-op Escape Achieved!");
              hasEscapedRef.current = true;
              setHasEscaped(true);
              audio.triggerWhisper(); // Play spooky sound
            }
          } else {
            // Flash warning to find more shards
            if (frameCount % 60 === 0) {
              setGlitchText(`ALL SHARDS MUST BE GATHERED (${collectedCount}/${totalShards})`);
              setTimeout(() => setGlitchText(''), 1500);
            }
          }
        } else {
          // Singleplayer mode escapes instantly
          audio.stopAll();
          onGameEnd(true);
        }
      }

      // Restore saved canvas transform matrix state to balance the shaker displacement
      ctx.restore();

      animFrame = requestAnimationFrame(gameLoop);
    };

    animFrame = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animFrame);
    };
  }, [loadingAssets, currentPhase]);

  // Utility collision checker
  const checkCollision = (newX: number, newY: number) => {
    // Add safety buffer around walls to avoid clipping inside geometries
    const buffer = 0.22;
    const gridX = Math.floor(newX);
    const gridY = Math.floor(newY);

    if (gridX < 0 || gridX >= MAP[0].length || gridY < 0 || gridY >= MAP.length) return true;
    if (MAP[gridY][gridX] !== 0) return true;

    // Check surrounding directions
    if (MAP[gridY][Math.floor(newX - buffer)] !== 0) return true;
    if (MAP[gridY][Math.floor(newX + buffer)] !== 0) return true;
    if (MAP[Math.floor(newY - buffer)][gridX] !== 0) return true;
    if (MAP[Math.floor(newY + buffer)][gridX] !== 0) return true;

    return false;
  };

  // Horror triggers handler
  const checkCues = (x: number, y: number, triggerFear: (intensity: number) => void) => {
    triggersRef.current.forEach((trigger) => {
      if (trigger.triggered) return;

      const dist = Math.hypot(x - trigger.x, y - trigger.y);
      if (dist < 1.6) { // Expanded radius from 0.95 to trigger jumpscares more reliably
        trigger.triggered = true;
        console.log(`HORROR TRIGGER FIRED: ${trigger.type}`);

        if (trigger.type === 'whisper') {
          audio.triggerWhisper();
          triggerFear(0.4);
          setGlitchText('YOU HEARD HER DIDNT YOU.');
          setTimeout(() => setGlitchText(''), 2200);
        } else if (trigger.type === 'heavy_rumble') {
          audio.triggerCreak();
          triggerFear(0.5);
          setGlitchText('DO NOT SENSITIZE. STAY CALM.');
          setTimeout(() => setGlitchText(''), 2500);
        } else if (trigger.type === 'glitch') {
          audio.triggerScreech();
          setShaking(true);
          triggerFear(0.85);
          setTimeout(() => setShaking(false), 800);
        } else if (trigger.type === 'flash_figure') {
          audio.triggerWhisper();
          audio.triggerCreak();
          triggerFear(0.7);
        } else if (trigger.type === 'flash_face') {
          // Absolute jumpscare event! Takes over full screen for 500ms
          audio.triggerScreech();
          const targetIdx = Math.floor(Math.random() * 10);
          setScreamerIndex(targetIdx);
          localScreamingRef.current = true;
          localScreamerIndexRef.current = targetIdx;
          setFlashScreamer(true);
          triggerFear(1.0);
          setGlitchText('SYSTEM ERROR: OVERDRAFT IN FILE 666');
          
          setTimeout(() => {
            setFlashScreamer(false);
            setGlitchText('');
            localScreamingRef.current = false;
          }, 650);
        }
      }
    });
  };

  // Modulates flashlight intensity and flickering
  const simulateFlashlight = (frameCount: number, localFear: number) => {
    let base = 1.0;
    
    // Fear increases flicker likelihood
    const threshold = 0.992 - (localFear * 0.04);
    if (Math.random() > threshold) {
      base = 0.15 + Math.random() * 0.45; // Sudden dim pulse
    }

    // Rare full power outage
    if (frameCount % 450 > 425 && Math.random() > 0.98) {
      base = 0.0;
    }

    return base;
  };

  // Virtual buttons lookup for tap controls
  const handleVirtualNav = (dir: 'w' | 's' | 'a' | 'd' | 'left' | 'right', isPressed: boolean) => {
    if (dir === 'left') {
      keysPressed.current['arrowleft'] = isPressed;
    } else if (dir === 'right') {
      keysPressed.current['arrowright'] = isPressed;
    } else {
      keysPressed.current[dir] = isPressed;
    }
  };

  // Touch drag control interface to translate camera horizontally
  const handleCanvasTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length > 0) {
      dragStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      previousAngleRef.current = playerRef.current.angle;
    }
  };

  const handleCanvasTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (dragStartRef.current && e.touches.length > 0) {
      const deltaX = e.touches[0].clientX - dragStartRef.current.x;
      // Convert screen delta into radians rotation sweep
      playerRef.current.angle = previousAngleRef.current + (deltaX * 0.005);
    }
  };

  const handleCanvasTouchEnd = () => {
    dragStartRef.current = null;
  };

  // Click initiates browser pointer lock
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.requestPointerLock?.();
    }
  };

  // Mouse drag looking around alternative
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (document.pointerLockElement === canvasRef.current) return;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    previousAngleRef.current = playerRef.current.angle;
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // If pointer locked, rotate directly with mouse displacement speed
    if (document.pointerLockElement === canvasRef.current) {
      playerRef.current.angle += e.movementX * 0.0022;
      return;
    }

    if (dragStartRef.current) {
      const deltaX = e.clientX - dragStartRef.current.x;
      playerRef.current.angle = previousAngleRef.current + (deltaX * 0.003);
    }
  };

  const handleCanvasMouseUp = () => {
    dragStartRef.current = null;
  };

  // Initial Intro cinematic slides
  const handleNextIntro = () => {
    if (introStep < 2) {
      setIntroStep(introStep + 1);
      audio.triggerWhisper();
    } else {
      onTransitionPhase(GamePhase.PLAYING);
    }
  };

  if (loadingAssets) {
    return (
      <div className="w-full h-screen bg-black flex flex-col items-center justify-center text-neutral-400 font-mono">
        <div className="text-sm font-semibold animate-pulse tracking-[0.2em] mb-4">모든 지형 텍스처 및 미로 신호 디코딩 중...</div>
        <div className="w-48 h-1 bg-neutral-900 overflow-hidden">
          <div className="h-full bg-neutral-100 w-2/3 rounded animate-[pulse_1.5s_infinite]" />
        </div>
      </div>
    );
  }

  // INTRO SLIDES PHASE
  if (currentPhase === GamePhase.INTRO) {
    return (
      <div className="w-full h-screen bg-[#050505] text-[#cecece] font-mono flex flex-col justify-between p-8 select-none relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-[0.05] bg-[size:100%_4px] bg-gradient-to-b from-white to-black z-10" />
        
        <header className="text-[10px] text-neutral-600 tracking-wider">
          도입//통신_시드_기밀_해독_중
        </header>

        <main className="max-w-xl mx-auto flex-1 flex flex-col justify-center items-center text-center">
          {introStep === 0 && (
            <div className="space-y-4 animate-fade-in">
              <p className="text-sm border-l border-red-700/60 pl-4 py-2 text-left text-neutral-400 font-sans italic">
                "익명의 보안 포럼 자국 깊은 곳에 업로드된 외딴 소프트웨어 모듈에 대한 전설이 존재했습니다. 사람들은 이를 '6번 복도' 또는 '부패'라고 불렀습니다. 통제 지도도, 위치 표식도 없었습니다. 수많은 이들이 뒤돌아 도망쳤습니다. 그러지 못했던 이들은... 미로의 끝자락을 보았으나 그 무엇도 입 밖으로 꺼내지 못했습니다."
              </p>
            </div>
          )}

          {introStep === 1 && (
            <div className="space-y-4 animate-fade-in">
              <p className="text-sm pl-4 py-2 text-left text-neutral-400 font-sans">
                당신은 한 발짝 발을 들여놓습니다. 공기는 차갑고 쇠 냄새와 무거운 정전기 음이 감돕니다. 일렁이는 손전등 배터리는 곧 꺼질 듯이 충정량이 미미하며, 나침반은 방향을 완전히 상실한 채 비정상적인 회전을 거듭하고 있습니다.
              </p>
              <div className="text-[11px] text-red-600 font-semibold tracking-wider text-center pt-4">
                [무기는 존재하지 않습니다. 오직 회피하고, 응시하십시오.]
              </div>
            </div>
          )}

          {introStep === 2 && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="text-xs uppercase text-neutral-200 tracking-[0.2em] mb-2 font-bold flex items-center justify-center gap-2">
                <Navigation className="w-4 h-4 text-red-800" />
                6번 복도 안전 탐색 지침서
              </h3>
              <p className="text-xs text-neutral-500 max-w-sm mx-auto leading-relaxed text-center">
                <span className="text-neutral-100 font-bold border border-neutral-800 px-1.5 py-0.5 rounded bg-neutral-900">W</span> / 
                <span className="text-neutral-100 font-bold border border-neutral-800 px-1.5 py-0.5 rounded bg-neutral-900">S</span> 키로 전후방 걷기. 
                <span className="text-neutral-100 font-bold border border-neutral-800 px-1.5 py-0.5 rounded bg-neutral-900">A</span> / 
                <span className="text-neutral-100 font-bold border border-neutral-800 px-1.5 py-0.5 rounded bg-neutral-900">D</span> 키로 좌우 슬라이딩 옆걸음질. 
                화면을 터치 슬라이드하거나 우측 하단의 좌/우 전용 회전 햅틱 영역을 눌러 좌우 시선을 돌려 빈틈없이 살피세요. 끝자락에 연결된 칠흑의 게이트 해치를 찾아 생환하십시오.
              </p>
            </div>
          )}
        </main>

        <footer className="flex justify-end z-20">
          <button
            onClick={handleNextIntro}
            className="px-6 py-2 border border-neutral-800 hover:border-neutral-400 text-neutral-400 hover:text-neutral-100 text-xs font-semibold tracking-widest flex items-center gap-2 uppercase transition-all duration-300 cursor-pointer"
          >
            {introStep === 2 ? '진입하기' : '계속하기'}
            <SkipForward className="w-3.5 h-3.5" />
          </button>
        </footer>
      </div>
    );
  }

  // SCRAM / JUMPSCARE VISUAL EMERGENCY OVERLAY
  const renderScreamerOverlay = () => {
    if (!flashScreamer) return null;
    return (
      <div className="absolute inset-0 z-50 bg-neutral-950 flex items-center justify-center pointer-events-none select-none">
        <ScreamerCanvas index={screamerIndex} />
        {/* Red high density vignette/color tint */}
        <div className="absolute inset-0 bg-red-950/20 pointer-events-none z-55 mix-blend-multiply" />
        {/* Hardware-safe glitch strobe flasher */}
        <div className="absolute inset-0 bg-white/10 animate-[pulse_0.08s_infinite] pointer-events-none z-55" />
      </div>
    );
  };

  return (
    <div className={`relative w-full h-screen bg-[#020202] text-[#e5e5e5] select-none font-mono flex flex-col justify-between overflow-hidden ${shaking ? 'animate-[shake_0.22s_infinite]' : ''}`}>
      {/* 3D Raycasting Canvas Area */}
      <canvas
        id="three-horizontal-renderer"
        ref={canvasRef}
        onClick={handleCanvasClick}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onTouchStart={handleCanvasTouchStart}
        onTouchMove={handleCanvasTouchMove}
        onTouchEnd={handleCanvasTouchEnd}
        className="absolute inset-0 w-full h-full cursor-pointer bg-black z-0 block"
      />

      {/* Click-to-lock mouse sights indicator for desktop browser viewports */}
      {!isPointerLocked && !loadingAssets && currentPhase === GamePhase.PLAYING && (
        <div className="absolute top-[24%] left-1/2 transform -translate-x-1/2 z-30 text-center pointer-events-none select-none animate-pulse">
          <div className="text-[10px] text-neutral-400 bg-neutral-950/85 px-4 py-2 border border-neutral-900 rounded font-bold tracking-[0.25em] uppercase shadow-2xl">
            이곳을 클릭하여 마우스 시선을 동기화하세요 (ESC로 연결 탈착)
          </div>
        </div>
      )}

      {/* Scream scare popup layer */}
      {renderScreamerOverlay()}

      {/* Glitch flickering ambient message overlay */}
      {glitchText && (
        <div className="absolute top-[22%] left-1/2 transform -translate-x-1/2 z-30 text-center animate-pulse">
          <div className="text-red-700 bg-black/8 w-fit mx-auto px-4 py-1.5 border border-red-900/50 uppercase tracking-[0.25em] text-xs font-extrabold shadow-2xl backdrop-blur-sm select-none">
            {glitchText}
          </div>
        </div>
      )}

      {/* Interactive Brightness Control HUD Slider */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20 flex items-center gap-3 bg-neutral-950/85 border border-neutral-800 p-2.5 rounded shadow-2xl backdrop-blur-sm">
        <Sun className="w-4 h-4 text-amber-500 animate-[spin_12s_linear_infinite]" />
        <div className="flex flex-col gap-1">
          <label htmlFor="brightness-slider" className="text-[9px] uppercase tracking-widest text-neutral-300 font-bold select-none flex justify-between items-center w-36">
            <span>화면 보정 밝기</span>
            <span className="text-amber-500 font-mono">x{brightness.toFixed(1)}</span>
          </label>
          <input
            id="brightness-slider"
            type="range"
            min="1.0"
            max="5.0"
            step="0.1"
            value={brightness}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setBrightness(val);
              brightnessRef.current = val;
            }}
            className="w-36 accent-amber-500 cursor-pointer h-1 bg-neutral-800 rounded appearance-none"
          />
        </div>
      </div>

      {/* Retro VHS Analog HUD Panels */}
      <div className="absolute top-4 left-4 z-10 pointer-events-none tracking-widest text-[9px] text-neutral-400 bg-neutral-950/70 border border-neutral-900/50 p-2.5 rounded backdrop-blur-sm select-none flex flex-col gap-1">
        {multiplayerConfig ? (
          <>
            <div className="text-red-500 font-bold uppercase flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-red-600 rounded-full animate-ping" />
              협동 세션 방 코드: {multiplayerConfig.roomId}
            </div>
            <div className="text-neutral-500 uppercase text-[8px] mt-0.5 border-t border-neutral-900 pt-1">대원 생존 무결성:</div>
            {roomState?.players && Object.values(roomState.players).map((p: any) => (
              <div key={p.id} className="flex justify-between gap-4 text-[8px] text-neutral-300">
                <span className="uppercase font-bold">{p.username}</span>
                <span className={p.escaped ? "text-emerald-500 font-extrabold" : p.screaming ? "text-red-500 animate-pulse font-extrabold" : "text-neutral-500"}>
                  {p.escaped ? "생환 이탈" : p.screaming ? "절대 위기!" : "인식 안정"}
                </span>
              </div>
            ))}
          </>
        ) : (
          <>
            <div>동기 신호: 극도로 저하됨</div>
            <div>수신 강도: {Math.max(0, 100 - Math.floor(fear * 82))}%</div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="w-2 h-2 bg-red-750 border border-red-900 animate-ping rounded-full inline-block" />
              <span className="text-red-500 uppercase tracking-widest">실시간 수록 트랙 4번 라인</span>
            </div>
          </>
        )}
      </div>

      <div className="absolute top-4 right-4 z-10 pointer-events-none text-right tracking-wider text-[9px] text-neutral-400 bg-neutral-950/70 border border-neutral-900/50 p-2.5 rounded backdrop-blur-sm select-none flex flex-col gap-1">
        {multiplayerConfig ? (
          <>
            <div className="text-cyan-400 font-extrabold uppercase tracking-widest text-[10px]">
              해독된 기억의 파편: {roomState?.gatheredShards?.length || 0} / {roomState?.shardPositions?.length || 5}
            </div>
            {roomState?.gatheredShards?.length === roomState?.shardPositions?.length ? (
              <div className="text-emerald-500 font-black animate-pulse text-[8px] uppercase mt-0.5">
                ▲ 복도 생환 출구 래치 개방 완료 (23, 21)
              </div>
            ) : (
              <div className="text-[8px] text-neutral-500 uppercase mt-0.5">
                방황하는 모든 백색 발광 기억 파편을 회수하십시오
              </div>
            )}
            <div className="text-[8px] text-neutral-500 font-mono mt-1 pt-1 border-t border-neutral-900">
              현재 현장 좌표: X_{Math.floor(playerRef.current.x)} / Y_{Math.floor(playerRef.current.y)}
            </div>
          </>
        ) : (
          <>
            <div>로컬 고유 시드코드: 0x93FF</div>
            <div>동기화 영역 위치 좌표: X_{Math.floor(playerRef.current.x)} / Y_{Math.floor(playerRef.current.y)}</div>
            <div className="text-[8px] text-neutral-500 font-mono mt-1">SAD_SATAN_DECRYPTED</div>
          </>
        )}
      </div>

      {/* TOUCH / MOBILE / COMFORT SCREEN GAME CONTROLS GRID */}
      {/* Semi-transparent tactical overlays for navigation inside iframes */}
      <div className="absolute bottom-[2%] left-[45%] transform -translate-x-[45%] md:left-6 md:translate-x-0 z-20 flex flex-col gap-2 p-3 bg-neutral-950/50 border border-neutral-900/30 rounded backdrop-blur-sm select-none">
        <div className="flex justify-center">
          <button
            onMouseDown={() => handleVirtualNav('w', true)}
            onMouseUp={() => handleVirtualNav('w', false)}
            onTouchStart={() => handleVirtualNav('w', true)}
            onTouchEnd={() => handleVirtualNav('w', false)}
            className="w-11 h-11 bg-neutral-900/80 active:bg-neutral-100 hover:bg-neutral-800 active:text-neutral-950 text-neutral-300 border border-neutral-800 rounded flex items-center justify-center font-extrabold text-xs cursor-pointer focus:outline-none"
          >
            W
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onMouseDown={() => handleVirtualNav('a', true)}
            onMouseUp={() => handleVirtualNav('a', false)}
            onTouchStart={() => handleVirtualNav('a', true)}
            onTouchEnd={() => handleVirtualNav('a', false)}
            className="w-11 h-11 bg-neutral-900/80 active:bg-neutral-100 hover:bg-neutral-800 active:text-neutral-950 text-neutral-300 border border-neutral-800 rounded flex items-center justify-center font-extrabold text-xs cursor-pointer focus:outline-none"
          >
            A
          </button>
          <button
            onMouseDown={() => handleVirtualNav('s', true)}
            onMouseUp={() => handleVirtualNav('s', false)}
            onTouchStart={() => handleVirtualNav('s', true)}
            onTouchEnd={() => handleVirtualNav('s', false)}
            className="w-11 h-11 bg-neutral-900/80 active:bg-neutral-100 hover:bg-neutral-800 active:text-neutral-950 text-neutral-300 border border-neutral-800 rounded flex items-center justify-center font-extrabold text-xs cursor-pointer focus:outline-none"
          >
            S
          </button>
          <button
            onMouseDown={() => handleVirtualNav('d', true)}
            onMouseUp={() => handleVirtualNav('d', false)}
            onTouchStart={() => handleVirtualNav('d', true)}
            onTouchEnd={() => handleVirtualNav('d', false)}
            className="w-11 h-11 bg-neutral-900/80 active:bg-neutral-100 hover:bg-neutral-800 active:text-neutral-950 text-neutral-300 border border-neutral-800 rounded flex items-center justify-center font-extrabold text-xs cursor-pointer focus:outline-none"
          >
            D
          </button>
        </div>
      </div>

      {/* Rotation buttons on the right - extreme luxury addition so users without cursor setups can rotate look-camera hassle-free */}
      <div className="absolute bottom-[2%] right-[5%] z-20 flex gap-2 p-3 bg-neutral-950/50 border border-neutral-900/30 rounded backdrop-blur-sm select-none">
        <button
          onMouseDown={() => handleVirtualNav('left', true)}
          onMouseUp={() => handleVirtualNav('left', false)}
          onTouchStart={() => handleVirtualNav('left', true)}
          onTouchEnd={() => handleVirtualNav('left', false)}
          className="w-11 h-11 bg-neutral-900/80 active:bg-neutral-100 hover:bg-neutral-800 active:text-neutral-950 text-neutral-300 border border-neutral-800 rounded flex flex-col items-center justify-center font-extrabold text-[10px] cursor-pointer focus:outline-none"
        >
          <RotateCw className="w-3.5 h-3.5 scale-x-[-1] mb-0.5" />
          좌측 시야
        </button>
        <button
          onMouseDown={() => handleVirtualNav('right', true)}
          onMouseUp={() => handleVirtualNav('right', false)}
          onTouchStart={() => handleVirtualNav('right', true)}
          onTouchEnd={() => handleVirtualNav('right', false)}
          className="w-11 h-11 bg-neutral-900/80 active:bg-neutral-100 hover:bg-neutral-800 active:text-neutral-950 text-neutral-300 border border-neutral-800 rounded flex flex-col items-center justify-center font-extrabold text-[10px] cursor-pointer focus:outline-none"
        >
          <RotateCw className="w-3.5 h-3.5 mb-0.5" />
          우측 시야
        </button>
      </div>

      {/* Static Scanline Overlap Filters */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.06] bg-gradient-to-b from-transparent via-neutral-100 to-black z-40 block" />

      {/* CO-OP SPECTATOR / EXTRACTION RECONSTRUCT OVERLAY */}
      {hasEscaped && (
        <div className="absolute inset-0 bg-neutral-950/92 backdrop-blur-md z-45 flex flex-col items-center justify-center text-center font-mono p-6">
          <div className="w-16 h-16 bg-emerald-950/50 border border-emerald-500 rounded-full flex items-center justify-center mb-6 text-emerald-500 animate-pulse">
            <Trophy className="w-8 h-8" />
          </div>
          
          <h2 className="text-lg font-black tracking-[0.3em] uppercase text-emerald-500 mb-2">
            신호 생환 복원 완료
          </h2>
          <p className="text-xs text-neutral-400 max-w-sm mb-6 leading-relaxed text-[10px] uppercase tracking-widest leading-relaxed">
            축하합니다. 신속하게 탈출 전선 Sector-B6를 무사 복원하여 이탈 완료하였습니다. 아직 어둠을 배회하는 생존 대원들의 수집을 대조할 수 있도록 잠시 핸드셰이크 링크 상태를 유지해 주십시오...
          </p>

          <div className="w-full max-w-xs bg-neutral-900/40 border border-neutral-900 p-4 rounded text-left">
            <span className="block text-[9px] text-neutral-500 tracking-widest uppercase mb-3 border-b border-neutral-950 pb-1.5 font-bold">
              전원 이탈 생환 스펙트럼
            </span>
            <div className="space-y-2">
              {roomState?.players && Object.values(roomState.players).map((p: any) => (
                <div key={p.id} className="flex justify-between items-center text-xs">
                  <span className="uppercase text-neutral-200 font-bold">{p.username}</span>
                  <span className={p.escaped ? "text-emerald-500 font-extrabold" : p.screaming ? "text-red-500 font-black animate-pulse" : "text-amber-500 font-bold"}>
                    {p.escaped ? "생환 이탈됨" : p.screaming ? "절규 발포 상태!" : "복도 수탐 중"}
                  </span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="text-[8px] text-neutral-600 tracking-widest mt-8 uppercase select-none animate-pulse">
            그 누구도 홀로 외로이 어둠 속에 내버려두지 마라 · S▲T▲N_DEC▲Y v1.0.6
          </div>
        </div>
      )}
    </div>
  );
}
