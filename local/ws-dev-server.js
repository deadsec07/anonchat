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
      let alias = (msg.alias || 'anon').toString().slice(0, 32);
      // remove from previous
      if (info.roomId && rooms.has(info.roomId)) rooms.get(info.roomId).delete(ws);
      // add to new
      if (!rooms.has(roomId)) rooms.set(roomId, new Set());
      // uniqueness best-effort
      const used = new Set();
      for (const s of rooms.get(roomId)) {
        const m = meta.get(s) || {};
        if (m.alias) used.add(m.alias.toString());
      }
      if (used.has(alias)) {
        const base = alias;
        for (let i = 2; i < 1000; i++) {
          const suffix = `-${i}`;
          const maxBase = 32 - suffix.length;
          const cand = (base.slice(0, Math.max(1, maxBase)) + suffix).slice(0, 32);
          if (!used.has(cand)) { alias = cand; break; }
        }
      }
      rooms.get(roomId).add(ws);
      meta.set(ws, { roomId, alias });
      const count = rooms.get(roomId).size;
      broadcast(roomId, { type: 'system', event: 'join', roomId, text: `${alias} joined`, count, ts: Date.now() });
      return;
    }

    if (msg.action === 'send') {
      if (!info.roomId) return;
      broadcast(info.roomId, { type: 'message', id: Date.now().toString(36), alias: info.alias || 'anon', roomId: info.roomId, text: (msg.text || '').toString(), ts: Date.now() });
      return;
    }

    if (msg.action === 'rooms') {
      const list = [];
      let total = 0;
      for (const [roomId, set] of rooms.entries()) {
        const count = Array.from(set).filter((s) => (meta.get(s) || {}).roomId === roomId).length;
        total += count;
        list.push({ roomId, count });
      }
      try { ws.send(JSON.stringify({ type: 'rooms', total, rooms: list, ts: Date.now() })); } catch (_) {}
      return;
    }
  });

  ws.on('close', () => {
    const info = meta.get(ws) || {};
    if (info.roomId && rooms.has(info.roomId)) rooms.get(info.roomId).delete(ws);
    const count = rooms.has(info.roomId) ? rooms.get(info.roomId).size : 0;
    broadcast(info.roomId, { type: 'system', event: 'leave', roomId: info.roomId, text: `${info.alias || 'anon'} left`, count, ts: Date.now() });
  });
});
