/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Peer, DataConnection } from 'peerjs';
import { GameRoomState, StudentState, PeerMessage, UserRole, MemoryShard } from './types';

// Helper to generate unique guest/student ids
export function generateId(): string {
  return 'player_' + Math.random().toString(36).substring(2, 11);
}

// Generate coordinate-matched memory shards
export function generateRandomShards(): MemoryShard[] {
  const coordinates = [
    { x: 1.5, y: 13.5 },
    { x: 9.5, y: 3.5 },
    { x: 13.5, y: 11.5 },
    { x: 7.5, y: 19.5 },
    { x: 20.5, y: 11.5 },
    { x: 19.5, y: 2.5 },
    { x: 4.5, y: 16.5 },
    { x: 16.5, y: 19.5 }
  ];
  
  // Shuffle coordinates of potential spots
  const shuffled = [...coordinates].sort(() => 0.5 - Math.random());
  
  // Select 5 spots for shards
  return shuffled.slice(0, 5).map((pos, index) => ({
    id: `shard_${index}_${Math.floor(Math.random() * 1000)}`,
    x: pos.x,
    y: pos.y,
    claimedBy: null
  }));
}

export class P2PNetworkManager {
  public peer: Peer | null = null;
  public role: UserRole | null = null;
  public roomId: string = '';
  public myId: string = '';
  public username: string = '';
  
  // Host ONLY: connections to all students
  public connections: { [studentId: string]: DataConnection } = {};
  
  // Client ONLY: connection to teacher/host
  public hostConnection: DataConnection | null = null;

  // Real-time synchronization states
  public currentRoomState: GameRoomState = {
    id: '',
    peers: {},
    shards: [],
    systemAnnouncement: '',
    hostId: '',
    status: 'lobby',
    timestamp: Date.now()
  };

  // Event handlers
  private onStateUpdateCallback: (state: GameRoomState) => void = () => {};
  private onJumpscareReceivedCallback: () => void = () => {};
  private onFlickerReceivedCallback: () => void = () => {};
  private onStudentScreamedCallback: (studentName: string) => void = () => {};
  private onStartGameReceivedCallback: () => void = () => {};

  constructor() {}

  // Register callbacks
  public onStateUpdate(cb: (state: GameRoomState) => void) {
    this.onStateUpdateCallback = cb;
  }

  public onJumpscareReceived(cb: () => void) {
    this.onJumpscareReceivedCallback = cb;
  }

  public onFlickerReceived(cb: () => void) {
    this.onFlickerReceivedCallback = cb;
  }

  public onStudentScreamed(cb: (studentName: string) => void) {
    this.onStudentScreamedCallback = cb;
  }

  public onStartGameReceived(cb: () => void) {
    this.onStartGameReceivedCallback = cb;
  }

  // Get Peer ID string format
  private makePeerId(roomId: string, role: UserRole, extra?: string): string {
    const cleanRoom = roomId.trim().toUpperCase();
    if (role === UserRole.HOST) {
      return `sadsatan-${cleanRoom}-host`;
    }
    const cleanExtra = (extra || generateId()).replace(/[^a-zA-Z0-9]/g, '');
    return `sadsatan-${cleanRoom}-student-${cleanExtra}`;
  }

  /**
   * host (Teacher) initialization logic
   */
  public async initializeHost(roomId: string, username: string, onCreated: (id: string) => void, onError: (err: any) => void) {
    this.role = UserRole.HOST;
    this.roomId = roomId.trim().toUpperCase();
    this.username = username;
    this.myId = 'host_' + generateId();

    const registrationId = this.makePeerId(this.roomId, UserRole.HOST);

    try {
      // Connect to global standard PeerJS Cloud Signaling Server
      this.peer = new Peer(registrationId, {
        debug: 1
      });

      this.peer.on('open', (id) => {
        console.log(`[P2P] Host peer generated on signalling server: ${id}`);
        
        // Setup initial Host Room State
        this.currentRoomState = {
          id: this.roomId,
          peers: {},
          shards: generateRandomShards(),
          systemAnnouncement: 'SYSTEM ENCOUNTER INITIALIZED. WAITING FOR STUDENTS...',
          hostId: this.myId,
          status: 'lobby',
          timestamp: Date.now()
        };
        
        onCreated(this.roomId);
        this.onStateUpdateCallback(this.currentRoomState);
      });

      this.peer.on('error', (err) => {
        console.error('[P2P] Host Peer encountered signaling error:', err);
        onError(err);
      });

      // Handle direct inbound Student connections
      this.peer.on('connection', (conn) => {
        console.log(`[P2P] Direct student attempting co-op link: ${conn.peer}`);
        
        conn.on('open', () => {
          console.log(`[P2P] DataChannel opened with student: ${conn.peer}`);
        });

        conn.on('data', (rawMsg: any) => {
          const msg = rawMsg as PeerMessage;
          if (!msg || !msg.type) return;

          this.handleInboundHostMessage(conn, msg);
        });

        conn.on('close', () => {
          this.handleStudentDisconnect(conn);
        });

        conn.on('error', (err) => {
          console.error(`[P2P] Link error on student channel ${conn.peer}:`, err);
          this.handleStudentDisconnect(conn);
        });
      });

    } catch (e) {
      onError(e);
    }
  }

