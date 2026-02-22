// Minimal local WebSocket server for UI testing only.
// Requires: npm install ws
const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 3001 });
console.log('Local WS dev server listening on ws://localhost:3001');

const rooms = new Map(); // roomId -> Set of sockets
const roomCodes = new Map(); // roomId -> code
const meta = new WeakMap(); // socket -> { roomId, alias, uniq }

function broadcast(roomId, payload) {
  const sockets = rooms.get(roomId);
  if (!sockets) return;
  const data = JSON.stringify(payload);
  for (const ws of sockets) {
    if (ws.readyState === WebSocket.OPEN) ws.send(data);
  }
}

wss.on('connection', (ws) => {
  const uniq = Math.random().toString(36).slice(2, 8);
  meta.set(ws, { uniq });
  ws.on('message', (raw) => {
    let msg = {};
    try { msg = JSON.parse(raw); } catch (_) {}
    const info = meta.get(ws) || {};

    if (msg.action === 'join') {
      const roomId = (msg.roomId || 'lobby').toString().slice(0, 64);
      let alias = (msg.alias || 'anon').toString().slice(0, 32);
      const code = (msg.code || '').toString().slice(0, 32);
      const quiet = !!msg.quiet;
      // Enforce code when room has one
      if (rooms.has(roomId) && roomCodes.has(roomId)) {
        if (!code || code !== roomCodes.get(roomId)) {
          try { ws.send(JSON.stringify({ type: 'system', event: 'error', roomId, text: 'Invalid room code', ts: Date.now() })); } catch (_) {}
          return;
        }
      }
      // remove from previous
      if (info.roomId && rooms.has(info.roomId)) rooms.get(info.roomId).delete(ws);
      // add to new
      if (!rooms.has(roomId)) rooms.set(roomId, new Set());
      if (!roomCodes.has(roomId) && code) roomCodes.set(roomId, code);
      // stable suffix per browser if provided; fallback to socket uniq
      let suffix = '';
      if (msg.clientId) {
        const clean = String(msg.clientId).replace(/[^a-zA-Z0-9]/g, '');
        suffix = `-${clean.slice(-6)}`;
      } else {
        suffix = `-${(info.uniq || 'xxxx').toString().slice(0,6)}`;
      }
      // Only add suffix if duplicate base alias already exists in room
      const sockets = rooms.get(roomId) || new Set();
      const hasExact = Array.from(sockets).some((s) => (meta.get(s) || {}).alias === alias);
      if (hasExact) {
        const maxBase = Math.max(1, 32 - suffix.length);
        alias = (alias.slice(0, maxBase) + suffix);
      }
      rooms.get(roomId).add(ws);
      meta.set(ws, { ...info, roomId, alias });
      const count = rooms.get(roomId).size;
      try { ws.send(JSON.stringify({ type: 'me', event: 'joined', roomId, alias, ts: Date.now() })); } catch (_) {}
      if (!quiet) broadcast(roomId, { type: 'system', event: 'join', roomId, text: `${alias} joined`, count, ts: Date.now() });
      return;
    }

    if (msg.action === 'send') {
      if (!info.roomId) return;
      const replyTo = msg.replyTo && typeof msg.replyTo === 'object' ? {
        id: String(msg.replyTo.id || '').slice(0, 64),
        alias: String(msg.replyTo.alias || '').slice(0, 64),
        text: String(msg.replyTo.text || '').slice(0, 256),
      } : undefined;
      const attachment = (msg.attachment && typeof msg.attachment === 'object') ? {
        name: String(msg.attachment.name || '').slice(0, 128),
        type: String(msg.attachment.type || '').slice(0, 64),
        size: Number(msg.attachment.size || 0),
        data: String(msg.attachment.data || '').slice(0, 160000),
      } : undefined;
      broadcast(info.roomId, { type: 'message', id: Date.now().toString(36), alias: info.alias || 'anon', roomId: info.roomId, text: (msg.text || '').toString(), replyTo, attachment, ts: Date.now() });
      return;
    }

    if (msg.action === 'dm') {
      if (!info.roomId) return;
      const to = (msg.to || '').toString();
      const sockets = rooms.get(info.roomId);
      if (!sockets) return;
      if (to && to === (info.alias || '')) {
        try { ws.send(JSON.stringify({ type: 'system', event: 'error', roomId: info.roomId, text: 'Cannot DM yourself', ts: Date.now() })); } catch (_) {}
        return;
      }
      const attachment = (msg.attachment && typeof msg.attachment === 'object') ? {
        name: String(msg.attachment.name || '').slice(0, 128),
        type: String(msg.attachment.type || '').slice(0, 64),
        size: Number(msg.attachment.size || 0),
        data: String(msg.attachment.data || '').slice(0, 160000),
      } : undefined;
      const payload = { type: 'dm', id: Date.now().toString(36), alias: info.alias || 'anon', roomId: info.roomId, to, text: (msg.text || '').toString(), attachment, ts: Date.now() };
      for (const s of sockets) {
        const m = meta.get(s) || {};
        if (s.readyState === WebSocket.OPEN && (m.alias === to || s === ws)) {
          try { s.send(JSON.stringify(payload)); } catch (_) {}
        }
      }
      return;
    }

    if (msg.action === 'who') {
      const sockets = rooms.get(info.roomId) || new Set();
      const users = [];
      for (const s of sockets) {
        const m = meta.get(s) || {};
        if (m.alias) users.push({ alias: m.alias.toString() });
      }
      try { ws.send(JSON.stringify({ type: 'who', roomId: info.roomId, users, ts: Date.now() })); } catch (_) {}
      return;
    }

    if (msg.action === 'typing') {
      const sockets = rooms.get(info.roomId) || new Set();
      const to = (msg.to || '').toString();
      if (!to) return; // DM-only typing
      const payload = { type: 'system', event: 'typing', roomId: info.roomId, alias: info.alias || 'anon', to, typing: !!msg.typing, ts: Date.now() };
      for (const s of sockets) {
        const m = meta.get(s) || {};
        if (s.readyState === WebSocket.OPEN && (m.alias === to)) {
          try { s.send(JSON.stringify(payload)); } catch (_) {}
        }
      }
      return;
    }

    if (msg.action === 'rooms') {
      const list = [];
      let total = 0;
      for (const [roomId, set] of rooms.entries()) {
        const count = Array.from(set).filter((s) => (meta.get(s) || {}).roomId === roomId).length;
        total += count;
        const isPrivate = roomCodes.has(roomId);
        list.push({ roomId, count, private: isPrivate });
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
    if (info.roomId && rooms.has(info.roomId) && rooms.get(info.roomId).size === 0) {
      rooms.delete(info.roomId);
      roomCodes.delete(info.roomId);
    }
  });
});
