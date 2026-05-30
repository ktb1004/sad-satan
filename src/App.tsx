/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { GamePhase, UserRole, GameRoomState, StudentState } from './types';
import { networkManager } from './network';
import { audio } from './lib/audio';
import GameCanvas from './components/GameCanvas';
import { 
  ShieldCheck, 
  RefreshCw, 
  Users, 
  VolumeX, 
  Volume2, 
  Tv, 
  Skull, 
  Zap, 
  Eye, 
  Compass, 
  MessageSquare, 
  Trophy, 
  Play, 
  Flame,
  AlertTriangle
} from 'lucide-react';

export default function App() {
  const [phase, setPhase] = useState<GamePhase>(GamePhase.MENU);
  const [username, setUsername] = useState<string>('');
  const [targetRoom, setTargetRoom] = useState<string>('');
  const [role, setRole] = useState<UserRole>(UserRole.CLIENT);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [success, setSuccess] = useState<boolean>(false);
  const [muted, setMuted] = useState<boolean>(false);

  // Network reactive room state
  const [roomState, setRoomState] = useState<GameRoomState | null>(null);
  
  // Host UI warning trigger input
  const [broadcastInput, setBroadcastInput] = useState<string>('');
  
  // Teachers screen logs
  const [dashboardLogs, setDashboardLogs] = useState<string[]>([]);
  const [screamingNotify, setScreamingNotify] = useState<string | null>(null);

  // Auto-fading notifications
  useEffect(() => {
    if (screamingNotify) {
      const timer = setTimeout(() => {
        setScreamingNotify(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [screamingNotify]);

  // Audio setup
  const toggleMute = () => {
    const isMuted = audio.toggleMute();
    setMuted(isMuted);
  };

  const addLog = (log: string) => {
    setDashboardLogs(prev => [`[${new Date().toLocaleTimeString()}] ${log}`, ...prev.slice(0, 18)]);
  };

  // PeerJS setup callbacks
  useEffect(() => {
    // Sync room states
    networkManager.onStateUpdate((updatedState) => {
      setRoomState({ ...updatedState });
    });

    // Student screaming notification for host and peers
    networkManager.onStudentScreamed((studentName) => {
      audio.triggerScreech();
      setScreamingNotify(studentName);
      addLog(`⚠️ 패닉 보고: '${studentName.toUpperCase()}' 대원이 절규하며 비명 감지!`);
    });

    // Client starts playing on launch action
    networkManager.onStartGameReceived(() => {
      console.log('[App] Received launch start trigger from Host!');
      audio.init().then(() => {
        setPhase(GamePhase.PLAYING);
      }).catch(console.error);
    });

    return () => {
      networkManager.cleanup();
    };
  }, []);

  const handleCreateLobby = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setErrorMsg('닉네임을 먼저 입력해 주세요.');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    setDashboardLogs([]);

    const randomRoomCode = Math.floor(1000 + Math.random() * 9000).toString();
    
    await networkManager.initializeHost(
      randomRoomCode,
      username.trim(),
      (roomCode) => {
        setLoading(false);
        setRole(UserRole.HOST);
        setPhase(GamePhase.LOBBY);
        addLog(`서버리스 대기방이 개설되었습니다. ID: ${roomCode}`);
        addLog(`공용 PeerJS 클라우드 시그널링 대기 중.`);
      },
      (err) => {
        setLoading(false);
        setErrorMsg('WebRTC 등록 오류가 발생했습니다. 다시 시도해 주세요: ' + (err.message || err.toString()));
      }
    );
  };

  const handleJoinLobby = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setErrorMsg('닉네임을 먼저 입력해 주세요.');
      return;
    }
    if (!targetRoom.trim()) {
      setErrorMsg('4자리 방 코드를 입력해 주세요.');
      return;
    }
    setLoading(true);
    setErrorMsg('');

    networkManager.initializeClient(
      targetRoom.trim(),
      username.trim(),
      () => {
        setLoading(false);
        setRole(UserRole.CLIENT);
        setPhase(GamePhase.LOBBY);
      },
      (errMessage) => {
        setLoading(false);
        setErrorMsg(errMessage);
      }
    );
  };

  // Initiating the simulation (Host-only)
  const handleStartSimulation = async () => {
    if (role !== UserRole.HOST) return;
    setLoading(true);
    try {
      await audio.init();
      networkManager.launchExpeditionFromHost();
      setPhase(GamePhase.PLAYING);
    } catch (err) {
      setErrorMsg('오디오 설정에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // Quick interactions (Host-only)
  const triggerScare = (studentId: string) => {
    const name = roomState?.peers[studentId]?.username || '탐사자';
    addLog(`${name.toUpperCase()} 대원에게 실시간 갑툭튀 자극 페이로드 인가`);
    networkManager.hostInteractWithStudent(studentId, 'jumpscare');
  };

  const triggerFlicker = (studentId: string) => {
    const name = roomState?.peers[studentId]?.username || '탐사자';
    addLog(`${name.toUpperCase()} 대원의 손전등 배터리 차단 (깜빡임 자극 인가)`);
    networkManager.hostInteractWithStudent(studentId, 'flicker');
  };

  const triggerSpawnShard = (studentId: string) => {
    const name = roomState?.peers[studentId]?.username || '탐사자';
    addLog(`${name.toUpperCase()} 대원 근처에 기억의 파편 표식 투하`);
    networkManager.hostSpawnShardNearStudent(studentId);
  };

  const sendCustomBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastInput.trim()) return;
    addLog(`방송 송출: "${broadcastInput.toUpperCase()}"`);
    networkManager.hostBroadcastSystemWarning(broadcastInput.trim());
    setBroadcastInput('');
  };

  const handleGameEnd = (escaped: boolean) => {
    setSuccess(escaped);
    setPhase(GamePhase.ENDING);
    audio.stopAll();
    networkManager.cleanup();
  };

  const restartGame = () => {
    networkManager.cleanup();
    setPhase(GamePhase.MENU);
    setSuccess(false);
    setRoomState(null);
  };

  return (
    <div id="app-root-frame" className="w-full h-screen bg-[#020202] text-[#cecece] font-mono overflow-hidden relative select-none">
      
      {/* Visual Ambient Overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.04] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-neutral-200 via-neutral-900 to-black mix-blend-overlay z-40 bg-[size:100%_4px]" />

      {/* Scream alert overlay */}
      {screamingNotify && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 bg-red-950/95 border-2 border-red-500 rounded p-4 flex items-center gap-4 z-50 text-red-100 max-w-md animate-bounce shadow-2xl">
          <Flame className="w-6 h-6 animate-pulse text-red-500" />
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-red-400">비상 상황 통보 // 거대 비명 감지됨</div>
            <div className="text-sm font-black uppercase tracking-wider mt-0.5">{screamingNotify} 대원이 절규하는 중!</div>
          </div>
        </div>
      )}

      {/* 1. HOME SCREEN / USERNAME CONFIG */}
      {phase === GamePhase.MENU && (
        <div className="w-full h-screen flex flex-col justify-between p-6 md:p-12 relative z-10 animate-fade-in">
          
          <header className="flex justify-between items-center text-[10px] text-neutral-500 tracking-widest uppercase border-b border-neutral-950 pb-4">
            <div>SIGNAL_MODULE//PEERJS_CLOUD</div>
            <div className="flex items-center gap-4">
              <span className="text-yellow-600 font-bold uppercase animate-pulse">● 서버리스 모드 즉시 준비됨</span>
              <button onClick={toggleMute} className="hover:text-neutral-200 transition-colors cursor-pointer uppercase">
                {muted ? '음소거됨' : '소리 켬'}
              </button>
            </div>
          </header>

          <main className="max-w-md mx-auto w-full flex-1 flex flex-col justify-center">
            <div className="text-center mb-8">
              <div className="text-red-600 font-bold tracking-[0.4em] text-[10px] uppercase mb-2 animate-pulse">DIRECT WEB_RTC DEEP INDUCTION</div>
              <h1 className="text-2xl md:text-3xl font-black text-white tracking-[0.25em] font-mono uppercase mb-1">
                MEM_CORRIDOR.EXE
              </h1>
              <p className="text-[10px] text-neutral-500 tracking-wider font-sans leading-relaxed mt-2 uppercase">
                서버리스 비대칭 멀티 공포 체험. <span className="text-red-500">통제관 교사(방장)</span>가 되어 대원들 상황을 실시간 감시하고 공포를 제어하거나, <span className="text-white">탐사관 학생(플레이어)</span>이 되어 미로에서 극심한 두려움을 이겨내고 살아남으세요.
              </p>
            </div>

            <div className="bg-neutral-950/80 border border-neutral-900 rounded p-6 shadow-2xl space-y-6">
              
              <div>
                <label className="block text-[9px] text-neutral-500 uppercase tracking-widest mb-2 font-bold">1. 대원/지휘관 서명 식별자</label>
                <input
                  type="text"
                  placeholder="닉네임을 입력하세요..."
                  value={username}
                  onChange={(e) => setUsername(e.target.value.slice(0, 14))}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded px-3.5 py-3 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-500 tracking-widest font-mono uppercase text-center"
                />
              </div>

              <div className="border-t border-neutral-900 pt-5">
                <label className="block text-[9px] text-neutral-500 uppercase tracking-widest mb-3 font-bold">2. 지휘 체계 역할 분담</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRole(UserRole.CLIENT)}
                    className={`py-3 rounded border text-[10px] font-bold tracking-widest uppercase transition-all cursor-pointer ${
                      role === UserRole.CLIENT 
                        ? 'bg-neutral-100 text-neutral-950 border-neutral-100' 
                        : 'bg-neutral-900/50 text-neutral-400 border-neutral-800 hover:border-neutral-700'
                    }`}
                  >
                    탐사관 학생 (SURVIVAL)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole(UserRole.HOST)}
                    className={`py-3 rounded border text-[10px] font-bold tracking-widest uppercase transition-all cursor-pointer ${
                      role === UserRole.HOST 
                        ? 'bg-red-950/70 text-red-200 border-red-850' 
                        : 'bg-neutral-900/50 text-neutral-400 border-neutral-800 hover:border-neutral-700'
                    }`}
                  >
                    통제관 교사 (DIRECTOR)
                  </button>
                </div>
              </div>

              {errorMsg && (
                <div className="text-[10px] text-red-500 font-bold tracking-wider uppercase border-l border-red-800 pl-3 py-1 bg-red-950/20 rounded">
                  ⚠️ 오류: {errorMsg}
                </div>
              )}

              <div className="border-t border-neutral-900 pt-5 space-y-4">
                {role === UserRole.HOST ? (
                  <form onSubmit={handleCreateLobby} className="w-full">
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-4 bg-red-900 text-white hover:bg-red-850 text-xs font-black tracking-widest uppercase rounded shadow cursor-pointer transition-all disabled:opacity-50"
                    >
                      {loading ? '신호 주파수 할당 중...' : '직접 탐사 세션 생성 (방 만들기)'}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleJoinLobby} className="space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="text"
                        placeholder="방 코드 입력..."
                        maxLength={4}
                        value={targetRoom}
                        onChange={(e) => setTargetRoom(e.target.value.replace(/[^0-9a-zA-Z]/g, '').toUpperCase())}
                        className="col-span-2 bg-neutral-900 border border-neutral-800 rounded px-3 py-3 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-500 tracking-widest font-mono uppercase text-center"
                      />
                      <button
                        type="submit"
                        disabled={loading}
                        className="bg-neutral-100 hover:bg-neutral-200 text-neutral-950 text-xs font-black tracking-widest uppercase rounded cursor-pointer transition-all disabled:opacity-50"
                      >
                        {loading ? '대기..' : '입장'}
                      </button>
                    </div>
                  </form>
                )}
              </div>

            </div>
          </main>

          <footer className="text-center text-[9px] text-neutral-600 tracking-[0.25em] border-t border-neutral-950 pt-4 uppercase">
            피어-투-피어 공포 통신망 // 고밀도 실시간 텔레메트리 협동 미로
          </footer>

        </div>
      )}

      {/* 2. LOBBY SCREEN (WAITING ROOM WITH CONNECTED CARDS) */}
      {phase === GamePhase.LOBBY && roomState && (
        <div className="w-full h-screen flex flex-col justify-between p-6 md:p-12 z-10 animate-fade-in relative">
          
          <header className="flex justify-between items-center text-[10px] text-neutral-500 tracking-widest border-b border-neutral-900 pb-3">
            <div>SIGNAL_TUNNEL_ESTABLISHED // 통신 채널 정상 수립</div>
            <div className="font-bold flex items-center gap-1.5 text-amber-500">
              <Zap className="w-3.5 h-3.5" />
              PEERJS 세션 코드: {roomState.id}
            </div>
          </header>

          <main className="max-w-4xl mx-auto w-full flex-grow flex flex-col justify-center py-6">
            <div className="text-center mb-8">
              <div className="text-neutral-500 text-[10px] tracking-[0.3em] uppercase mb-1">WAITING LOBBY REGISTRATION</div>
              <h2 className="text-xl md:text-2xl font-black text-white tracking-[0.2em] uppercase">
                접속 모듈 룸: <span className="text-yellow-500 tracking-widest font-mono">{roomState.id}</span>
              </h2>
              {role === UserRole.HOST ? (
                <p className="text-[10px] text-red-500 tracking-normal font-sans uppercase mt-1 animate-pulse font-bold">
                  ★ 아래의 초대 코드 '{roomState.id}'를 탐사 대원들에게 공유하세요. 당신은 공포 수치를 조율하는 통제관입니다. ★
                </p>
              ) : (
                <p className="text-[10px] text-neutral-400 tracking-normal font-sans uppercase mt-1 font-bold">
                  계정 연결 완료: {username ? username.toUpperCase() : '탐사자대원'}. 지휘관이 탐사를 개시하기를 기다리는 중...
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Connected Students Card Lists */}
              <div className="md:col-span-2 bg-neutral-950 border border-neutral-900 rounded p-5 flex flex-col min-h-[250px]">
                <div className="flex justify-between items-center border-b border-neutral-900 pb-2.5 mb-4">
                  <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-neutral-500" />
                    연결 상태의 활성 탐사 대원 목록 ({Object.keys(roomState.peers).length}명)
                  </span>
                  <span className="text-[9px] text-neutral-600 font-bold uppercase">보안 상태</span>
                </div>

                {Object.keys(roomState.peers).length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center text-neutral-600 py-10">
                    <Users className="w-8 h-8 opacity-20 mb-2" />
                    <p className="text-xs tracking-wider">주파수에 동화된 대원이 아직 없습니다...</p>
                    <p className="text-[9px] uppercase tracking-widest mt-1">대기실 번호 '{roomState.id}'를 전파해 소환 장치를 연결하세요</p>
                  </div>
                ) : (
                  <div className="space-y-2 overflow-y-auto flex-1 max-h-[280px] pr-2">
                    {(Object.values(roomState.peers) as StudentState[]).map((peer) => (
                      <div key={peer.id} className="bg-neutral-900/50 border border-neutral-900 rounded p-3 flex justify-between items-center hover:border-neutral-800 transition-all">
                        <div className="flex items-center gap-3">
                          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                          <div>
                            <div className="text-xs font-bold text-neutral-200 uppercase tracking-widest">{peer.username}</div>
                            <div className="text-[8px] text-neutral-600 mt-0.5">고유 피어 계약: {peer.id}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] text-emerald-400 uppercase font-black tracking-widest bg-emerald-950/40 border border-emerald-900 px-2 py-0.5 rounded">
                            대기실 대기 중
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Lobby Status Details & Host Trigger */}
              <div className="bg-neutral-950 border border-neutral-900 rounded p-5 flex flex-col justify-between">
                <div>
                  <div className="text-[10px] text-neutral-400 font-bold tracking-widest uppercase border-b border-neutral-900 pb-2 mb-3">
                    시스템 메모리 할당 상태
                  </div>
                  <div className="space-y-2.5 text-[10px] text-neutral-500 uppercase tracking-wider font-mono">
                    <div className="flex justify-between border-b border-neutral-900/40 pb-1">
                      <span>통신 규격</span>
                      <span className="text-neutral-300 font-bold">WEBRTC P2P</span>
                    </div>
                    <div className="flex justify-between border-b border-neutral-900/40 pb-1">
                      <span>시그널 서버</span>
                      <span className="text-neutral-350 font-bold">0.PEERJS.COM</span>
                    </div>
                    <div className="flex justify-between border-b border-neutral-900/40 pb-1">
                      <span>내장 아키텍처</span>
                      <span className="text-neutral-300 font-bold">100% 서버리스</span>
                    </div>
                    <div className="flex justify-between border-b border-neutral-900/40 pb-1">
                      <span>채널 보안</span>
                      <span className="text-neutral-300">비화 링크 유지</span>
                    </div>
                  </div>
                  
                  {role === UserRole.HOST && (
                    <div className="mt-4 border-t border-neutral-900 pt-3">
                      <div className="text-[9px] text-neutral-500 uppercase font-bold tracking-widest mb-1.5">송출 예정 인가 경고</div>
                      <div className="bg-neutral-900 font-bold border border-neutral-850 p-2.5 text-[10px] text-amber-500 rounded text-center uppercase tracking-widest leading-relaxed">
                        "{roomState.systemAnnouncement}"
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-6">
                  {role === UserRole.HOST ? (
                    <button
                      onClick={handleStartSimulation}
                      disabled={Object.keys(roomState.peers).length === 0}
                      className="w-full py-4 bg-emerald-900 hover:bg-emerald-800 disabled:opacity-40 disabled:hover:bg-emerald-950 text-white text-xs font-black uppercase tracking-widest rounded shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 border border-emerald-800"
                    >
                      <Play className="w-4 h-4" />
                      탐사 개시 (동기 시작)
                    </button>
                  ) : (
                    <div className="w-full text-center py-4 bg-neutral-900 border border-neutral-850 text-neutral-500 text-[10px] font-bold uppercase tracking-widest rounded animate-pulse">
                      통제관과의 핸드셰이크 대기 중...
                    </div>
                  )}
                  
                  <button
                    onClick={restartGame}
                    className="w-full text-center text-[9px] text-neutral-500 hover:text-red-500 font-bold uppercase tracking-widest mt-3 transition-colors underline cursor-pointer"
                  >
                    대기방에서 이식 해제 (퇴장)
                  </button>
                </div>

              </div>

            </div>
          </main>

          <footer className="text-center text-[9px] text-neutral-600 tracking-[0.25em] border-t border-neutral-900 pt-4 uppercase">
            피어-투-피어 공포 통신망 // 동기화 스레드 상시 모니터링
          </footer>

        </div>
      )}

      {/* 3. EXPERIENCE ACTIVE (PLAYING STATE) */}
      {phase === GamePhase.PLAYING && roomState && (
        <div className="w-full h-screen relative">
          {role === UserRole.HOST ? (
            
            // ================== TEACHER / HOST MASTER COMMAND CENTER ==================
            <div className="w-full h-screen bg-[#050505] text-neutral-200 flex flex-col p-4 font-mono select-none overflow-hidden animate-fade-in">
              
              {/* Header Info */}
              <header className="flex justify-between items-center border-b border-neutral-900 pb-2 mb-3 text-[10px] text-neutral-500 tracking-widest uppercase">
                <div className="flex items-center gap-1.5 font-bold text-red-500 animate-pulse">
                  <Tv className="w-4 h-4" />
                  중앙 마스터 콘솔: 탐사 통제 사령국
                </div>
                <div>세션 번호: {roomState.id} // 비화 동기식 연결 암호화</div>
                <div className="flex items-center gap-3">
                  <span className="text-neutral-400">연결 대원 수: {Object.keys(roomState.peers).length}명</span>
                  <button onClick={restartGame} className="text-neutral-500 hover:text-red-500 transition-colors uppercase cursor-pointer">
                    통신 종료
                  </button>
                </div>
              </header>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0">
                
                {/* Left Side: Student Telemetry Grid (8 Columns on Large) */}
                <div className="lg:col-span-8 flex flex-col min-h-0">
                  
                  <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                    {Object.keys(roomState.peers).length === 0 ? (
                      <div className="bg-neutral-900/40 border border-neutral-900 rounded p-12 text-center text-neutral-500 uppercase tracking-widest flex flex-col items-center justify-center h-full">
                        <AlertTriangle className="w-10 h-10 text-yellow-600 mb-3 animate-bounce" />
                        <span className="text-xs block mb-1">수신 유효 텔레메트리 데이터가 존재하지 않습니다.</span>
                        <span className="text-[9px] text-neutral-600">대원들을 초대하여 해당 방 코드로 들어올 수 있도록 하십시오: {roomState.id}</span>
                      </div>
                    ) : (
                      (Object.values(roomState.peers) as StudentState[]).map((student) => {
                        const isScreaming = student.screaming;
                        const fearRating = student.fear;
                        
                        return (
                          <div 
                            key={student.id} 
                            className={`bg-neutral-950 border rounded p-4 relative overflow-hidden transition-all duration-[150ms] ${
                              isScreaming 
                                ? 'border-red-500 shadow-[0_0_25px_rgba(239,68,68,0.25)] bg-red-950/20' 
                                : 'border-neutral-900 hover:border-neutral-850'
                            }`}
                          >
                            
                            {/* Screaming alert background flash */}
                            {isScreaming && (
                              <div className="absolute inset-0 bg-red-950/10 pointer-events-none animate-pulse duration-[100ms] border-2 border-red-500 rounded" />
                            )}

                            {/* Student Specs Line */}
                            <div className="flex justify-between items-start border-b border-neutral-900/60 pb-2 mb-3 z-10 relative">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-black text-white hover:text-red-300 transition-colors uppercase tracking-widest">
                                    {student.username}
                                  </span>
                                  {isScreaming && (
                                    <span className="bg-red-500 text-white text-[8px] font-black uppercase px-1.5 py-0.5 rounded animate-bounce">
                                      극심한 비명 절규 발사 중!
                                    </span>
                                  )}
                                  {student.escaped && (
                                    <span className="bg-emerald-600 text-white text-[8px] font-black uppercase px-1.5 py-0.5 rounded tracking-widest">
                                      미로 탈출 승인
                                    </span>
                                  )}
                                </div>
                                <div className="text-[8px] text-neutral-500 uppercase tracking-wider mt-0.5">
                                  대원 기밀 ID: {student.id} // 텔레메트리 좌표: ({student.x.toFixed(1)}, {student.y.toFixed(1)})
                                </div>
                              </div>

                              <div className="text-right">
                                <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded border ${
                                  student.escaped 
                                    ? 'bg-emerald-950 text-emerald-400 border-emerald-900' 
                                    : 'bg-neutral-900 text-neutral-400 border-neutral-800'
                                }`}>
                                  {student.escaped ? '생환 확보//통신 이탈' : '복도 미로 탐색 수색 중'}
                                </span>
                              </div>
                            </div>

                            {/* Telemetry Data Gauges */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 z-10 relative">
                              
                              {/* Fear Gauge */}
                              <div className="bg-neutral-900/60 p-2 border border-neutral-900/80 rounded">
                                <div className="text-[8px] text-neutral-500 uppercase tracking-wider flex justify-between">
                                  <span>통상적 공포율</span>
                                  <span className={fearRating > 60 ? 'text-red-500 font-bold' : 'text-neutral-400'}>{fearRating.toFixed(0)}%</span>
                                </div>
                                <div className="w-full bg-neutral-950 h-1.5 rounded overflow-hidden mt-1.5">
                                  <div 
                                    className={`h-full transition-all duration-[300ms] ${fearRating > 70 ? 'bg-red-500' : fearRating > 35 ? 'bg-amber-500' : 'bg-blue-400'}`} 
                                    style={{ width: `${Math.min(100, fearRating)}%` }} 
                                  />
                                </div>
                              </div>

                              {/* Flashlight Battery */}
                              <div className="bg-neutral-900/60 p-2 border border-neutral-900/80 rounded">
                                <div className="text-[8px] text-neutral-500 uppercase tracking-wider flex justify-between">
                                  <span>배터리 용량</span>
                                  <span className={student.flashlightBattery < 20 ? 'text-red-500 font-black animate-pulse' : 'text-neutral-300'}>{student.flashlightBattery}%</span>
                                </div>
                                <div className="w-full bg-neutral-950 h-1.5 rounded overflow-hidden mt-1.5">
                                  <div 
                                    className={`h-full transition-all duration-[300ms] ${
                                      student.flashlightBattery < 25 ? 'bg-red-500' : 'bg-neutral-200'
                                    }`} 
                                    style={{ width: `${student.flashlightBattery}%` }} 
                                  />
                                </div>
                              </div>

                              {/* Walked Steps */}
                              <div className="bg-neutral-900/60 p-2 border border-neutral-900/80 rounded">
                                <div className="text-[8px] text-neutral-500 uppercase tracking-wider">탐색 걸음 수</div>
                                <div className="text-xs font-bold font-mono text-neutral-200 mt-1 uppercase">
                                  {student.stepsCount} 보폭
                                </div>
                              </div>

                              {/* Connection Ping status */}
                              <div className="bg-neutral-900/60 p-2 border border-neutral-900/80 rounded">
                                <div className="text-[8px] text-neutral-500 uppercase tracking-wider">통신 감도 무결성</div>
                                <div className="text-xs font-bold text-emerald-400 font-mono mt-1 uppercase flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  P2P 안정적 연결됨
                                </div>
                              </div>

                            </div>

                            {/* Director Triggers Action Board */}
                            <div className="mt-4 pt-3 border-t border-neutral-900/60 flex flex-wrap gap-2 z-10 relative">
                              <span className="text-[8px] text-neutral-500 uppercase tracking-widest font-black flex items-center pr-1 select-none">
                                <AlertTriangle className="w-3 h-3 text-red-700 mr-1" />
                                무기력 자극 유발:
                              </span>
                              
                              <button
                                onClick={() => triggerScare(student.id)}
                                disabled={student.escaped}
                                className="px-3 py-1.5 bg-red-950/80 border border-red-500/30 text-red-400 hover:bg-red-900 hover:text-white transition-all text-[9.5px] font-black uppercase tracking-wider cursor-pointer rounded flex items-center gap-1 select-none disabled:opacity-30 disabled:hover:bg-transparent"
                              >
                                <Skull className="w-3 h-3" />
                                갑툭튀 환각 전송
                              </button>

                              <button
                                onClick={() => triggerFlicker(student.id)}
                                disabled={student.escaped}
                                className="px-3 py-1.5 bg-neutral-900 border border-neutral-800 text-neutral-300 hover:bg-neutral-800 hover:text-white transition-all text-[9.5px] font-bold uppercase tracking-wider cursor-pointer rounded flex items-center gap-1 select-none disabled:opacity-30"
                              >
                                <Zap className="w-3 h-3" />
                                손전등 강제 방전
                              </button>

                              <button
                                onClick={() => triggerSpawnShard(student.id)}
                                disabled={student.escaped}
                                className="px-3 py-1.5 bg-neutral-900 border border-neutral-800 text-amber-500 hover:bg-neutral-800 hover:text-amber-350 transition-all text-[9.5px] font-bold uppercase tracking-wider cursor-pointer rounded flex items-center gap-1 select-none disabled:opacity-30"
                              >
                                <Trophy className="w-3 h-3" />
                                기억 파편 억지 배치
                              </button>
                            </div>

                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Host Custom Messaging Broadcast Input */}
                  <form onSubmit={sendCustomBroadcast} className="mt-4 bg-neutral-950 border border-neutral-900 rounded p-3 flex gap-2">
                    <input
                      type="text"
                      placeholder="대원 화면에 띄울 돌발 고대 신호 경고문을 입력해 인가하세요 (예: '뒤를 돌지 마라')..."
                      value={broadcastInput}
                      onChange={(e) => setBroadcastInput(e.target.value)}
                      className="flex-grow bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-xs text-white uppercase placeholder-neutral-600 font-mono focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="px-4 bg-amber-600 hover:bg-amber-500 text-neutral-950 text-[10px] font-black tracking-widest uppercase rounded cursor-pointer select-none transition-colors"
                    >
                      경고 방송 송출
                    </button>
                  </form>

                </div>

                {/* Right Side: Map & Event Screen (4 Columns on Large) */}
                <div className="lg:col-span-4 flex flex-col gap-4 min-h-0">
                  
                  {/* Minimap Grid Layout */}
                  <div className="bg-neutral-950 border border-neutral-900 rounded p-4 flex flex-col min-h-[220px]">
                    <div className="text-[10px] text-neutral-450 font-bold border-b border-neutral-900 pb-2 mb-3 uppercase tracking-widest flex justify-between items-center select-none">
                      <span>레이더 수평 그리드 // 실시간 미니맵</span>
                      <span className="text-[8px] text-neutral-600 animate-pulse">실시간 수신 피드</span>
                    </div>
                    
                    {/* Visual Coordinate Map representation of corridors */}
                    <div className="flex-1 flex items-center justify-center">
                      <div className="w-40 h-40 border border-neutral-900 relative bg-neutral-900/20 rounded overflow-hidden">
                        
                        {/* Map Grid Background pattern */}
                        <div className="absolute inset-0 grid grid-cols-4 grid-rows-4 opacity-[0.05] pointer-events-none bg-[linear-gradient(to_right,#cecece_1px,transparent_1px),linear-gradient(to_bottom,#cecece_1px,transparent_1px)]" />

                        {/* Gathered memory shards indicator */}
                        {roomState.shards.map((shard) => {
                          const isClaimed = shard.claimedBy !== null;
                          return (
                            <div 
                              key={shard.id}
                              className={`absolute w-1.5 h-1.5 rounded-full transition-all duration-[300ms] ${
                                isClaimed ? 'bg-neutral-800 scale-75 animate-none' : 'bg-amber-500 animate-[ping_1.5s_infinite]'
                              }`}
                              style={{ 
                                left: `${(shard.x / 24) * 100}%`,
                                top: `${(shard.y / 24) * 100}%` 
                              }}
                              title={isClaimed ? '파편 획득됨' : '미획득 기억의 파편 소스'}
                            />
                          );
                        })}

                        {/* Render live Student dots */}
                        {(Object.values(roomState.peers) as StudentState[]).map((student) => {
                          // Plot coordinates relative to 24x24 map
                          const leftPct = (student.x / 24) * 100;
                          const topPct = (student.y / 24) * 100;
                          
                          return (
                            <div
                              key={student.id}
                              className={`absolute -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full flex items-center justify-center border transition-all duration-[100ms] ${
                                student.screaming 
                                  ? 'bg-red-500 border-white scale-125 z-30 animate-pulse' 
                                  : student.escaped 
                                    ? 'bg-emerald-500 border-emerald-900' 
                                    : 'bg-white border-neutral-950 shadow-2xl shadow-black'
                              }`}
                              style={{ left: `${leftPct}%`, top: `${topPct}%` }}
                            >
                              {/* Small direction pointer */}
                              <div 
                                className="w-1 h-3 bg-red-650 rounded-full origin-bottom" 
                                style={{ transform: `rotate(${student.angle}rad)` }} 
                              />
                              
                              {/* Label text */}
                              <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-neutral-950 border border-neutral-900 text-[6px] px-1 rounded uppercase tracking-wider text-neutral-300 font-bold max-w-[40px] truncate max-h-[12px] overflow-hidden select-none whitespace-nowrap">
                                {student.username}
                              </span>
                            </div>
                          );
                        })}

                        {/* Start coordinates dot marker */}
                        <div className="absolute left-[6.25%] top-[6.25%] -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-blue-500" title="수색 시작구역" />
                        
                        {/* Exit hatch cell coordinates */}
                        <div className="absolute left-[95.8%] top-[87.5%] -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded bg-emerald-500/25 border border-emerald-500 animate-pulse" title="생환 통로 해치" />

                      </div>
                    </div>

                    {/* Quick overview metric */}
                    <div className="mt-3 text-[9px] text-neutral-500 uppercase text-center tracking-wider border-t border-neutral-900/60 pt-2">
                      <span>파편 수집 진행률: {roomState.shards.filter(s => s.claimedBy !== null).length} / {roomState.shards.length}개</span>
                    </div>

                  </div>

                  {/* Host Diagnostic Activity Log Board */}
                  <div className="bg-neutral-950 border border-neutral-900 rounded p-4 flex-1 flex flex-col min-h-0">
                    <div className="text-[10px] text-neutral-450 font-bold border-b border-neutral-900 pb-2 mb-2 uppercase tracking-widest select-none">
                      탐사 사건 신호 전달 기록
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-1 text-[8px] text-neutral-500 font-mono uppercase tracking-wider pr-1">
                      {dashboardLogs.length === 0 ? (
                        <span className="text-neutral-600 italic block py-4 text-center">기록된 미로 유도 신호가 존재하지 않습니다...</span>
                      ) : (
                        dashboardLogs.map((log, index) => (
                          <div 
                            key={index} 
                            className={`py-0.5 border-b border-neutral-900/30 font-bold ${
                              log.includes('비명') || log.includes('절규') || log.includes('REPORT')
                                ? 'text-red-500 animate-pulse' 
                                : log.includes('방송') || log.includes('Broadcast')
                                  ? 'text-amber-500' 
                                  : 'text-neutral-500'
                            }`}
                          >
                            {log}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                </div>

              </div>

              {/* Status footer for Teacher */}
              <footer className="mt-3 border-t border-neutral-950 pt-2 text-[8px] text-neutral-600 text-center uppercase tracking-[0.2em] flex justify-between select-none">
                <span>실시간 전파 연동 고감도 셰어링 진행 중 // 별도 데이터베이스가 존재하지 않는 서버리스 프로토콜</span>
                <span>클라우드 게이트웨이 주소: 0.PEERJS.COM</span>
              </footer>

            </div>
          ) : (
            
            // ================== STUDENT / EXPLORER GAMEVIEW CANVAS ==================
            <div className="w-full h-screen relative">
              <GameCanvas
                currentPhase={GamePhase.PLAYING}
                onTransitionPhase={() => {}}
                onGameEnd={handleGameEnd}
                multiplayerConfig={{
                  roomId: roomState.id,
                  playerId: networkManager.myId,
                  initialRoom: roomState,
                  isP2PFallback: true // Pure P2P protocol sync mode
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* 4. EXPERIENCE ENDED / SIMULATION SUCCESSFULLY COMPLETED */}
      {phase === GamePhase.ENDING && (
        <div className="relative w-full h-screen flex flex-col justify-between p-8 text-[#cecece] font-mono animate-fade-in">
          <div className="absolute inset-0 bg-black opacity-[0.98] z-0" />

          <header className="w-full flex justify-between items-center z-10 border-b border-neutral-900 pb-3 text-[10px] text-neutral-500 tracking-widest uppercase">
            <div>TERMINATION//EXPEDITION_CLOSE // 복도 세션 강제 탈출 승인</div>
            <div className="flex items-center gap-4">
              <span className="text-emerald-500 font-bold flex items-center gap-1 leading-none text-emerald-500 uppercase">
                <ShieldCheck className="w-3.5 h-3.5" />
                지속 회로 데이터 무결성 복원됨
              </span>
            </div>
          </header>

          <main className="max-w-xl mx-auto flex-grow flex flex-col justify-center items-center text-center z-10">
            <div className="mb-4 text-emerald-500 text-[11px] tracking-[0.3em] uppercase animate-pulse">
              {success ? '복도 탐색 정상 승인 완료 // 생인 생환 회신됨' : '가상 동기회로 분열 // 접속 폭파 실패'}
            </div>

            <h1 className="text-2xl md:text-3xl font-black tracking-[0.18em] uppercase text-neutral-100 mb-8 font-mono">
              {success ? 'CORRIDOR_6_ESCAPED.BIN' : 'CONTRACT_ABORTED.BIN'}
            </h1>

            <div className="space-y-4 text-left border-l-2 border-neutral-800 pl-6 py-4 bg-neutral-950/50 rounded max-w-lg mb-10 w-full">
              <div className="text-[10px] text-neutral-500 tracking-widest uppercase font-bold">
                복구된 주파수 무결성 해독 구문 (0x02AA):
              </div>
              
              <p className="text-xs text-neutral-400 leading-relaxed font-sans mt-1">
                {success 
                  ? '"당신은 극적이고 기괴한 빛을 내뿜던 기억의 파편을 남김없이 회수해 내어 극도의 공포를 이겨내고 탈출에 완전히 성공하였습니다. 애초에 당신이 시작했던 출발지로 온전히 되돌아오지 않는 그 어떠한 회귀용 생인 경로는 이곳 미로에 존재하지 않았습니다."'
                  : '"무결성 텔레메트리 연동 스트림이 도중에 인가해제식 분열을 겪었거나, 어둠 속에서 마주한 기괴한 형체들에 마음의 빗장을 완전히 내어준 까닭에, 탐색 코드가 완성되기 전에 무모한 회로 차단 수순을 밟아 복도 내에서 실크 스레드 무결성 신호가 파기되고 말았습니다."'
                }
              </p>

              <blockquote className="text-[11px] font-mono text-neutral-550 border-t border-neutral-900 pt-3 italic leading-relaxed uppercase tracking-wider">
                "이 거대한 회로의 무서운 미로를 설계하고 조립한 진정한 지은이의 명칭을 영원의 방 내부에서 깨닫는 것만이, 궁극적인 탈착 생환의 유일한 열쇠이니라."
              </blockquote>
            </div>

            <button
              onClick={restartGame}
              className="px-8 py-3.5 bg-neutral-100 text-neutral-950 font-extrabold uppercase text-[11px] tracking-widest hover:bg-neutral-800 hover:text-neutral-100 border border-neutral-100 hover:border-neutral-800 transition-all cursor-pointer flex items-center gap-2 rounded shadow-2xl"
            >
              <RefreshCw className="w-4 h-4 animate-[spin_5s_linear_infinite]" />
              시스템 프로토콜 초기 구동 진입 (메뉴로 복귀)
            </button>
          </main>

          <footer className="w-full text-center text-[9px] text-neutral-600 tracking-[0.25em] pt-4 z-10 border-t border-neutral-900 uppercase">
            SAD_SATAN_STYLE 협동 탐사 사후 처리 시스템 완료 // 주파수 완벽 폐쇄 성공
          </footer>
        </div>
      )}

    </div>
  );
}