  /**
   * client (Student) initialization logic
   */
  public initializeClient(roomId: string, username: string, onJoined: () => void, onError: (errMessage: string) => void) {
    this.role = UserRole.CLIENT;
    this.roomId = roomId.trim().toUpperCase();
    this.username = username;
    this.myId = 'student_' + generateId();

    const registrationId = this.makePeerId(this.roomId, UserRole.CLIENT, this.username + '_' + Math.floor(Math.random() * 100));

    try {
      this.peer = new Peer(registrationId, {
        debug: 1
      });

      this.peer.on('open', (myRegId) => {
        console.log(`[P2P Client] Registering student: ${myRegId}`);
        const hostRegId = this.makePeerId(this.roomId, UserRole.HOST);
        
        console.log(`[P2P Client] Attempting handshake link with Host peer: ${hostRegId}`);
        const conn = this.peer!.connect(hostRegId);
        this.hostConnection = conn;

        conn.on('open', () => {
          console.log('[P2P Client] Co-op Link with Teacher active. Dispatching Handshake.');
          
          const handshakePayload: PeerMessage = {
            type: 'handshake',
            senderId: this.myId,
            senderName: this.username,
            payload: {
              x: 1.5,
              y: 1.5,
              angle: 0.8,
              bob: 0,
              fear: 0,
              flashlightOn: true,
              flashlightBattery: 100,
              screaming: false,
              screamerIndex: 0,
              escaped: false,
              health: 100,
              stepsCount: 0
            }
          };
          conn.send(handshakePayload);
          onJoined();
        });

        conn.on('data', (rawMsg: any) => {
          const msg = rawMsg as PeerMessage;
          if (!msg || !msg.type) return;

          this.handleInboundClientMessage(msg);
        });

        conn.on('close', () => {
          console.warn('[P2P Client] Connected Host has ended the simulation.');
          onError('Teacher Host ended the session, or connection timed out.');
        });

        conn.on('error', (err) => {
          console.error('[P2P Client] Conn error with Teacher: ', err);
          onError('Could not establish connection to Room ' + this.roomId);
        });
      });

      this.peer.on('error', (err) => {
        console.error('[P2P Client] Signalling register error:', err);
        onError('Signaling server unavailable.');
      });

    } catch (e: any) {
      onError(e.message || 'P2P setup error');
    }
  }

