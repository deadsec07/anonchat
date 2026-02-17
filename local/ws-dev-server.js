// Minimal local WebSocket server for UI testing only.
// Requires: npm install ws
const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 3001 });
console.log('Local WS dev server listening on ws://localhost:3001');

const rooms = new Map(); // roomId -> Set of sockets
const meta = new WeakMap(); // socket -> { roomId, alias }

function broadcast(roomId, payload) {
  const sockets = rooms.get(roomId);
  if (!sockets) return;
  const data = JSON.stringify(payload);
  for (const ws of sockets) {
    if (ws.readyState === WebSocket.OPEN) ws.send(data);
  }
}

wss.on('connection', (ws) => {
  meta.set(ws, {});
  ws.on('message', (raw) => {
    let msg = {};
    try { msg = JSON.parse(raw); } catch (_) {}
    const info = meta.get(ws) || {};

    if (msg.action === 'join') {
      const roomId = (msg.roomId || 'lobby').toString().slice(0, 64);
      const alias = (msg.alias || 'anon').toString().slice(0, 32);
      // remove from previous
      if (info.roomId && rooms.has(info.roomId)) rooms.get(info.roomId).delete(ws);
      // add to new
      if (!rooms.has(roomId)) rooms.set(roomId, new Set());
      rooms.get(roomId).add(ws);
      meta.set(ws, { roomId, alias });
      broadcast(roomId, { type: 'system', event: 'join', roomId, text: `${alias} joined`, ts: Date.now() });
      return;
    }

    if (msg.action === 'send') {
      if (!info.roomId) return;
      broadcast(info.roomId, { type: 'message', id: Date.now().toString(36), alias: info.alias || 'anon', roomId: info.roomId, text: (msg.text || '').toString(), ts: Date.now() });
      return;
    }
  });

  ws.on('close', () => {
    const info = meta.get(ws) || {};
    if (info.roomId && rooms.has(info.roomId)) rooms.get(info.roomId).delete(ws);
  });
});

