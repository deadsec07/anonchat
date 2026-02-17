(function () {
  const $ = (id) => document.getElementById(id);
  const messagesEl = $('messages');
  const joinEl = $('join');
  const composerEl = $('composer');
  const roomEl = $('room');
  const aliasEl = $('alias');
  const inputEl = $('input');
  const sendBtn = $('send');
  const joinBtn = $('btnJoin');
  const statusEl = $('status');

  let ws = null;
  let joined = false;
  let room = '';
  let alias = '';

  function setStatus(text, color) {
    statusEl.textContent = text;
    statusEl.style.color = color || '';
  }

  function appendMessage(msg) {
    const li = document.createElement('li');
    if (msg.type === 'system') li.classList.add('system');
    const meta = document.createElement('div');
    meta.className = 'meta';
    const dt = new Date(msg.ts || Date.now());
    if (msg.type === 'message') {
      meta.textContent = `${msg.alias || 'anon'} · ${dt.toLocaleTimeString()}`;
    } else {
      meta.textContent = `${msg.event || 'info'} · ${dt.toLocaleTimeString()}`;
    }
    const text = document.createElement('div');
    text.textContent = msg.text || '';
    li.appendChild(meta);
    li.appendChild(text);
    messagesEl.appendChild(li);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function connectAndJoin() {
    if (!window.CONFIG || !window.CONFIG.wsUrl) {
      alert('Missing wsUrl in frontend/config.js');
      return;
    }
    setStatus('connecting…', '#fbbf24');
    ws = new WebSocket(window.CONFIG.wsUrl);
    ws.onopen = () => {
      setStatus('connected', '#22c55e');
      ws.send(JSON.stringify({ action: 'join', roomId: room, alias }));
      joined = true;
      joinEl.hidden = true;
      composerEl.hidden = false;
      inputEl.focus();
    };
    ws.onclose = () => {
      setStatus('disconnected', '#ef4444');
      joined = false;
      composerEl.hidden = true;
      joinEl.hidden = false;
    };
    ws.onerror = () => setStatus('error', '#ef4444');
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg && (msg.type === 'message' || msg.type === 'system')) {
          appendMessage(msg);
        }
      } catch (_) {}
    };
  }

  joinBtn.addEventListener('click', () => {
    room = (roomEl.value || 'lobby').trim().slice(0, 64);
    alias = (aliasEl.value || 'anon').trim().slice(0, 32);
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      connectAndJoin();
    }
  });

  sendBtn.addEventListener('click', () => {
    const text = inputEl.value.trim();
    if (!text || !ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ action: 'send', text }));
    inputEl.value = '';
  });

  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      sendBtn.click();
    }
  });

  // Seed from querystring
  try {
    const params = new URLSearchParams(location.search);
    const r = params.get('room');
    const a = params.get('alias');
    if (r) roomEl.value = r;
    if (a) aliasEl.value = a;
  } catch (_) {}
})();

