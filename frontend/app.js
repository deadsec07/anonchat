(function () {
  const $ = (id) => document.getElementById(id);
  // Migrate old hash route (#join) to /chat
  try {
    if ((location.hash || '').toLowerCase() === '#join') {
      const qs = location.search || '';
      history.replaceState(null, '', '/chat' + qs);
    }
  } catch (_) {}

  // Panel visibility helpers to prevent overlap
  function isVisible(el) { try { return el && !el.hidden && el.style.display !== 'none'; } catch (_) { return false; } }
  function hidePanel(el) { try { if (!el) return; el.hidden = true; el.style.display = 'none'; } catch (_) {} }
  function showPanel(el) { try { if (!el) return; el.hidden = false; el.style.display = ''; } catch (_) {} }
  function hideAllPanels() { hidePanel(roomsPanel); hidePanel(usersPanel); hidePanel(dmsPanel); hideDmThread(); }
  function openRoomsPanel() { hideAllPanels(); showPanel(roomsPanel); }
  function openUsersPanel() { hideAllPanels(); showPanel(usersPanel); }
  const appShell = $('appShell');
  const messagesEl = $('messages');
  const joinEl = $('join');
  const composerEl = $('composer');
  const roomEl = $('room');
  const aliasEl = $('alias');
  const inputEl = $('input');
  const sendBtn = $('send');
  const joinBtn = $('btnJoin');
  const copyBtn = $('btnCopyLink');
  const roomsBtn = $('btnRooms');
  const roomsHdrBtn = $('btnRoomsHdr');
  const usersHdrBtn = document.getElementById('btnUsersHdr');
  const btnJoinLobbyHdr = document.getElementById('btnJoinLobby');
  const btnRoomSettings = document.getElementById('btnRoomSettings');
  const roomsPanel = $('roomsPanel');
  const roomsList = $('roomsList');
  const roomsRefresh = $('btnRoomsRefresh');
  const roomsClose = $('btnRoomsClose');
  const usersPanel = document.getElementById('usersPanel');
  const usersList = document.getElementById('usersList');
  const usersRefresh = document.getElementById('btnUsersRefresh');
  const usersClose = document.getElementById('btnUsersClose');
  const dmsHdrBtn = document.getElementById('btnDmsHdr');
  const dmsPanel = document.getElementById('dmsPanel');
  const dmsList = document.getElementById('dmsList');
  const dmsClose = document.getElementById('btnDmsClose');
  const dmThreadPanel = document.getElementById('dmThreadPanel');
  const dmThreadTitle = document.getElementById('dmThreadTitle');
  const dmThreadList = document.getElementById('dmThreadList');
  const dmThreadClose = document.getElementById('btnDmThreadClose');
  const dmThreadSelect = document.getElementById('dmThreadSelect');
  const dmTypingStatus = document.getElementById('dmTypingStatus');
  const dmInput = document.getElementById('dmInput');
  const dmSend = document.getElementById('btnDmSend');
  const dmThreadBack = document.getElementById('btnDmThreadBack');
  const dmEncryptToggle = null; // deprecated toggle; use modal button instead
  const btnDmSetKey = document.getElementById('btnDmSetKey');
  const dmKeyOverlay = document.getElementById('dmKeyOverlay');
  const dmKeyPartner = document.getElementById('dmKeyPartner');
  const dmKeyInput = document.getElementById('dmKeyInput');
  const btnDmKeySave = document.getElementById('btnDmKeySave');
  const btnDmKeyCancel = document.getElementById('btnDmKeyCancel');
  const btnDmKeyClose = document.getElementById('btnDmKeyClose');
  const btnAttach = document.getElementById('btnAttach');
  const fileAttach = document.getElementById('fileAttach');
  const attachPreview = document.getElementById('attachPreview');
  const attachPreviewImg = document.getElementById('attachPreviewImg');
  const attachPreviewRemove = document.getElementById('attachPreviewRemove');
  const attachPreviewProg = document.getElementById('attachPreviewProg');
  const attachPreviewRetry = document.getElementById('attachPreviewRetry');
  const attachPreviewOk = document.getElementById('attachPreviewOk');
  const btnDmAttach = document.getElementById('btnDmAttach');
  const dmFileAttach = document.getElementById('dmFileAttach');
  const dmAttachPreview = document.getElementById('dmAttachPreview');
  const dmAttachPreviewImg = document.getElementById('dmAttachPreviewImg');
  const dmAttachPreviewRemove = document.getElementById('dmAttachPreviewRemove');
  const dmAttachPreviewProg = document.getElementById('dmAttachPreviewProg');
  const dmAttachPreviewRetry = document.getElementById('dmAttachPreviewRetry');
  const dmAttachPreviewOk = document.getElementById('dmAttachPreviewOk');
  const typingStatus = document.getElementById('typingStatus');
  const newMsgBadge = document.getElementById('newMsgBadge');
  const btnEditAlias = $('btnEditAlias');
  const dmBar = document.getElementById('dmBar');
  const dmTargetLabel = document.getElementById('dmTargetLabel');
  const btnDmClear = document.getElementById('btnDmClear');
  const btnReconnect = document.getElementById('btnReconnect');
  const replyBar = document.getElementById('replyBar');
  const replyToLabel = document.getElementById('replyToLabel');
  const replyToExcerpt = document.getElementById('replyToExcerpt');
  const btnReplyClear = document.getElementById('btnReplyClear');
  const mentionBox = document.getElementById('mentionBox');
  const mentionList = document.getElementById('mentionList');
  const loginOverlay = $('loginOverlay');
  const loginRoom = $('loginRoom');
  const loginAlias = $('loginAlias');
  const loginPrivate = document.getElementById('loginPrivate');
  const loginCode = document.getElementById('loginCode');
  const btnGenCode = document.getElementById('btnGenCode');
  const btnLogin = $('btnLogin');
  const btnLoginLobby = document.getElementById('btnLoginLobby');
  const btnLogout = $('btnLogout');
  const btnLoginClose = document.getElementById('btnLoginClose');
  const loginLoading = document.getElementById('loginLoading');
  const rememberSession = $('rememberSession');
  const statusEl = $('status');
  const loginError = $('loginError');
  const currentRoomEl = $('currentRoom');
  const landingEl = document.getElementById('landing');
  const aliasOverlay = document.getElementById('aliasOverlay');
  const newAliasInput = document.getElementById('newAliasInput');
  const btnAliasSave = document.getElementById('btnAliasSave');
  const btnAliasCancel = document.getElementById('btnAliasCancel');
  const aliasError = document.getElementById('aliasError');
  
  let myRoomCode = '';
  let myAliasServer = '';

  let ws = null;
  let joined = false;
  let room = '';
  let alias = '';
  let members = 0;
  const MAX_LOCAL = 200;
  let stickToBottom = true;
  let dmTarget = null; // alias (with suffix)
  let usersInRoom = [];
  let mentionOpen = false;
  let mentionIdx = -1;
  let mentionQuery = '';
  let mentionStart = -1;
  const typingPeers = new Map(); // alias -> expiresAt
  let lastTypingSent = 0;
  let newMsgCount = 0;
  let replyRef = null;
  const dmThreads = new Map();
  const dmUnread = new Map();
  let dmTotalUnread = 0;
  let pendingAttachment = null; // {name,type,size,data}
  let pendingDmAttachment = null;
  let lastAttachFile = null;
  let lastDmAttachFile = null;
  const dmKeys = new Map(); // alias -> CryptoKey
  function reflectDmEncryptState(partner) {
    try {
      if (!btnDmSetKey) return;
      const name = partner || dmTarget || (dmThreadSelect && dmThreadSelect.value) || '';
      const on = !!(name && dmKeys.get(name));
      btnDmSetKey.textContent = on ? 'Encrypt: ON' : 'Encrypt';
      btnDmSetKey.classList.remove('bg-slate-800/80','border-slate-700','text-slate-200','bg-emerald-600','border-emerald-400','text-slate-900');
      if (on) {
        btnDmSetKey.classList.add('bg-emerald-600','border-emerald-400','text-slate-900');
      } else {
        btnDmSetKey.classList.add('bg-slate-800/80','border-slate-700','text-slate-200');
      }
    } catch (_) {}
  }

  // Idle auto-disconnect to reduce WS minutes
  const IDLE_MS = 5 * 60 * 1000; // 5 minutes; adjust via code if needed
  let idleTimer = null;
  let lastActivity = Date.now();
  let idleClosed = false;
  let lastReconnectAttempt = 0;

  function isWsOpen() { try { return ws && ws.readyState === WebSocket.OPEN; } catch (_) { return false; } }
  function showReconnectButton() { if (btnReconnect) { btnReconnect.hidden = false; btnReconnect.style.display = ''; } }
  function hideReconnectButton() { if (btnReconnect) { btnReconnect.hidden = true; btnReconnect.style.display = 'none'; } }
  function markActivity() {
    lastActivity = Date.now();
    if (idleClosed && !isWsOpen() && room && alias) {
      const now = Date.now();
      if (now - lastReconnectAttempt > 2000) {
        lastReconnectAttempt = now;
        try { connectAndJoin(); } catch (_) {}
      }
    }
    scheduleIdleCheck();
  }
  function scheduleIdleCheck() {
    try { if (idleTimer) clearTimeout(idleTimer); } catch (_) {}
    idleTimer = setTimeout(() => {
      try {
        const now = Date.now();
        const idle = now - lastActivity >= IDLE_MS;
        if (idle && isWsOpen()) {
          idleClosed = true;
          try { ws.close(); } catch (_) {}
          showReconnectButton();
          return;
        }
      } catch (_) {}
      scheduleIdleCheck();
    }, IDLE_MS);
  }

  function setDmTarget(name) {
    dmTarget = name || null;
    if (dmTargetLabel) dmTargetLabel.textContent = dmTarget || '';
    if (dmBar) { dmBar.hidden = !dmTarget; dmBar.style.display = dmTarget ? '' : 'none'; }
    inputEl.placeholder = dmTarget ? `DM to ${dmTarget}` : 'Type a message';
    try { typingPeers.clear(); } catch (_) {}
    updateTypingStatus();
    reflectDmEncryptState(name);
  }

  function myAliasWithSuffix() {
    if (myAliasServer) return String(myAliasServer);
    const cid = (getClientId() || '').toString().replace(/[^a-zA-Z0-9]/g, '');
    const suff = cid ? `-${cid.slice(-6)}` : '';
    const max = Math.max(1, 32 - suff.length);
    return (alias || 'anon').slice(0, max) + suff;
  }

  function isLocalWs() {
    try { return /^ws:\/\/(localhost|127\.0\.0\.1)/.test(String(window.CONFIG && window.CONFIG.wsUrl || '')); } catch (_) { return false; }
  }

  function hideComposerBanners() {
    if (dmBar) { dmBar.hidden = true; dmBar.style.display = 'none'; }
    if (replyBar) { replyBar.hidden = true; replyBar.style.display = 'none'; }
    inputEl.placeholder = 'Type a message';
  }

  function updateDmsButton() {
    if (!dmsHdrBtn) return;
    const has = dmTotalUnread > 0;
    dmsHdrBtn.textContent = has ? `DMs (${dmTotalUnread})` : 'DMs';
    if (has) dmsHdrBtn.classList.add('attn'); else dmsHdrBtn.classList.remove('attn');
  }

  function ensureThread(name) {
    if (!dmThreads.has(name)) dmThreads.set(name, []);
    return dmThreads.get(name);
  }

  function openDmsPanel() {
    if (!dmsPanel || !dmsList) return;
    hideAllPanels();
    dmsList.innerHTML = '';
    const items = Array.from(dmThreads.keys());
    if (!items.length) {
      const li = document.createElement('li');
      li.className = 'py-2 px-2 text-slate-400';
      li.textContent = 'No conversations yet';
      dmsList.appendChild(li);
    } else {
      for (const name of items) {
        const li = document.createElement('li');
        li.className = 'py-2 flex items-center justify-between gap-2 px-2 cursor-pointer hover:bg-slate-800/50 rounded';
        const left = document.createElement('div');
        left.textContent = name;
        const right = document.createElement('div');
        right.className = 'text-slate-400 text-xs';
        const unread = dmUnread.get(name) || 0;
        right.textContent = unread ? `${unread}` : '';
        li.appendChild(left);
        li.appendChild(right);
        li.addEventListener('click', () => {
          setDmTarget(name);
          openDmThread(name);
          dmsPanel.hidden = true;
        });
        dmsList.appendChild(li);
      }
    }
    showPanel(dmsPanel);
  }

  function updateDmThreadSelect(current) {
    if (!dmThreadSelect) return;
    const items = Array.from(dmThreads.keys());
    dmThreadSelect.innerHTML = '';
    for (const name of items) {
      const opt = document.createElement('option');
      opt.value = name; opt.textContent = name + ((dmUnread.get(name) || 0) ? ` (${dmUnread.get(name)})` : '');
      if (name === current) opt.selected = true;
      dmThreadSelect.appendChild(opt);
    }
  }

  function renderDmMessageItem(msg) {
    const li = document.createElement('li');
    li.className = 'py-2 px-2';
    const meta = document.createElement('div');
    meta.className = 'text-xs text-slate-400 mb-0.5';
    const dt = new Date(msg.ts || Date.now());
    meta.textContent = `${msg.alias || 'anon'} · ${dt.toLocaleTimeString()}`;
    const text = document.createElement('div');
    try {
      const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      text.innerHTML = esc((msg.text || '').toString());
    } catch (_) { text.textContent = msg.text || ''; }
    li.appendChild(meta);
    li.appendChild(text);
    if (msg.attachment && (msg.attachment.data || msg.attachment.url)) {
      const a = msg.attachment;
      const wrap = document.createElement('div');
      wrap.className = 'attachment';
      if (a.type && a.type.startsWith('image/') && (a.data || a.url)) {
        const img = document.createElement('img');
        img.src = a.data || a.url;
        img.alt = a.name || '';
        wrap.appendChild(img);
      } else if (a.data || a.url) {
        const link = document.createElement('a');
        link.href = a.data || a.url;
        link.download = a.name || 'attachment';
        link.textContent = a.name ? `Download ${a.name}` : 'Download attachment';
        link.className = 'underline text-slate-300';
        wrap.appendChild(link);
      }
      li.appendChild(wrap);
    }
    return li;
  }

  function openDmThread(name) {
    if (!dmThreadPanel || !dmThreadList || !dmThreadTitle) return;
    try { if (roomsPanel) roomsPanel.hidden = true; if (usersPanel) usersPanel.hidden = true; } catch (_) {}
    dmThreadTitle.textContent = name;
    dmThreadList.innerHTML = '';
    const thread = ensureThread(name);
    for (const m of thread.slice(-200)) dmThreadList.appendChild(renderDmMessageItem(m));
    dmThreadPanel.hidden = false;
    dmThreadPanel.style.display = '';
    updateDmThreadSelect(name);
    hideComposerBanners();
    const prev = dmUnread.get(name) || 0;
    if (prev) {
      dmTotalUnread -= prev;
      dmUnread.set(name, 0);
      updateDmsButton();
    }
    reflectDmEncryptState(name);
  }

  function hideDmThread() {
    if (!dmThreadPanel) return;
    dmThreadPanel.hidden = true;
    dmThreadPanel.style.display = 'none';
  }
  function hideDmsPanel() {
    if (!dmsPanel) return;
    dmsPanel.hidden = true;
    dmsPanel.style.display = 'none';
  }

  function openMention(items) {
    if (!mentionBox || !mentionList) return;
    mentionList.innerHTML = '';
    items.forEach((name, i) => {
      const li = document.createElement('li');
      li.className = i === mentionIdx ? 'active' : '';
      const left = document.createElement('div');
      left.textContent = name;
      const btn = document.createElement('button');
      btn.className = 'text-xs rounded bg-slate-800/70 hover:bg-slate-800 border border-slate-700 px-2 py-0.5 text-slate-200';
      btn.textContent = 'DM';
      btn.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        setDmTarget(name);
        openDmThread(name);
        inputEl.focus();
        closeMention();
      });
      li.appendChild(left);
      li.appendChild(btn);
      li.addEventListener('mouseenter', () => { mentionIdx = i; reflectMentionActive(); });
      li.addEventListener('click', () => chooseMention(name));
      mentionList.appendChild(li);
    });
    mentionBox.hidden = items.length === 0;
    mentionOpen = items.length > 0;
  }

  function reflectMentionActive() {
    if (!mentionList) return;
    const lis = mentionList.querySelectorAll('li');
    lis.forEach((li, i) => {
      if (i === mentionIdx) li.classList.add('active'); else li.classList.remove('active');
    });
  }

  function closeMention() {
    if (!mentionBox) return;
    mentionOpen = false;
    mentionIdx = -1;
    mentionQuery = '';
    mentionStart = -1;
    mentionBox.hidden = true;
    if (mentionList) mentionList.innerHTML = '';
  }

  function chooseMention(name) {
    if (mentionStart < 0) return closeMention();
    const v = inputEl.value;
    const pos = inputEl.selectionStart || v.length;
    const before = v.slice(0, mentionStart);
    const after = v.slice(pos);
    const inserted = `@${name} `;
    inputEl.value = before + inserted + after;
    const newPos = (before + inserted).length;
    try { inputEl.setSelectionRange(newPos, newPos); } catch (_) {}
    closeMention();
    inputEl.focus();
  }

  function onMentionInput() {
    try {
      const v = inputEl.value;
      const pos = inputEl.selectionStart || v.length;
      const upto = v.slice(0, pos);
      const m = upto.match(/(^|\s)@([a-zA-Z0-9-]{0,32})$/);
      if (!m) { closeMention(); return; }
      mentionStart = pos - (m[2] ? m[2].length + 1 : 1);
      mentionQuery = (m[2] || '').toString();
      const mine = myAliasWithSuffix();
      const q = mentionQuery.toLowerCase();
      const items = (usersInRoom || [])
        .filter((n) => n && n !== mine && n.toLowerCase().startsWith(q))
        .slice(0, 8);
      mentionIdx = items.length ? 0 : -1;
      openMention(items);
    } catch (_) { closeMention(); }
  }

  function atPageBottom(threshold = 32) {
    try {
      const pos = (window.scrollY || window.pageYOffset || 0) + window.innerHeight;
      const height = document.documentElement.scrollHeight || document.body.scrollHeight;
      return height - pos <= threshold;
    } catch (_) { return true; }
  }

  function scrollToBottom(force = false) {
    if (!force && !stickToBottom) return;
    try { messagesEl.scrollTop = messagesEl.scrollHeight; } catch (_) {}
    try { window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'auto' }); } catch (_) {}
  }

  window.addEventListener('scroll', () => {
    stickToBottom = atPageBottom();
    if (stickToBottom) resetNewMsgBadge();
  });

  function hideOverlay() {
    const el = document.getElementById('loginOverlay');
    if (el) { el.hidden = true; el.style.display = 'none'; }
  }

  function showOverlay() {
    const el = document.getElementById('loginOverlay');
    if (el) { el.hidden = false; el.style.display = ''; }
  }

  function showApp() {
    if (appShell) { appShell.hidden = false; appShell.style.display = ''; }
  }
  function hideApp() {
    if (appShell) { appShell.hidden = true; appShell.style.display = 'none'; }
  }
  function showLanding() {
    if (landingEl) { landingEl.hidden = false; landingEl.style.display = ''; }
  }
  function hideLanding() {
    if (landingEl) { landingEl.hidden = true; landingEl.style.display = 'none'; }
  }

  // PWA: register service worker and setup push if VAPID key is provided
  async function setupPwaAndPush() {
    try {
      if ('serviceWorker' in navigator) {
        await navigator.serviceWorker.register('./sw.js');
      }
      const vapid = window.CONFIG && window.CONFIG.vapidPublicKey;
      if (!vapid || !('PushManager' in window) || !navigator.serviceWorker) return;
      const reg = await navigator.serviceWorker.ready;
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapid) });
      // send subscription to server
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: 'push_subscribe', subscription: sub }));
      }
    } catch (_) {}
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) { outputArray[i] = rawData.charCodeAt(i); }
    return outputArray;
  }
  async function copyTextToClipboard(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (_) {}
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (_) { return false; }
  }

  function showAliasModal() {
    if (!aliasOverlay) return;
    aliasOverlay.hidden = false;
    aliasOverlay.style.display = '';
    if (newAliasInput) {
      newAliasInput.value = alias || 'anon';
      setTimeout(() => { try { newAliasInput.focus(); newAliasInput.select(); } catch (_) {} }, 0);
    }
    if (aliasError) aliasError.textContent = '';
  }

  function setLoginLoading(on) {
    const show = !!on;
    try {
      if (loginLoading) { loginLoading.hidden = !show; loginLoading.style.display = show ? '' : 'none'; }
      if (btnLogin) btnLogin.disabled = show;
      if (btnLoginLobby) btnLoginLobby.disabled = show;
      if (loginRoom) loginRoom.disabled = show;
      if (loginAlias) loginAlias.disabled = show;
      if (loginPrivate) loginPrivate.disabled = show;
      if (loginCode) loginCode.disabled = show || !(loginPrivate && loginPrivate.checked);
    } catch (_) {}
  }
  function hideAliasModal() {
    if (!aliasOverlay) return;
    aliasOverlay.hidden = true;
    aliasOverlay.style.display = 'none';
  }

  function getClientId() {
    try {
      let id = localStorage.getItem('ac:clientId');
      if (!id) {
        if (window.crypto && crypto.randomUUID) id = crypto.randomUUID();
        else id = Math.random().toString(36).slice(2) + Date.now().toString(36);
        localStorage.setItem('ac:clientId', id);
      }
      return id;
    } catch (_) {
      return 'client-' + Math.random().toString(36).slice(2, 10);
    }
  }

  function setStatus(text, color) {
    const suffix = joined && room ? ` · ${room}${members ? ` · ${members} online` : ''}` : '';
    statusEl.textContent = text + suffix;
    statusEl.style.color = color || '';
  }

  function updateLobbyButton() {
    if (!btnJoinLobbyHdr) return;
    const inLobby = !!joined && (room || '').toString() === 'lobby';
    if (inLobby) {
      // Hide the button entirely when already in lobby
      btnJoinLobbyHdr.hidden = true;
      btnJoinLobbyHdr.style.display = 'none';
      // Hide room settings in lobby
      if (btnRoomSettings) { btnRoomSettings.hidden = true; btnRoomSettings.style.display = 'none'; }
    } else {
      btnJoinLobbyHdr.hidden = false;
      btnJoinLobbyHdr.style.display = '';
      btnJoinLobbyHdr.textContent = 'Join Lobby';
      btnJoinLobbyHdr.disabled = false;
      btnJoinLobbyHdr.classList.remove('opacity-60','cursor-not-allowed');
      if (btnRoomSettings) { btnRoomSettings.hidden = false; btnRoomSettings.style.display = ''; }
    }
  }

  function updateCurrentRoomBadge() {
    if (!currentRoomEl) return;
    if (joined && room) {
      const dispAlias = myAliasWithSuffix();
      currentRoomEl.textContent = `#${room} · ${dispAlias}`;
      currentRoomEl.classList.remove('hidden');
    } else {
      currentRoomEl.classList.add('hidden');
      currentRoomEl.textContent = '';
    }
  }

  function appendMessage(msg) {
    try {
      if (msg && msg.type === 'system' && typeof msg.count === 'number' && String(msg.roomId || '') === String(room || '')) {
        members = Number(msg.count) || 0;
        setStatus('connected', '#22c55e');
      }
    } catch (_) {}
    const li = document.createElement('li');
    if (msg.type === 'system') li.classList.add('system');
    if (msg.type === 'dm') li.classList.add('dm');
    const meta = document.createElement('div');
    meta.className = 'meta';
    const dt = new Date(msg.ts || Date.now());
    if (msg.type === 'message' || msg.type === 'dm') {
      const who = document.createElement('button');
      who.className = 'underline decoration-dotted hover:text-emerald-300';
      who.textContent = `${msg.alias || 'anon'}`;
      who.title = 'Click to DM';
      const mineNow = myAliasWithSuffix();
      if (String(msg.alias || '') !== mineNow) {
        who.addEventListener('click', () => {
          const name = (msg.alias || '').toString();
          setDmTarget(name);
          openDmThread(name);
          inputEl.focus();
          if (usersPanel) usersPanel.hidden = true;
          if (roomsPanel) roomsPanel.hidden = true;
        });
      } else {
        // Disable DM-on-self via alias click
        who.classList.remove('underline');
        who.title = '';
      }
      const time = document.createElement('span');
      time.className = 'ml-1 text-slate-400';
      time.textContent = `· ${dt.toLocaleTimeString()}${msg.type === 'dm' ? ' · DM' : ''}`;
      meta.appendChild(who);
      meta.appendChild(time);
      if (String(msg.alias || '') !== mineNow) {
        const dm = document.createElement('button');
        dm.className = 'ml-2 text-[11px] rounded bg-amber-500/10 hover:bg-amber-500/20 border border-amber-400/40 px-2 py-0.5 text-amber-100';
        dm.textContent = 'DM';
        dm.title = 'Direct message';
        dm.addEventListener('click', (e) => {
          e.preventDefault(); e.stopPropagation();
          const name = (msg.alias || '').toString();
          setDmTarget(name);
          openDmThread(name);
          inputEl.focus();
          if (usersPanel) usersPanel.hidden = true;
          if (roomsPanel) roomsPanel.hidden = true;
        });
        meta.appendChild(dm);
      }
      // reply and forward actions
      const actions = document.createElement('span');
      actions.className = 'ml-2 text-[11px] flex gap-2';
      const btnReply = document.createElement('button');
      btnReply.className = 'rounded bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-400/40 px-2 py-0.5 text-cyan-100';
      btnReply.textContent = 'Reply';
      btnReply.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        replyRef = { id: msg.id, alias: msg.alias || '', text: (msg.text || '').toString().slice(0, 120) };
        if (replyToLabel) replyToLabel.textContent = replyRef.alias;
        if (replyToExcerpt) replyToExcerpt.textContent = ` – ${(replyRef.text || '').slice(0, 60)}`;
        if (replyBar) { replyBar.hidden = false; replyBar.style.display = ''; }
        inputEl.focus();
      });
      const btnFwd = document.createElement('button');
      btnFwd.className = 'rounded bg-slate-800/60 hover:bg-slate-800 border border-slate-700 px-2 py-0.5 text-slate-200';
      btnFwd.textContent = 'Forward';
      btnFwd.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        inputEl.value = (msg.text || '').toString();
        inputEl.focus();
      });
      actions.appendChild(btnReply);
      actions.appendChild(btnFwd);
      meta.appendChild(actions);
    } else {
      meta.textContent = `${msg.event || 'info'} · ${dt.toLocaleTimeString()}`;
    }
    const text = document.createElement('div');
    try {
      const raw = (msg.text || '').toString();
      const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const safe = esc(raw);
      const mine = myAliasWithSuffix();
      const replaced = safe.replace(/(^|\s)@([a-zA-Z0-9-]{2,32})/g, (m, pre, name) => {
        const cls = name === mine ? 'mention me' : 'mention';
        return `${pre}<span class="${cls}">@${name}</span>`;
      });
      text.innerHTML = replaced;
    } catch (_) {
      text.textContent = msg.text || '';
    }
    li.appendChild(meta);
    if (msg.replyTo && (msg.replyTo.alias || msg.replyTo.text)) {
      const q = document.createElement('div');
      q.className = 'reply-quote';
      q.textContent = `${msg.replyTo.alias || ''}: ${(msg.replyTo.text || '').toString().slice(0, 120)}`;
      li.appendChild(q);
    }
    li.appendChild(text);
    if (msg.attachment && (msg.attachment.data || msg.attachment.url)) {
      const a = msg.attachment;
      const wrap = document.createElement('div');
      wrap.className = 'attachment';
      if (a.type && a.type.startsWith('image/') && (a.data || a.url)) {
        const img = document.createElement('img');
        img.src = a.data || a.url;
        img.alt = a.name || '';
        wrap.appendChild(img);
      } else if (a.data || a.url) {
        const link = document.createElement('a');
        link.href = a.data || a.url;
        link.download = a.name || 'attachment';
        link.textContent = a.name ? `Download ${a.name}` : 'Download attachment';
        link.className = 'underline text-slate-300';
        wrap.appendChild(link);
      }
      li.appendChild(wrap);
    }
    messagesEl.appendChild(li);
    if (!stickToBottom && msg && msg.roomId === room && (msg.type === 'message' || msg.type === 'dm')) {
      newMsgCount += 1;
      showNewMsgBadge();
    }
    scrollToBottom();
    // Persist locally per room
    try {
      if (msg.roomId) {
        const key = `ac:msgs:${msg.roomId}`;
        const arr = JSON.parse(localStorage.getItem(key) || '[]');
        arr.push({ t: msg.type, a: msg.alias, x: msg.text, ts: msg.ts, id: msg.id, ev: msg.event });
        while (arr.length > MAX_LOCAL) arr.shift();
        localStorage.setItem(key, JSON.stringify(arr));
      }
    } catch (_) {}
  }

  function showNewMsgBadge() {
    if (!newMsgBadge) return;
    newMsgBadge.hidden = false;
    newMsgBadge.style.display = '';
    newMsgBadge.textContent = newMsgCount === 1 ? '1 new message' : `${newMsgCount} new messages`;
  }

  function resetNewMsgBadge() {
    newMsgCount = 0;
    if (!newMsgBadge) return;
    newMsgBadge.hidden = true;
    newMsgBadge.style.display = 'none';
  }

  function resetMessagesForRoom() {
    try { if (messagesEl) messagesEl.innerHTML = ''; } catch (_) {}
    resetNewMsgBadge();
    try { typingPeers.clear(); updateTypingStatus(); } catch (_) {}
  }

  function loadLocalHistoryForRoom(r) {
    try {
      const key = `ac:msgs:${r}`;
      const arr = JSON.parse(localStorage.getItem(key) || '[]');
      for (const m of arr) {
        if (m.t === 'dm') continue; // keep DMs out of room timeline
        appendMessage({ type: m.t, alias: m.a, text: m.x, ts: m.ts, id: m.id, event: m.ev, roomId: r });
      }
    } catch (_) {}
  }

  function connectAndJoin() {
    if (!window.CONFIG || !window.CONFIG.wsUrl) {
      alert('Missing wsUrl in frontend/config.js');
      return;
    }
    try { if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) { ws.close(); } } catch (_) {}
    setStatus('connecting…', '#fbbf24');
    const socket = new WebSocket(window.CONFIG.wsUrl);
    ws = socket;
    socket.onopen = (ev) => {
      setStatus('connected', '#22c55e');
      setLoginLoading(false);
      hideOverlay();
      hideLanding();
      showApp();
      idleClosed = false;
      hideReconnectButton();
      markActivity();
      // Initial connect: quiet only if reconnecting within a few seconds
      let lastJoinTs = 0;
      try { lastJoinTs = parseInt(sessionStorage.getItem('ac:lastJoinTs') || '0', 10) || 0; } catch (_) {}
      const now = Date.now();
      const isQuickReconnect = lastJoinTs && (now - lastJoinTs) < 10000;
      try {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ action: 'join', roomId: room, alias, clientId: getClientId(), code: myRoomCode || undefined, quiet: !!isQuickReconnect }));
        }
      } catch (_) {}
      try { sessionStorage.setItem('ac:lastJoinTs', String(now)); } catch (_) {}
      joined = true;
      joinEl.hidden = true;
      composerEl.hidden = false;
      hideComposerBanners();
      resetMessagesForRoom();
      hideDmThread();
      hideDmsPanel();
      inputEl.focus();
      if (btnLogout) btnLogout.classList.remove('hidden');
      updateCurrentRoomBadge();
      updateLobbyButton();
      // Load local history for this room
      loadLocalHistoryForRoom(room);
      // On first join, jump to bottom
      stickToBottom = true;
      scrollToBottom(true);
      setupPwaAndPush();
    };
    socket.onclose = (ev) => {
      setStatus('disconnected', '#ef4444');
      setLoginLoading(false);
      try { console.warn('[ws close]', ev && (ev.code + ' ' + ev.reason)); } catch (_) {}
      joined = false;
      myAliasServer = '';
      composerEl.hidden = true;
      joinEl.hidden = false;
      hideComposerBanners();
      hideDmThread();
      hideDmsPanel();
      if (btnLogout) btnLogout.classList.add('hidden');
      updateCurrentRoomBadge();
      hideApp();
      showOverlay();
      updateLobbyButton();
      showReconnectButton();
    };
    socket.onerror = (e) => { try { console.error('[ws error]', e); } catch (_) {} setStatus('error', '#ef4444'); setLoginLoading(false); };
    socket.onmessage = async (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg && (msg.type === 'message' || (msg.type === 'system' && msg.event !== 'typing'))) {
          appendMessage(msg);
        } else if (msg && msg.type === 'dm') {
          const mine = myAliasWithSuffix();
          const partner = (String(msg.alias || '') === mine) ? String(msg.to || '') : String(msg.alias || '');
          if (partner) {
            // E2E decrypt when available
            if (msg.enc && dmKeys.get(partner)) {
              try { msg.text = await decryptText(dmKeys.get(partner), msg.enc); } catch (_) { msg.text = '[encrypted]'; }
            } else if (msg.enc) {
              msg.text = 'Encrypted message — ask for the secret to view';
            }
            const thread = ensureThread(partner);
            thread.push(msg);
            if (dmTarget && partner === dmTarget && dmThreadPanel && !dmThreadPanel.hidden) {
              try { dmThreadList.appendChild(renderDmMessageItem(msg)); dmThreadList.scrollTop = dmThreadList.scrollHeight; } catch (_) {}
            } else {
              const prev = dmUnread.get(partner) || 0;
              dmUnread.set(partner, prev + 1);
              dmTotalUnread++;
              updateDmsButton();
            }
          }
          if (msg.type === 'system' && msg.event === 'error' && /Invalid room code/i.test(msg.text || '')) {
            if (joined) {
              if (roomCodeOverlay) { roomCodeOverlay.hidden = false; roomCodeOverlay.style.display = ''; }
              if (roomJoinCodeInput) { roomJoinCodeInput.value = ''; try { roomJoinCodeInput.focus(); } catch (_) {} }
              return;
            } else {
              if (loginRoom) loginRoom.value = room || loginRoom.value || '';
              if (loginPrivate) loginPrivate.checked = true;
              if (loginCode) loginCode.disabled = false;
              if (loginError) loginError.textContent = 'Invalid room code';
              showOverlay();
              if (loginCode) loginCode.focus();
              return;
            }
          }
          if (msg.type === 'system' && (msg.event === 'join' || msg.event === 'leave')) {
            if (typeof msg.count === 'number' && msg.roomId === room) {
              members = msg.count;
              setStatus('connected', '#22c55e');
            }
          }
        } else if (msg && msg.type === 'rooms') {
          // Render rooms list panel, or fallback to alert if panel missing
          if (roomsPanel && roomsList) {
            if (usersPanel) usersPanel.hidden = true;
            if (dmsPanel) dmsPanel.hidden = true;
            roomsList.innerHTML = '';
            const total = document.createElement('li');
            total.className = 'py-2 text-slate-400';
            total.textContent = `Total users: ${msg.total || 0}`;
            roomsList.appendChild(total);
            if (Array.isArray(msg.rooms)) {
              for (const r of msg.rooms) {
                const li = document.createElement('li');
                li.className = 'py-2 flex items-center justify-between gap-2 cursor-pointer hover:bg-slate-800/50 px-2 rounded';
                const left = document.createElement('div');
                left.className = 'flex items-center gap-1';
                if (r.private) {
                  const lock = document.createElementNS('http://www.w3.org/2000/svg','svg');
                  lock.setAttribute('xmlns','http://www.w3.org/2000/svg');
                  lock.setAttribute('viewBox','0 0 24 24');
                  lock.setAttribute('fill','none');
                  lock.setAttribute('stroke','currentColor');
                  lock.setAttribute('class','h-3.5 w-3.5 text-slate-300');
                  const path = document.createElementNS('http://www.w3.org/2000/svg','path');
                  path.setAttribute('stroke-linecap','round');
                  path.setAttribute('stroke-linejoin','round');
                  path.setAttribute('stroke-width','1.5');
                  path.setAttribute('d','M8 10V7a4 4 0 118 0v3m-9 0h10a2 2 0 012 2v6a2 2 0 01-2 2H7a2 2 0 01-2-2v-6a2 2 0 012-2z');
                  lock.appendChild(path);
                  left.appendChild(lock);
                }
                const txt = document.createElement('span');
                txt.textContent = r.roomId;
                left.appendChild(txt);
                const right = document.createElement('div');
                right.className = 'text-slate-400 text-xs';
                right.textContent = `${r.count}`;
                li.appendChild(left);
                li.appendChild(right);
              li.addEventListener('click', () => {
                // Prepare to join selected room; prompt for code if private
                room = (r.roomId || '').toString();
                roomEl.value = room;
                roomsPanel.hidden = true;
                if (r && r.private) {
                  if (roomCodeOverlay) { roomCodeOverlay.hidden = false; roomCodeOverlay.style.display = ''; }
                  if (roomJoinCodeInput) { roomJoinCodeInput.value = ''; try { roomJoinCodeInput.focus(); } catch (_) {} }
                  return;
                }
                myRoomCode = '';
                if (ws && ws.readyState === WebSocket.OPEN) {
                  resetMessagesForRoom();
                  ws.send(JSON.stringify({ action: 'join', roomId: room, alias, clientId: getClientId() }));
                  updateCurrentRoomBadge();
                  updateLobbyButton();
                  loadLocalHistoryForRoom(room);
                  stickToBottom = true;
                  scrollToBottom(true);
                } else {
                  connectAndJoin();
                }
              });
                roomsList.appendChild(li);
              }
            }
            showPanel(roomsPanel);
          } else {
            const lines = [];
            lines.push(`Total users: ${msg.total || 0}`);
            if (Array.isArray(msg.rooms)) {
              for (const r of msg.rooms) lines.push(`${r.roomId}: ${r.count}`);
            }
            alert(lines.join('\n'));
          }
        } else if (msg && msg.type === 'who') {
          const mine = myAliasWithSuffix();
          const all = Array.isArray(msg.users) ? msg.users.map((u) => String(u.alias)) : [];
          usersInRoom = all.filter((n) => n && n !== mine);
          // Update online count based on server who list (total includes me)
          try {
            const total = Array.isArray(msg.users) ? msg.users.length : 0;
            if (total > 0) { members = total; setStatus('connected', '#22c55e'); }
          } catch (_) {}
          if (usersPanel && usersList) {
            openUsersPanel();
            usersList.innerHTML = '';
            for (const name of usersInRoom) {
              const li = document.createElement('li');
              li.className = 'py-2 flex items-center justify-between gap-2 px-2';
              const left = document.createElement('div');
              left.textContent = name;
              const dm = document.createElement('button');
              dm.className = 'text-xs rounded bg-amber-500/10 hover:bg-amber-500/20 border border-amber-400/40 px-2 py-0.5 text-amber-100';
              dm.textContent = 'DM';
              dm.addEventListener('click', () => {
                setDmTarget(name);
                openDmThread(name);
                usersPanel.hidden = true;
                inputEl.focus();
              });
              li.appendChild(left);
              li.appendChild(dm);
              usersList.appendChild(li);
          }
          usersPanel.hidden = false;
        }
        } else if (msg && msg.type === 'system' && msg.event === 'typing') {
          try {
            const name = String(msg.alias || '');
            const mine = myAliasWithSuffix();
            // Only show DM typing directed to me and from my current DM target
            if (!name || name === mine) return;
            if (!msg.to || String(msg.to) !== mine) return;
            if (!dmTarget || String(dmTarget) !== name) return;
            if (msg.typing) typingPeers.set(name, Date.now() + 3000); else typingPeers.delete(name);
            updateTypingStatus();
          } catch (_) {}
        } else if (msg && msg.type === 'me' && msg.event === 'joined') {
      try {
        if (typeof msg.alias === 'string' && msg.alias) {
          myAliasServer = msg.alias;
          updateCurrentRoomBadge();
        }
        // Now that server confirmed join, request users list
        try { requestUsers(); } catch (_) {}
      } catch (_) {}
    } else if (msg && msg.type === 'presign') {
      handlePresign(msg);
    }
      } catch (_) {}
    };
  }

  // Attachments helpers
  function showAttachPreviewUI(file, dm = false) {
    const box = dm ? dmAttachPreview : attachPreview;
    const img = dm ? dmAttachPreviewImg : attachPreviewImg;
    const prog = dm ? dmAttachPreviewProg : attachPreviewProg;
    const retry = dm ? dmAttachPreviewRetry : attachPreviewRetry;
    const ok = dm ? dmAttachPreviewOk : attachPreviewOk;
    if (!box || !img) return;
    try { img.src = URL.createObjectURL(file); } catch (_) {}
    box.hidden = false; box.style.display = '';
    if (prog) prog.textContent = '0%';
    if (retry) retry.hidden = true;
    if (ok) ok.hidden = true;
  }
  function hideAttachPreviewUI(dm = false) {
    const box = dm ? dmAttachPreview : attachPreview;
    const img = dm ? dmAttachPreviewImg : attachPreviewImg;
    const prog = dm ? dmAttachPreviewProg : attachPreviewProg;
    const retry = dm ? dmAttachPreviewRetry : attachPreviewRetry;
    const ok = dm ? dmAttachPreviewOk : attachPreviewOk;
    if (!box) return;
    box.hidden = true; box.style.display = 'none';
    if (img) img.src = '';
    if (prog) prog.textContent = '';
    if (retry) retry.hidden = true;
    if (ok) ok.hidden = true;
  }
  function clearPendingAttachment(dm = false) {
    if (dm) pendingDmAttachment = null; else pendingAttachment = null;
    hideAttachPreviewUI(dm);
  }
  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result || ''));
      fr.onerror = reject;
      fr.readAsDataURL(file);
    });
  }

  async function downscaleImage(file, maxDim = 1024, quality = 0.85) {
    return new Promise((resolve, reject) => {
      try {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          const scale = Math.min(1, maxDim / Math.max(width, height));
          const w = Math.max(1, Math.round(width * scale));
          const h = Math.max(1, Math.round(height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          canvas.toBlob((blob) => {
            if (!blob) return reject(new Error('toBlob failed'));
            const out = new File([blob], file.name.replace(/\.(png|jpg|jpeg|webp)$/i, '.jpg'), { type: 'image/jpeg' });
            resolve(out);
          }, 'image/jpeg', quality);
        };
        img.onerror = reject;
        const url = URL.createObjectURL(file);
        img.src = url;
      } catch (e) { reject(e); }
    });
  }

  joinBtn.addEventListener('click', () => {
    room = (roomEl.value || 'lobby').trim().slice(0, 64);
    alias = (aliasEl.value || 'anon').trim().slice(0, 32);
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      connectAndJoin();
    } else {
      // If already connected, allow re-joining a room without reconnect
      resetMessagesForRoom();
      ws.send(JSON.stringify({ action: 'join', roomId: room, alias, clientId: getClientId(), code: myRoomCode || undefined }));
      joined = true;
      joinEl.hidden = true;
      composerEl.hidden = false;
      hideComposerBanners();
      hideDmThread();
      hideDmsPanel();
      inputEl.focus();
      updateCurrentRoomBadge();
      updateLobbyButton();
      // Re-joined a room: one-time scroll to bottom
      stickToBottom = true;
      loadLocalHistoryForRoom(room);
      scrollToBottom(true);
      requestUsers();
    }
  });

  // Login overlay flow
  function doLogin() {
    const r = (loginRoom && loginRoom.value || 'lobby').toString().trim().slice(0, 64);
    const a = (loginAlias && loginAlias.value || 'anon').toString().trim().slice(0, 32);
    // Validate config before proceeding
    if (!window.CONFIG || !window.CONFIG.wsUrl) {
      if (loginError) loginError.textContent = 'Missing wsUrl. Create frontend/config.js and set wsUrl.';
      return;
    }
    if (loginError) loginError.textContent = '';
    roomEl.value = r;
    aliasEl.value = a;
    room = r;
    alias = a;
    // capture private code if enabled
    const priv = !!(loginPrivate && loginPrivate.checked);
    myRoomCode = priv && loginCode ? (loginCode.value || '').toString().trim().slice(0, 32) : '';
    if (rememberSession && rememberSession.checked) {
      try {
        localStorage.setItem('ac:lastRoom', r);
        localStorage.setItem('ac:lastAlias', a);
        localStorage.setItem('ac:remember', '1');
      } catch (_) {}
    }
    try { sessionStorage.setItem('ac:loggedIn', '1'); } catch (_) {}
    setLoginLoading(true);
    if (btnLogout) btnLogout.classList.add('hidden');
    if (btnLogin) btnLogin.textContent = 'Connecting…';
    const startConnect = () => {
      connectAndJoin();
      // Re-enable UI shortly (in case of quick failure)
      setTimeout(() => {
        if (btnLogin) btnLogin.textContent = 'Login';
      }, 2000);
    };
    startConnect();
  }

  if (btnLogin) btnLogin.addEventListener('click', (e) => { e.preventDefault(); doLogin(); });
  if (btnLoginClose) btnLoginClose.addEventListener('click', (e) => {
    e.preventDefault();
    // Close login and show landing; also disable remember to prevent auto-popup next load
    try { localStorage.removeItem('ac:remember'); } catch (_) {}
    hideOverlay();
    showLanding();
  });
  if (btnLoginLobby) btnLoginLobby.addEventListener('click', (e) => {
    e.preventDefault();
    if (loginRoom) loginRoom.value = 'lobby';
    const priv = document.getElementById('loginPrivate');
    const codeEl = document.getElementById('loginCode');
    if (priv) priv.checked = false;
    if (codeEl) codeEl.value = '';
    doLogin();
  });
  if (loginPrivate) loginPrivate.addEventListener('change', () => {
    const on = !!loginPrivate.checked;
    if (loginCode) loginCode.disabled = !on;
    if (btnGenCode) btnGenCode.disabled = !on;
    // Ensure a code exists when enabling private toggle
    if (on && loginCode && !loginCode.value) loginCode.value = Math.random().toString(36).slice(2, 8);
    const btnCopyCode = document.getElementById('btnCopyCode');
    // Enable copy immediately when private is on (code is guaranteed now)
    if (btnCopyCode) btnCopyCode.disabled = !on ? true : false;
  });
  if (btnGenCode) btnGenCode.addEventListener('click', (e) => {
    e.preventDefault();
    if (loginCode) loginCode.value = Math.random().toString(36).slice(2, 8);
    const btnCopyCode = document.getElementById('btnCopyCode');
    if (btnCopyCode) btnCopyCode.disabled = !(loginCode && loginCode.value);
  });
  if (loginCode) loginCode.addEventListener('input', () => {
    const btnCopyCode = document.getElementById('btnCopyCode');
    if (btnCopyCode) btnCopyCode.disabled = !(loginPrivate && loginPrivate.checked && loginCode.value);
  });
  const btnCopyCode = document.getElementById('btnCopyCode');
  if (btnCopyCode) btnCopyCode.addEventListener('click', async (e) => {
    e.preventDefault();
    if (!loginCode || !loginCode.value) return;
    const ok = await copyTextToClipboard(loginCode.value);
    const old = btnCopyCode.textContent;
    btnCopyCode.textContent = ok ? 'Copied!' : 'Failed';
    setTimeout(() => { btnCopyCode.textContent = old || 'Copy'; }, 1200);
  });
  if (loginRoom) loginRoom.addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });
  if (loginAlias) loginAlias.addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });
  if (btnLogout) btnLogout.addEventListener('click', () => {
    try { sessionStorage.removeItem('ac:loggedIn'); } catch (_) {}
    try { localStorage.removeItem('ac:remember'); localStorage.removeItem('ac:lastRoom'); localStorage.removeItem('ac:lastAlias'); } catch (_) {}
    if (ws) try { ws.close(); } catch (_) {}
    joined = false;
    myAliasServer = '';
    alias = '';
    room = '';
    composerEl.hidden = true;
    joinEl.hidden = false;
    setStatus('disconnected', '#ef4444');
    showOverlay();
    });

  copyBtn.addEventListener('click', async () => {
    const r = (roomEl.value || 'lobby').trim().slice(0, 64);
    const a = (aliasEl.value || 'anon').trim().slice(0, 32);
    const url = new URL(window.location.href);
    url.searchParams.set('room', r);
    url.searchParams.set('alias', a);
    url.searchParams.set('autojoin', '1');
    if (myRoomCode) url.searchParams.set('code', myRoomCode);
    try {
      await navigator.clipboard.writeText(url.toString());
      copyBtn.textContent = 'Copied!';
      setTimeout(() => (copyBtn.textContent = 'Copy link'), 1200);
    } catch (_) {
      alert(url.toString());
    }
  });

  // Room code modal events
  if (btnRoomCodeCancel) btnRoomCodeCancel.addEventListener('click', (e) => {
    e.preventDefault();
    if (roomCodeOverlay) { roomCodeOverlay.hidden = true; roomCodeOverlay.style.display = 'none'; }
  });
  if (btnRoomCodeJoin) btnRoomCodeJoin.addEventListener('click', (e) => {
    e.preventDefault();
    if (!room || !ws || ws.readyState !== WebSocket.OPEN) return;
    const code = (roomJoinCodeInput && roomJoinCodeInput.value || '').toString().trim().slice(0, 32);
    if (!code) return;
    resetMessagesForRoom();
    ws.send(JSON.stringify({ action: 'join', roomId: room, alias, clientId: getClientId(), code }));
    updateCurrentRoomBadge();
    updateLobbyButton();
    loadLocalHistoryForRoom(room);
    if (roomCodeOverlay) { roomCodeOverlay.hidden = true; roomCodeOverlay.style.display = 'none'; }
  });
  if (roomJoinCodeInput) roomJoinCodeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); if (btnRoomCodeJoin) btnRoomCodeJoin.click(); } });

  function requestRooms() {
    if (ws && ws.readyState === WebSocket.OPEN) {
      if (usersPanel) usersPanel.hidden = true;
      ws.send(JSON.stringify({ action: 'rooms' }));
    } else {
      alert('Connect first, then try again.');
    }
  }

  function requestUsers() {
    if (ws && ws.readyState === WebSocket.OPEN) {
      if (roomsPanel) roomsPanel.hidden = true;
      if (usersPanel && usersList) {
        usersList.innerHTML = '';
        const li = document.createElement('li');
        li.className = 'py-2 px-2 text-slate-400';
        li.textContent = 'Loading…';
        usersList.appendChild(li);
        usersPanel.hidden = false;
      }
      ws.send(JSON.stringify({ action: 'who' }));
    } else {
      alert('Connect first, then try again.');
    }
  }

  function updateTypingStatus() {
    const now = Date.now();
    for (const [k, exp] of Array.from(typingPeers.entries())) {
      if (exp <= now) typingPeers.delete(k);
    }
    const names = Array.from(typingPeers.keys());
    const text = !names.length ? '' : (names.length === 1 ? `${names[0]} is typing…` : (names.length === 2 ? `${names[0]} and ${names[1]} are typing…` : `${names.length} people are typing…`));
    if (typingStatus) typingStatus.textContent = text;
    if (dmTypingStatus) dmTypingStatus.textContent = text;
  }

  function sendTyping(on, explicitTo) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const target = explicitTo || dmTarget;
    if (!target) return; // Only send typing for DM
    if (target === myAliasWithSuffix()) return; // Don't send typing to self
    const now = Date.now();
    if (on) {
      if (now - lastTypingSent < 1000) return;
      lastTypingSent = now;
    }
    try { ws.send(JSON.stringify({ action: 'typing', typing: !!on, to: target })); } catch (_) {}
  }

  // Toggle helpers to avoid stacked panels
  function toggleRooms() {
    if (!roomsPanel) return requestRooms();
    if (isVisible(roomsPanel)) { hideAllPanels(); return; }
    openRoomsPanel();
    requestRooms();
  }
  function toggleUsers() {
    if (!usersPanel) return requestUsers();
    if (isVisible(usersPanel)) { hideAllPanels(); return; }
    openUsersPanel();
    requestUsers();
  }

  roomsBtn.addEventListener('click', toggleRooms);
  if (roomsHdrBtn) roomsHdrBtn.addEventListener('click', toggleRooms);
  if (usersHdrBtn) usersHdrBtn.addEventListener('click', toggleUsers);
  if (btnJoinLobbyHdr) btnJoinLobbyHdr.addEventListener('click', () => {
    const wasLobby = (room || '').toString() === 'lobby';
    myRoomCode = '';
    room = 'lobby';
    roomEl.value = 'lobby';
    if (ws && ws.readyState === WebSocket.OPEN) {
      if (joined && wasLobby) { updateLobbyButton(); return; }
      resetMessagesForRoom();
      ws.send(JSON.stringify({ action: 'join', roomId: room, alias, clientId: getClientId() }));
      updateCurrentRoomBadge();
      hideComposerBanners();
      updateLobbyButton();
      loadLocalHistoryForRoom(room);
      stickToBottom = true;
      scrollToBottom(true);
      requestUsers();
    } else {
      connectAndJoin();
    }
  });
  if (btnEditAlias) btnEditAlias.addEventListener('click', () => {
    showAliasModal();
  });

  if (btnAliasCancel) btnAliasCancel.addEventListener('click', (e) => {
    e.preventDefault();
    hideAliasModal();
  });
  if (btnAliasSave) btnAliasSave.addEventListener('click', (e) => {
    e.preventDefault();
    let base = (newAliasInput && newAliasInput.value) || '';
    base = base.toString().trim().slice(0, 32);
    if (!base) {
      if (aliasError) aliasError.textContent = 'Alias cannot be empty';
      return;
    }
    alias = base;
    try { localStorage.setItem('ac:lastAlias', base); } catch (_) {}
    hideAliasModal();
    if (ws && ws.readyState === WebSocket.OPEN && room) {
      ws.send(JSON.stringify({ action: 'join', roomId: room, alias, clientId: getClientId() }));
      updateCurrentRoomBadge();
    }
  });
  if (newAliasInput) newAliasInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); if (btnAliasSave) btnAliasSave.click(); } });

  if (roomsRefresh) {
    roomsRefresh.addEventListener('click', () => {
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ action: 'rooms' }));
    });
  }
  function openLoginModalViaNav() {
    try { window.location.assign('/chat'); } catch (_) { window.location.href = '/chat'; }
  }
  const btnChatNow = document.getElementById('btnChatNow');
  if (btnChatNow) btnChatNow.addEventListener('click', openLoginModalViaNav);
  const btnChatNowNav = document.getElementById('btnChatNowNav');
  if (btnChatNowNav) btnChatNowNav.addEventListener('click', openLoginModalViaNav);

  // Handle browser back/forward to toggle landing/login views
  window.addEventListener('popstate', () => {
    const st = history.state || {};
    if (st.view === 'login') { hideLanding(); showOverlay(); return; }
    // default to landing when not explicitly in login
    showLanding(); hideOverlay();
  });

  // Seed initial history state
  try {
    const st = history.state || {};
    if (!st || !st.view) {
      history.replaceState({ view: 'landing' }, '', location.pathname + location.search);
    }
  } catch (_) {}
  if (btnRoomSettings) btnRoomSettings.addEventListener('click', () => {
    if (roomSettingsOverlay) { roomSettingsOverlay.hidden = false; roomSettingsOverlay.style.display = ''; }
    if (roomNewCode) { roomNewCode.value=''; try { roomNewCode.focus(); } catch (_) {} }
  });
  if (btnRoomSettingsClose) btnRoomSettingsClose.addEventListener('click', () => {
    if (roomSettingsOverlay) { roomSettingsOverlay.hidden = true; roomSettingsOverlay.style.display = 'none'; }
  });
  if (btnRotateCode) btnRotateCode.addEventListener('click', () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const code = (roomNewCode && roomNewCode.value || '').toString().trim().slice(0,32);
    if (!code) return;
    ws.send(JSON.stringify({ action: 'set_code', code }));
    if (roomSettingsOverlay) { roomSettingsOverlay.hidden = true; roomSettingsOverlay.style.display = 'none'; }
  });

  if (roomsClose) {
    roomsClose.addEventListener('click', () => {
      roomsPanel.hidden = true;
    });
  }
  if (usersRefresh) usersRefresh.addEventListener('click', requestUsers);
  if (usersClose) usersClose.addEventListener('click', () => { usersPanel.hidden = true; });
  if (dmsHdrBtn) dmsHdrBtn.addEventListener('click', () => {
    if (dmsPanel && !dmsPanel.hidden) hideDmsPanel(); else openDmsPanel();
  });
  if (dmsClose) dmsClose.addEventListener('click', () => { hideDmsPanel(); });
  if (dmThreadClose) dmThreadClose.addEventListener('click', () => { hideDmThread(); });
  if (dmThreadBack) dmThreadBack.addEventListener('click', () => { hideDmThread(); openDmsPanel(); });
  if (dmThreadSelect) dmThreadSelect.addEventListener('change', () => { const v = dmThreadSelect.value; if (v) { setDmTarget(v); openDmThread(v); } });
  function showDmKeyModal(partner) {
    if (!dmKeyOverlay) return;
    if (dmKeyPartner) dmKeyPartner.textContent = partner || '';
    if (dmKeyInput) dmKeyInput.value = '';
    dmKeyOverlay.hidden = false; dmKeyOverlay.style.display = '';
    try { setTimeout(() => { dmKeyInput && dmKeyInput.focus(); }, 0); } catch (_) {}
  }
  function hideDmKeyModal() { if (!dmKeyOverlay) return; dmKeyOverlay.hidden = true; dmKeyOverlay.style.display = 'none'; }
  if (btnDmSetKey) btnDmSetKey.addEventListener('click', () => {
    const partner = dmTarget || (dmThreadSelect && dmThreadSelect.value) || '';
    if (!partner) return;
    showDmKeyModal(partner);
  });
  if (btnDmKeyCancel) btnDmKeyCancel.addEventListener('click', (e) => { e.preventDefault(); hideDmKeyModal(); });
  if (btnDmKeyClose) btnDmKeyClose.addEventListener('click', (e) => { e.preventDefault(); hideDmKeyModal(); });
  if (btnDmKeySave) btnDmKeySave.addEventListener('click', async (e) => {
    e.preventDefault();
    const partner = dmTarget || (dmThreadSelect && dmThreadSelect.value) || '';
    if (!partner || !dmKeyInput) { hideDmKeyModal(); return; }
    const pass = (dmKeyInput.value || '').toString();
    if (!pass) { hideDmKeyModal(); return; }
    const key = await deriveKey(pass);
    dmKeys.set(partner, key);
    try { localStorage.setItem(`ac:dmkey:${partner}`, pass); } catch (_) {}
    reflectDmEncryptState(partner);
    hideDmKeyModal();
  });

  // Load any saved DM keys (do not mutate UI until a partner is selected)
  try {
    const items = Object.keys(localStorage).filter((k) => k.startsWith('ac:dmkey:'));
    for (const k of items) {
      const partner = k.replace('ac:dmkey:','');
      const pass = localStorage.getItem(k);
      if (pass) {
        deriveKey(pass).then((key) => { dmKeys.set(partner, key); }).catch(() => {});
      }
    }
    // Reflect current selection state once at start
    reflectDmEncryptState();
  } catch (_) {}

  async function deriveKey(pass) {
    const enc = new TextEncoder();
    const baseKey = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
    const salt = enc.encode('anonchat-dm');
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, baseKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function encryptText(key, plain) {
    const enc = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plain));
    return { c: b64(new Uint8Array(ct)), iv: b64(iv) };
  }
  async function decryptText(key, payload) {
    const dec = new TextDecoder();
    const iv = ub64(payload.iv);
    const data = ub64(payload.c);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
    return dec.decode(pt);
  }
  function b64(buf) { return btoa(String.fromCharCode(...buf)); }
  function ub64(s) { const bin = atob(s); const buf = new Uint8Array(bin.length); for (let i=0;i<bin.length;i++) buf[i]=bin.charCodeAt(i); return buf; }
  // Presign + upload flow: handle WS reply and upload file
  function handlePresign(msg) {
    try {
      if (!msg || !msg.uploadUrl || !msg.getUrl) return;
      const isDm = String(msg.scope || '') === 'dm';
      const file = isDm ? lastDmAttachFile : lastAttachFile;
      if (!file) return;
      // Show chip and start progress
      const prog = isDm ? dmAttachPreviewProg : attachPreviewProg;
      const retry = isDm ? dmAttachPreviewRetry : attachPreviewRetry;
      const ok = isDm ? dmAttachPreviewOk : attachPreviewOk;
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', msg.uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.withCredentials = false;
      xhr.timeout = 60000;
      xhr.upload.onprogress = (e) => {
        if (!prog) return;
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          prog.textContent = `· ${pct}%`;
        } else {
          prog.textContent = '· uploading…';
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          if (prog) prog.textContent = '';
          if (retry) retry.hidden = true;
          if (ok) ok.hidden = false;
          const att = { name: file.name, type: file.type, size: file.size, url: msg.getUrl };
          if (isDm) { pendingDmAttachment = att; if (dmFileAttach) dmFileAttach.value=''; }
          else { pendingAttachment = att; if (fileAttach) fileAttach.value=''; }
        } else {
          if (prog) prog.textContent = '· failed';
          if (retry) {
            retry.hidden = false;
            retry.onclick = () => {
              // Re-request presign and retry
              ws && ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ action: 'presign', name: file.name, type: file.type, size: file.size, scope: isDm ? 'dm' : 'room' }));
              retry.hidden = true;
              if (prog) prog.textContent = '· retrying…';
            };
          }
        }
      };
      xhr.onerror = () => {
        if (prog) prog.textContent = '· failed';
        if (retry) {
          retry.hidden = false;
          retry.onclick = () => {
            ws && ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ action: 'presign', name: file.name, type: file.type, size: file.size, scope: isDm ? 'dm' : 'room' }));
            retry.hidden = true;
            if (prog) prog.textContent = '· retrying…';
          };
        }
      };
      xhr.ontimeout = () => {
        if (prog) prog.textContent = '· timeout';
        if (retry) {
          retry.hidden = false;
          retry.onclick = () => {
            ws && ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ action: 'presign', name: file.name, type: file.type, size: file.size, scope: isDm ? 'dm' : 'room' }));
            retry.hidden = true;
            if (prog) prog.textContent = '· retrying…';
          };
        }
      };
      if (prog) prog.textContent = '· uploading…';
      xhr.send(file);
    } catch (_) {}
  }
  // Attachment controls (room)
  if (btnAttach) btnAttach.addEventListener('click', () => { if (fileAttach) fileAttach.click(); });
  if (fileAttach) fileAttach.addEventListener('change', async () => {
    try {
      let file = fileAttach.files && fileAttach.files[0];
      if (!file) return;
      if (!/^image\//.test(file.type)) { alert('Only images are supported for now.'); fileAttach.value=''; return; }
      try { file = await downscaleImage(file, 1024, 0.85); } catch (_) {}
      lastAttachFile = file;
      showAttachPreviewUI(file, false);
      if (isLocalWs()) {
        // Local fallback: embed data URL and mark OK immediately
        const data = await readFileAsDataURL(file);
        pendingAttachment = { name: file.name, type: file.type, size: file.size, data };
        if (attachPreviewProg) attachPreviewProg.textContent = '';
        if (attachPreviewRetry) attachPreviewRetry.hidden = true;
        if (attachPreviewOk) attachPreviewOk.hidden = false;
        fileAttach.value='';
      } else {
        // Request presigned URL for room scope
        ws && ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ action: 'presign', name: file.name, type: file.type, size: file.size, scope: 'room' }));
      }
    } catch (e) {}
  });
  if (attachPreviewRemove) attachPreviewRemove.addEventListener('click', () => { clearPendingAttachment(false); if (fileAttach) fileAttach.value=''; });
  // Attachment controls (DM)
  if (btnDmAttach) btnDmAttach.addEventListener('click', () => { if (dmFileAttach) dmFileAttach.click(); });
  if (dmFileAttach) dmFileAttach.addEventListener('change', async () => {
    try {
      let file = dmFileAttach.files && dmFileAttach.files[0];
      if (!file) return;
      if (!/^image\//.test(file.type)) { alert('Only images are supported for now.'); dmFileAttach.value=''; return; }
      try { file = await downscaleImage(file, 1024, 0.85); } catch (_) {}
      lastDmAttachFile = file;
      showAttachPreviewUI(file, true);
      if (isLocalWs()) {
        const data = await readFileAsDataURL(file);
        pendingDmAttachment = { name: file.name, type: file.type, size: file.size, data };
        if (dmAttachPreviewProg) dmAttachPreviewProg.textContent = '';
        if (dmAttachPreviewRetry) dmAttachPreviewRetry.hidden = true;
        if (dmAttachPreviewOk) dmAttachPreviewOk.hidden = false;
        dmFileAttach.value='';
      } else {
        ws && ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ action: 'presign', name: file.name, type: file.type, size: file.size, scope: 'dm' }));
      }
    } catch (e) {}
  });
  if (dmAttachPreviewRemove) dmAttachPreviewRemove.addEventListener('click', () => { clearPendingAttachment(true); if (dmFileAttach) dmFileAttach.value=''; });
  if (dmSend) dmSend.addEventListener('click', async () => {
    const partner = dmTarget || (dmThreadSelect && dmThreadSelect.value) || '';
    if (!partner || partner === myAliasWithSuffix()) return;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const text = (dmInput && dmInput.value || '').toString().trim();
    if (!text && !pendingDmAttachment) return;
    let payload = { action: 'dm', to: partner, text };
    try {
      const key = dmKeys.get(partner);
      if (key && text) {
        const e = await encryptText(key, text);
        payload = { action: 'dm', to: partner, enc: e, text: '' };
      }
    } catch (_) {}
    if (pendingDmAttachment) payload.attachment = pendingDmAttachment;
    ws.send(JSON.stringify(payload));
    try { sendTyping(false, partner); } catch (_) {}
    if (dmInput) dmInput.value = '';
    // Clear DM pending attachment after send
    clearPendingAttachment(true);
  });
  if (dmInput) dmInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); if (dmSend) dmSend.click(); } });
  if (dmInput) dmInput.addEventListener('input', () => { const has = !!dmInput.value.trim(); if (dmTarget) sendTyping(has, dmTarget); });
  if (dmInput) dmInput.addEventListener('blur', () => { if (dmTarget) sendTyping(false, dmTarget); });

  if (btnDmClear) {
    btnDmClear.addEventListener('click', () => {
      const prev = dmTarget;
      setDmTarget(null);
      if (dmThreadPanel) dmThreadPanel.hidden = true;
      if (dmBar) { dmBar.hidden = true; dmBar.style.display = 'none'; }
      if (prev) sendTyping(false, prev);
    });
  }
  if (btnReplyClear) {
    btnReplyClear.addEventListener('click', () => {
      replyRef = null;
      if (replyBar) { replyBar.hidden = true; replyBar.style.display = 'none'; }
      inputEl.placeholder = 'Type a message';
    });
  }

  if (newMsgBadge) {
    newMsgBadge.addEventListener('click', () => {
      stickToBottom = true;
      scrollToBottom(true);
      resetNewMsgBadge();
    });
  }

  sendBtn.addEventListener('click', async () => {
    const text = inputEl.value.trim();
    if ((!text && !pendingAttachment) || !ws || ws.readyState !== WebSocket.OPEN) return;
    if (text.length > 512) return;
    if (mentionOpen) closeMention();
    if (text.toLowerCase() === '/who') { requestUsers(); inputEl.value = ''; return; }
    if (dmTarget) {
      if (dmTarget === myAliasWithSuffix()) {
        // Disallow DMing yourself
        setDmTarget(null);
        return;
      }
      let payload = { action: 'dm', to: dmTarget, text };
      const key = dmKeys.get(dmTarget);
      if (key && text) {
        try { const e = await encryptText(key, text); payload = { action: 'dm', to: dmTarget, enc: e, text: '' }; } catch (_) {}
      }
      if (pendingDmAttachment) payload.attachment = pendingDmAttachment;
      ws.send(JSON.stringify(payload));
      // stop typing indicator for DM after sending
      try { sendTyping(false); } catch (_) {}
    } else {
      const payload = { action: 'send', text };
      if (replyRef) payload.replyTo = { id: replyRef.id, alias: replyRef.alias, text: replyRef.text };
      if (pendingAttachment) payload.attachment = pendingAttachment;
      ws.send(JSON.stringify(payload));
    }
    inputEl.value = '';
    if (replyBar) replyBar.hidden = true;
    replyRef = null;
    clearPendingAttachment(false);
    clearPendingAttachment(true);
  });

  document.addEventListener('click', (e) => {
    if (!mentionOpen) return;
    if (!mentionBox) return;
    if (!mentionBox.contains(e.target) && e.target !== inputEl) closeMention();
  });

  // Click-outside to dismiss DM thread (ignore when modals are open)
  document.addEventListener('mousedown', (e) => {
    try {
      if (!dmThreadPanel || dmThreadPanel.hidden) return;
      // If DM key modal or other overlays are open, don't close the thread
      const anyModalOpen = (dmKeyOverlay && !dmKeyOverlay.hidden && dmKeyOverlay.style.display !== 'none') ||
        (aliasOverlay && !aliasOverlay.hidden && aliasOverlay.style.display !== 'none') ||
        (loginOverlay && !loginOverlay.hidden && loginOverlay.style.display !== 'none');
      if (anyModalOpen) return;
      if (!dmThreadPanel.contains(e.target)) hideDmThread();
    } catch (_) {}
  });
  // Escape to dismiss DM thread
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideDmThread();
      hideDmsPanel();
    }
  });

  // Idle activity tracking and reconnect
  if (btnReconnect) btnReconnect.addEventListener('click', () => { try { connectAndJoin(); } catch (_) {} });
  ['mousemove','keydown','touchstart','scroll','focusin'].forEach((ev) => {
    document.addEventListener(ev, markActivity, { passive: true });
  });
  window.addEventListener('focus', markActivity);
  if (inputEl) inputEl.addEventListener('input', markActivity);
  if (dmInput) dmInput.addEventListener('input', markActivity);

  inputEl.addEventListener('keydown', (e) => {
    if (mentionOpen) {
      if (e.key === 'ArrowDown') { e.preventDefault(); if (mentionList && mentionList.children.length) { mentionIdx = (mentionIdx + 1) % mentionList.children.length; reflectMentionActive(); } return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); if (mentionList && mentionList.children.length) { mentionIdx = (mentionIdx - 1 + mentionList.children.length) % mentionList.children.length; reflectMentionActive(); } return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); const li = mentionList && mentionList.children[mentionIdx]; if (li) { const name = li.firstChild && li.firstChild.textContent || ''; chooseMention(name); } else { closeMention(); } return; }
      if (e.key === 'Escape') { closeMention(); return; }
    }
    if (e.key === 'Enter') {
      sendBtn.click();
    }
  });

  inputEl.addEventListener('input', () => {
    onMentionInput();
    const has = !!inputEl.value.trim();
    sendTyping(has);
  });
  inputEl.addEventListener('blur', () => { sendTyping(false); });

  // Route-based init: landing at '/', chat at '/chat'
  try {
    const path = (location.pathname || '').replace(/\/+$/, '') || '/';
    const isChatRoute = path === '/chat';
    const params = new URLSearchParams(location.search);
    const r = params.get('room');
    const a = params.get('alias');
    const auto = params.get('autojoin');
    const code = params.get('code');
    if (r) roomEl.value = r;
    if (a) aliasEl.value = a;
    if (code && loginCode) loginCode.value = code;
    if (code && loginPrivate) loginPrivate.checked = true;
    const btnCopyCodeInit = document.getElementById('btnCopyCode');
    if (btnCopyCodeInit && loginPrivate && loginPrivate.checked && loginCode && loginCode.value) btnCopyCodeInit.disabled = false;
    if (loginRoom && !loginRoom.value) loginRoom.value = r || localStorage.getItem('ac:lastRoom') || '';
    if (loginAlias && !loginAlias.value) loginAlias.value = a || localStorage.getItem('ac:lastAlias') || '';
    if (isChatRoute) {
      const remember = localStorage.getItem('ac:remember') === '1';
      const rememberedRoom = localStorage.getItem('ac:lastRoom') || '';
      const rememberedAlias = localStorage.getItem('ac:lastAlias') || '';
      if (rememberSession) rememberSession.checked = remember;
      if ((r && a && auto === '1') || (remember && rememberedRoom && rememberedAlias)) {
        window.__quietJoin = true;
        doLogin();
      } else {
        showOverlay();
      }
    } else {
      // Always show landing on root or other routes
      hideOverlay();
      showLanding();
    }
  } catch (_) {}
  // Strongly enforce initial hidden state for banners and DM panels
  hideComposerBanners();
  hideDmThread();
  hideDmsPanel();
  // Show landing by default if overlay not shown yet
  if (!(window.__quietJoin)) showLanding();
})();