  /**
   * Host processes inbound student message
   */
  private handleInboundHostMessage(conn: DataConnection, msg: PeerMessage) {
    const studentId = msg.senderId;

    if (msg.type === 'handshake') {
      console.log(`[P2P Host] Handshake recorded from student: ${msg.senderName} (${studentId})`);
      this.connections[studentId] = conn;
      
      const initialStudent: StudentState = {
        id: studentId,
        username: msg.senderName,
        x: msg.payload?.x ?? 1.5,
        y: msg.payload?.y ?? 1.5,
        angle: msg.payload?.angle ?? 0.8,
        bob: 0,
        fear: msg.payload?.fear ?? 0,
        flashlightOn: msg.payload?.flashlightOn ?? true,
        flashlightBattery: msg.payload?.flashlightBattery ?? 100,
        screaming: false,
        screamerIndex: 0,
        escaped: false,
        health: 100,
        stepsCount: 0,
        lastSeen: Date.now()
      };

      this.currentRoomState.peers[studentId] = initialStudent;
      this.currentRoomState.timestamp = Date.now();
      
      this.broadcastToAllClients();
      this.onStateUpdateCallback(this.currentRoomState);
    } 
    else if (msg.type === 'state_update') {
      const student = this.currentRoomState.peers[studentId];
      if (student) {
        if (msg.payload.x !== undefined) student.x = msg.payload.x;
        if (msg.payload.y !== undefined) student.y = msg.payload.y;
        if (msg.payload.angle !== undefined) student.angle = msg.payload.angle;
        if (msg.payload.bob !== undefined) student.bob = msg.payload.bob;
        if (msg.payload.fear !== undefined) student.fear = msg.payload.fear;
        if (msg.payload.flashlightOn !== undefined) student.flashlightOn = msg.payload.flashlightOn;
        if (msg.payload.flashlightBattery !== undefined) student.flashlightBattery = msg.payload.flashlightBattery;
        if (msg.payload.screaming !== undefined) student.screaming = msg.payload.screaming;
        if (msg.payload.screamerIndex !== undefined) student.screamerIndex = msg.payload.screamerIndex;
        if (msg.payload.escaped !== undefined) student.escaped = msg.payload.escaped;
        if (msg.payload.health !== undefined) student.health = msg.payload.health;
        if (msg.payload.stepsCount !== undefined) student.stepsCount = msg.payload.stepsCount;
        student.lastSeen = Date.now();

        this.currentRoomState.timestamp = Date.now();
        this.broadcastToAllClients();
        this.onStateUpdateCallback(this.currentRoomState);
      }
    } 
    else if (msg.type === 'claim_shard') {
      const shardId = msg.payload.shardId;
      const shardIndex = this.currentRoomState.shards.findIndex(s => s.id === shardId);
      if (shardIndex !== -1 && this.currentRoomState.shards[shardIndex].claimedBy === null) {
        this.currentRoomState.shards[shardIndex].claimedBy = studentId;
        this.currentRoomState.systemAnnouncement = `STUDENT '${msg.senderName.toUpperCase()}' RECLAIMED A MEMORY SHARD!`;
        this.currentRoomState.timestamp = Date.now();
        
        this.broadcastToAllClients();
        this.onStateUpdateCallback(this.currentRoomState);
      }
    }
    else if (msg.type === 'student_screamed') {
      console.log(`[P2P Host] student screamed: ${msg.senderName}`);
      this.onStudentScreamedCallback(msg.senderName);
      
      // Propagate scream to other clients
      const screamRelay: PeerMessage = {
        type: 'student_screamed',
        senderId: studentId,
        senderName: msg.senderName,
        payload: { screamerIndex: msg.payload?.screamerIndex || 0 }
      };

      Object.entries(this.connections).forEach(([sId, otherConn]) => {
        if (sId !== studentId && otherConn.open) {
          otherConn.send(screamRelay);
        }
      });
    }
  }

  /**
   * Client processes inbound teacher/broadcast message
   */
  private handleInboundClientMessage(msg: PeerMessage) {
    if (msg.type === 'host_state_broadcast') {
      this.currentRoomState = msg.payload as GameRoomState;
      this.onStateUpdateCallback(this.currentRoomState);
    } 
    else if (msg.type === 'trigger_jumpscare') {
      console.log('[P2P Client] Teacher triggered manual JUMPSCARE!');
      this.onJumpscareReceivedCallback();
    } 
    else if (msg.type === 'trigger_flicker') {
      console.log('[P2P Client] Teacher triggered FLASHLIGHT FLICKER!');
      this.onFlickerReceivedCallback();
    } 
    else if (msg.type === 'student_screamed') {
      this.onStudentScreamedCallback(msg.senderName);
    } 
    else if (msg.type === 'start_game') {
      this.onStartGameReceivedCallback();
    }
  }

  /**
   * Student disconnect handling on Host
   */
  private handleStudentDisconnect(conn: DataConnection) {
    // Find who disconnected
    const disconnectedEntry = Object.entries(this.connections).find(([_, c]) => c === conn);
    if (disconnectedEntry) {
      const studentId = disconnectedEntry[0];
      const studentName = this.currentRoomState.peers[studentId]?.username || 'Student';
      console.log(`[P2P Host] Student disconnected: ${studentName}`);
      
      delete this.connections[studentId];
      delete this.currentRoomState.peers[studentId];
      this.currentRoomState.systemAnnouncement = `${studentName.toUpperCase()} LOST TELEMETRY CONNECTION.`;
      this.currentRoomState.timestamp = Date.now();
      
      this.broadcastToAllClients();
      this.onStateUpdateCallback(this.currentRoomState);
    }
  }

  /**
   * Client send metrics updates to Host
   */
  public sendUpdateFromClient(payload: Partial<StudentState>) {
    if (this.role !== UserRole.CLIENT || !this.hostConnection || !this.hostConnection.open) return;

    const statePayload: PeerMessage = {
      type: 'state_update',
      senderId: this.myId,
      senderName: this.username,
      payload: payload
    };
    this.hostConnection.send(statePayload);
  }

  /**
   * Client send claim request for a Shard
   */
  public claimShardFromClient(shardId: string) {
    if (this.role !== UserRole.CLIENT || !this.hostConnection || !this.hostConnection.open) return;

    const claimPayload: PeerMessage = {
      type: 'claim_shard',
      senderId: this.myId,
      senderName: this.username,
      payload: { shardId }
    };
    this.hostConnection.send(claimPayload);
  }

