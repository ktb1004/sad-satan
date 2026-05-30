/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface PlayerState {
  x: number;
  y: number;
  angle: number; // in radians
  health: number;
  fear: number; // 0 to 1 scaling, drives screen distortion & heartbeat speed
  isMoving: boolean;
  stepsCount: number;
}

export enum GamePhase {
  MENU = 'MENU',
  INTRO = 'INTRO',
  PLAYING = 'PLAYING',
  GLITCH_SCREEN = 'GLITCH_SCREEN',
  ENDING = 'ENDING'
}

export interface HorrorCue {
  x: number;
  y: number;
  type: 'glitch' | 'whisper' | 'flash_face' | 'flash_figure' | 'heavy_rumble';
  triggered: boolean;
  cooldown?: number; // timestamp
}

export interface RaycastResult {
  distance: number;
  wallX: number; // position on wall for texture coordinate checking (0 to 1)
  textureId: number;
  side: 0 | 1; // 0 = vertical wall, 1 = horizontal wall
  cellX: number;
  cellY: number;
}

export interface MultiplayerPlayer {
  id: string;
  username: string;
  x: number;
  y: number;
  angle: number;
  bob: number;
  fear: number;
  flashlightOn: boolean;
  screaming: boolean;
  screamerIndex: number;
  escaped: boolean;
  lastSeen: number;
}

export interface Shard {
  id: string;
  x: number;
  y: number;
}

export interface MultiplayerRoom {
  id: string;
  status: 'lobby' | 'playing' | 'ended';
  players: { [id: string]: MultiplayerPlayer };
  gatheredShards: string[];
  shardPositions: Shard[];
}

