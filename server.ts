import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;

app.use(express.json());

// In-memory storage for multiplayer lobbies
interface Player {
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

interface Shard {
  id: string;
  x: number;
  y: number;
}

interface Room {
  id: string;
  status: "lobby" | "playing" | "ended";
  players: { [id: string]: Player };
  gatheredShards: string[];
  shardPositions: Shard[];
  createdAt: number;
}

const rooms: { [id: string]: Room } = {};

// Hardcoded 5 coordinate points where Shards can be placed
// These should correspond to empty corridor cells in the MAP
const SHARD_SPOTS: { x: number; y: number }[] = [
  { x: 1.5, y: 13.5 },
  { x: 9.5, y: 3.5 },
  { x: 13.5, y: 11.5 },
  { x: 7.5, y: 19.5 },
  { x: 20.5, y: 11.5 },
  { x: 19.5, y: 2.5 },
  { x: 4.5, y: 16.5 },
  { x: 16.5, y: 19.5 },
];

function generateRoomCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  // Guarantee uniqueness
  return rooms[code] ? generateRoomCode() : code;
}

// REST Api Endpoints
// Create Room
app.post("/api/rooms", (req, res) => {
  const roomId = generateRoomCode();
  
  // Pick 5 random unique shard locations
  const shuffled = [...SHARD_SPOTS].sort(() => 0.5 - Math.random());
  const selectedShards: Shard[] = shuffled.slice(0, 5).map((spot, idx) => ({
    id: `shard_${idx}`,
    x: spot.x,
    y: spot.y
  }));

  const room: Room = {
    id: roomId,
    status: "lobby",
    players: {},
    gatheredShards: [],
    shardPositions: selectedShards,
    createdAt: Date.now(),
  };

  rooms[roomId] = room;
  res.json({ success: true, room });
});

// Join Room
app.post("/api/rooms/:roomId/join", (req, res) => {
  const { roomId } = req.params;
  const { username } = req.body;

  const code = roomId.toUpperCase();
  const room = rooms[code];

  if (!room) {
    return res.status(404).json({ success: false, error: "LOBBY_NOT_FOUND" });
  }

  if (room.status !== "lobby" && room.status !== "playing") {
    return res.status(400).json({ success: false, error: "GAME_ALREADY_FINISHED" });
  }

  const playerId = "p_" + Math.random().toString(36).substr(2, 9);
  const player: Player = {
    id: playerId,
    username: username || "Explorer",
    x: 1.5,
    y: 1.5,
    angle: 0.8,
    bob: 0,
    fear: 0,
    flashlightOn: true,
    screaming: false,
    screamerIndex: 0,
    escaped: false,
    lastSeen: Date.now(),
  };

  room.players[playerId] = player;

  res.json({ success: true, playerId, room });
});

// Get/Sync Room Game State
app.post("/api/rooms/:roomId/sync", (req, res) => {
  const { roomId } = req.params;
  const { playerId, x, y, angle, bob, fear, flashlightOn, screaming, screamerIndex, escaped } = req.body;

  const code = roomId.toUpperCase();
  const room = rooms[code];

  if (!room) {
    return res.status(404).json({ success: false, error: "LOBBY_NOT_FOUND" });
  }

  const player = room.players[playerId];
  if (player) {
    player.x = x !== undefined ? x : player.x;
    player.y = y !== undefined ? y : player.y;
    player.angle = angle !== undefined ? angle : player.angle;
    player.bob = bob !== undefined ? bob : player.bob;
    player.fear = fear !== undefined ? fear : player.fear;
    player.flashlightOn = flashlightOn !== undefined ? flashlightOn : player.flashlightOn;
    player.screaming = screaming !== undefined ? screaming : player.screaming;
    player.screamerIndex = screamerIndex !== undefined ? screamerIndex : player.screamerIndex;
    player.escaped = escaped !== undefined ? escaped : player.escaped;
    player.lastSeen = Date.now();
  }

  // Cleanup inactive players (no update for > 8 seconds)
  const now = Date.now();
  Object.keys(room.players).forEach((pId) => {
    if (now - room.players[pId].lastSeen > 8000) {
      delete room.players[pId];
    }
  });

  // Check if everyone escaped
  const playerList = Object.values(room.players);
  if (playerList.length > 0 && playerList.every((p) => p.escaped) && room.status === "playing") {
    room.status = "ended";
  }

  res.json({ success: true, room });
});

// Start Game
app.post("/api/rooms/:roomId/start", (req, res) => {
  const { roomId } = req.params;
  const code = roomId.toUpperCase();
  const room = rooms[code];

  if (!room) {
    return res.status(444).json({ success: false, error: "LOBBY_NOT_FOUND" });
  }

  room.status = "playing";
  res.json({ success: true, room });
});

// Claim Shard
app.post("/api/rooms/:roomId/claim-shard", (req, res) => {
  const { roomId } = req.params;
  const { shardId } = req.body;

  const code = roomId.toUpperCase();
  const room = rooms[code];

  if (!room) {
    return res.status(404).json({ success: false, error: "LOBBY_NOT_FOUND" });
  }

  if (!room.gatheredShards.includes(shardId)) {
    room.gatheredShards.push(shardId);
  }

  res.json({ success: true, room });
});

// Leave Lobby
app.post("/api/rooms/:roomId/leave", (req, res) => {
  const { roomId } = req.params;
  const { playerId } = req.body;

  const code = roomId.toUpperCase();
  const room = rooms[code];

  if (room && room.players[playerId]) {
    delete room.players[playerId];
  }

  res.json({ success: true });
});

// Periodic sweeping of empty or extremely stale rooms (> 2 hours)
setInterval(() => {
  const now = Date.now();
  Object.keys(rooms).forEach((code) => {
    const room = rooms[code];
    const isStale = now - room.createdAt > 7200000;
    const isEmpty = Object.keys(room.players).length === 0;
    if (isStale || (isEmpty && now - room.createdAt > 300000)) {
      delete rooms[code];
    }
  });
}, 60000);

// Integrate Vite Middleware
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