  /**
   * Client trigger screamer event and broadcast panic alert to direct peers (host, etc)
   */
  public triggerScreamFromClient(screamerIdx: number) {
    if (this.role !== UserRole.CLIENT || !this.hostConnection || !this.hostConnection.open) return;

    const panicPayload: PeerMessage = {
      type: 'student_screamed',
      senderId: this.myId,
      senderName: this.username,
      payload: { screamerIndex: screamerIdx }
    };
    this.hostConnection.send(panicPayload);
  }

  /**
   * Host starts the active exploration module
   */
  public launchExpeditionFromHost() {
    if (this.role !== UserRole.HOST) return;

    this.currentRoomState.status = 'playing';
    this.currentRoomState.systemAnnouncement = 'EXPEDITION LAUNCHED. SECURE THE EXCAVATION AREAS.';
    this.currentRoomState.timestamp = Date.now();

    const startPayload: PeerMessage = {
      type: 'start_game',
      senderId: this.myId,
      senderName: this.username,
      payload: {}
    };

    Object.values(this.connections).forEach((conn) => {
      if (conn.open) conn.send(startPayload);
    });

    this.broadcastToAllClients();
    this.onStateUpdateCallback(this.currentRoomState);
  }

  /**
   * Host triggers targeted interaction onto a selected Student
   */
  public hostInteractWithStudent(studentId: string, type: 'jumpscare' | 'flicker') {
    if (this.role !== UserRole.HOST) return;

    const conn = this.connections[studentId];
    if (conn && conn.open) {
      console.log(`[P2P Host] Sending manual custom horror ${type} to: ${studentId}`);
      
      const payload: PeerMessage = {
        type: type === 'jumpscare' ? 'trigger_jumpscare' : 'trigger_flicker',
        senderId: this.myId,
        senderName: this.username,
        payload: {}
      };
      
      conn.send(payload);

      // Log manual interaction
      const studentName = this.currentRoomState.peers[studentId]?.username || 'Student';
      this.currentRoomState.systemAnnouncement = `MANUAL INTENSITY INDUCTION ON '${studentName.toUpperCase()}' - ${type.toUpperCase()}`;
      this.currentRoomState.timestamp = Date.now();
      this.broadcastToAllClients();
      this.onStateUpdateCallback(this.currentRoomState);
    }
  }

  /**
   * Host issues a custom glitched broadcast text to all الطلاب
   */
  public hostBroadcastSystemWarning(text: string) {
    if (this.role !== UserRole.HOST) return;

    this.currentRoomState.systemAnnouncement = text.toUpperCase();
    this.currentRoomState.timestamp = Date.now();
    this.broadcastToAllClients();
    this.onStateUpdateCallback(this.currentRoomState);
  }

  /**
   * Host dynamic custom shard spawner
   */
  public hostSpawnShardNearStudent(studentId: string) {
    if (this.role !== UserRole.HOST) return;

    const student = this.currentRoomState.peers[studentId];
    if (!student) return;

    // Place shard coordinates slightly off student current location in a nearby cell
    const shardX = Math.max(1, Math.min(22, Math.floor(student.x) + (Math.random() > 0.5 ? 1.5 : -1.5)));
    const shardY = Math.max(1, Math.min(22, Math.floor(student.y) + (Math.random() > 0.5 ? 1.5 : -1.5)));

    const newShard: MemoryShard = {
      id: `shard_spawned_${Math.floor(Math.random() * 10000)}`,
      x: shardX,
      y: shardY,
      claimedBy: null
    };

    this.currentRoomState.shards.push(newShard);
    this.currentRoomState.systemAnnouncement = 'ANOMALY DETECTED. DIRECT RECORDING SHARD MANIFESTED!';
    this.currentRoomState.timestamp = Date.now();
    this.broadcastToAllClients();
    this.onStateUpdateCallback(this.currentRoomState);
  }

  private broadcastToAllClients() {
    const broadcastMsg: PeerMessage = {
      type: 'host_state_broadcast',
      senderId: this.myId,
      senderName: this.username,
      payload: this.currentRoomState
    };

    Object.values(this.connections).forEach((conn) => {
      if (conn.open) {
        conn.send(broadcastMsg);
      }
    });
  }

  public cleanup() {
    console.log('[P2P] Disposing P2P Manager connections.');
    
    // Close student connections
    Object.values(this.connections).forEach((conn) => {
      try { conn.close(); } catch (_) {}
    });
    this.connections = {};

    // Close client-to-host connection
    if (this.hostConnection) {
      try { this.hostConnection.close(); } catch (_) {}
      this.hostConnection = null;
    }

    // Destroy signaling peer instances
    if (this.peer) {
      try { this.peer.destroy(); } catch (_) {}
      this.peer = null;
    }
  }
}

// Global active instance accessor for Canvas & Lobbies
export const networkManager = new P2PNetworkManager();
