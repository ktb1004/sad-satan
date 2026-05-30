/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum GamePhase {
  MENU = 'MENU',
  INTRO = 'INTRO',
  LOBBY = 'LOBBY',
  PLAYING = 'PLAYING',
  GLITCH_SCREEN = 'GLITCH_SCREEN',
  ENDING = 'ENDING'
}

export enum UserRole {
  HOST = 'HOST',       // Teacher / Director
  CLIENT = 'CLIENT'    // Student / Explorer
}

export interface StudentState {
  id: string;
  username: string;
  x: number;
  y: number;
  angle: number;
  bob: number;
  fear: number;        // On-screen anxiety (0 to 100)
  flashlightOn: boolean;
  flashlightBattery: number; // 0 to 100
  screaming: boolean;
  screamerIndex: number;
  escaped: boolean;
  health: number;      // 0 to 100
  stepsCount: number;
  lastSeen: number;
}

export interface HorrorCue {
  x: number;
  y: number;
  type: 'glitch' | 'whisper' | 'flash_face' | 'flash_figure' | 'heavy_rumble';
  triggered: boolean;
}

export interface MemoryShard {
  id: string;
  x: number;
  y: number;
  claimedBy: string | null; // Id of student who found it
}

export interface GameRoomState {
  id: string;
  peers: { [playerId: string]: StudentState };
  shards: MemoryShard[];
  systemAnnouncement: string;
  hostId: string;
  status: 'lobby' | 'playing' | 'ended';
  timestamp: number;
}

export interface PeerMessage {
  type: 'handshake' | 'state_update' | 'host_state_broadcast' | 'trigger_jumpscare' | 'trigger_flicker' | 'system_shock' | 'claim_shard' | 'student_screamed' | 'start_game';
  senderId: string;
  senderName: string;
  payload: any;
}

// Aliases for compatibility with GameCanvas engine
export type MultiplayerRoom = GameRoomState;
export type MultiplayerPlayer = StudentState;
export type Shard = MemoryShard;
