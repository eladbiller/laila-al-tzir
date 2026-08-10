const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const wordsDB = {
  yellow: ['אסטרונאוט','כבאי','קוסם','מגדל אייפל','מגדלור','רופא שיניים','ליצן','פירמידה','דייג','מציל','שוטר','טבח','ספרייה','קולנוע','בית חולים','קרקס','גן חיות','מדען','חשמלאי','אריה','פיל','נחש','פינגווין','דולפין','קוף','גמל','דבורה','ג׳ירפה','זברה','תנין','כריש','לווייתן','קיפוד','פנדה'],
  blue: ['קומקום','טלסקופ','מנגל','מקדחה','חנוכייה','סקייטבורד','משקפת','מצפן','מזלג','מספריים','מקרר','גיטרה','מפתח','נורה','ארנק','מטרייה','מצלמה','פטיש','אופניים','כדור פורח','סולם','מגהץ','מיקרוגל','שואב אבק','מייבש שיער','מברג','פנס','קורקינט','כינור','פסנתר','מכחול','אוהל','מחשב נייד','שעון חול'],
  orange: ['לגהץ','לקפוץ בחבל','לגלוש גלים','לצחצח שיניים','לטפס על הר','לאפות עוגה','להפריח בועות','לצבוע קיר','להשקות עציץ','לדוג','לרכוב על אופניים','לרקוד','לשרוק','להחליק על הקרח','לצנוח','לשחק טניס','לצלול','לתפור','לנגן בפסנתר','לבשל','לצלם','לקרוא ספר','לנקות חלון','לשיר','לרוץ','לישון','לבכות','לצחוק','להתעטש','לפהק','להרים משקולות','ללחוץ יד','לחבק','למחוא כפיים'],
  green: ['חור תולעת','מערבולת','הד','צלליות','כוח משיכה','מיגרנה','נוסטלגיה','אי הבנה','תקווה','חלום בלהות','סערת רגשות','זיכרון','הפתעה','סוד','שיווי משקל','אשליה אופטית','חופש','מחשבה','הצלחה','פחד','אהבה','דמיון','גורל','תורת היחסות','מגנטיות','פוטוסינתזה','אבולוציה','חשמל סטטי','אופק','סבלנות','סקרנות','נדיבות','קנאה','גאווה'],
  red: ['רעידת אדמה','אסטרונאוט','קומקום','סקייטבורד','שטיח מעופף','להפריח בועות','לצנוח','כוח משיכה','סופת שלגים','ליקוי חמה','התפרצות הר געש','חתונה','שריפה','נחיתה על הירח','טורנדו','שיטפון','פסטיבל','הופעת רוק','תחרות ריצה','מסע בזמן','צונאמי','מפולת שלגים','נפילת מטאור','אריה','דולפין','מגלשת מים','גלגל ענק','מסיבת הפתעה']
};

const categories = {
  yellow: '🦁 אנשים, מקומות וחיות', blue: '📦 חפצים', orange: '🏃 פעולות', green: '🧩 קשה', red: '🔥 All Play'
};

const game = {
  mode: null, peer: null, roomCode: '', connections: new Map(), clientConnection: null, clientId: '',
  players: [], rounds: 8, round: 0, activeIndex: 0, phase: 'lobby', seconds: 60,
  category: '', word: '', privateWord: '', timer: null, history: [], lastPoints: {}, localPlayers: []
};

let toastTimer;
const sharedCanvas = $('#shared-canvas');
const phoneCanvas = $('#phone-canvas');

function show(viewId) {
  $$('.view').forEach((view) => view.classList.toggle('is-active', view.id === viewId));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toast(message) {
  const element = $('#toast');
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove('show'), 3200);
}

function safeName(value, fallback) {
  return value.trim().replace(/\s+/g, ' ').slice(0, 20) || fallback;
}

function normalizeCode(value) { return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6); }
function randomCode() { return Math.random().toString(36).slice(2, 8).toUpperCase(); }
function activePlayer() { return game.players[game.activeIndex]; }
function activeId() { return activePlayer()?.id; }

function makePlayer(name, id = `local-${globalThis.crypto?.randomUUID?.() || Date.now()}`) {
  return { id, name: safeName(name, 'שחקן'), score: 0, online: true };
}

function publicState() {
  return {
    players: game.players.map((player) => ({ id: player.id, name: player.name, score: player.score, online: player.online })),
    rounds: game.rounds, round: game.round, activeIndex: game.activeIndex, activeId: activeId(), phase: game.phase,
    seconds: game.seconds, category: game.category, revealedWord: ['review', 'finished'].includes(game.phase) ? game.word : '',
    roomCode: game.roomCode
  };
}

function send(connection, payload) {
  if (connection?.open) connection.send(payload);
}

function broadcast(payload, exceptId = '') {
  game.connections.forEach((connection, id) => { if (id !== exceptId) send(connection, payload); });
}

function broadcastState() {
  if (game.mode === 'host') broadcast({ type: 'state', state: publicState() });
}

function syncState(state) {
  Object.assign(game, {
    players: state.players || [], rounds: state.rounds || 8, round: state.round || 0, activeIndex: state.activeIndex || 0,
    phase: state.phase || 'lobby', seconds: Number.isFinite(state.seconds) ? state.seconds : 60, category: state.category || '',
    revealedWord: state.revealedWord || '', roomCode: state.roomCode || game.roomCode
  });
}

function prepareCanvas(canvas) {
  const bounds = canvas.getBoundingClientRect();
  const ratio = Math.max(1, window.devicePixelRatio || 1);
  const width = Math.max(1, Math.floor(bounds.width * ratio));
  const height = Math.max(1, Math.floor(bounds.height * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width; canvas.height = height;
    canvas.getContext('2d').setTransform(ratio, 0, 0, ratio, 0, 0);
  }
  clearCanvas(canvas);
}

function clearCanvas(canvas) {
  const context = canvas.getContext('2d');
  const bounds = canvas.getBoundingClientRect();
  context.save(); context.setTransform(1, 0, 0, 1, 0, 0); context.fillStyle = '#f8fbff'; context.fillRect(0, 0, canvas.width, canvas.height); context.restore();
  context.fillStyle = '#f8fbff';
  if (!bounds.width) return;
}

function pointOnCanvas(canvas, event) {
  const bounds = canvas.getBoundingClientRect();
  return { x: Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)), y: Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height)) };
}

function drawStroke(canvas, stroke, key) {
  const context = canvas.getContext('2d');
  const bounds = canvas.getBoundingClientRect();
  const point = { x: stroke.x * bounds.width, y: stroke.y * bounds.height };
  context.strokeStyle = stroke.color || '#172554'; context.lineWidth = stroke.size || 5; context.lineCap = 'round'; context.lineJoin = 'round';
  if (stroke.kind === 'start' || !game.lastPoints[key]) {
    context.beginPath(); context.moveTo(point.x, point.y); context.lineTo(point.x + .01, point.y + .01); context.stroke();
  } else {
    context.beginPath(); context.moveTo(game.lastPoints[key].x, game.lastPoints[key].y); context.lineTo(point.x, point.y); context.stroke();
  }
  game.lastPoints[key] = point;
  if (stroke.kind === 'end') delete game.lastPoints[key];
}

function clearDrawing(sendToPeers = true) {
  game.history = []; game.lastPoints = {};
  prepareCanvas(sharedCanvas); prepareCanvas(phoneCanvas);
  if (sendToPeers && game.mode === 'host') broadcast({ type: 'clear' });
  if (sendToPeers && game.mode === 'client') send(game.clientConnection, { type: 'clear' });
}

function redrawShared() {
  prepareCanvas(sharedCanvas); game.lastPoints = {};
  game.history.forEach((stroke) => drawStroke(sharedCanvas, stroke, `shared-${stroke.playerId || 'local'}`));
}

function renderPlayers(container, lobby = false) {
  container.replaceChildren();
  game.players.forEach((player, index) => {
    const card = document.createElement('div');
    card.className = lobby ? 'player-chip' : `score-card ${index === game.activeIndex && game.phase !== 'finished' ? 'is-active' : ''}`;
    if (lobby) card.textContent = player.name;
    else { const name = document.createElement('span'); name.textContent = player.name; const score = document.createElement('strong'); score.textContent = player.score; card.append(name, score); }
    container.append(card);
  });
}

function renderLobby() {
  $('#room-code-display').textContent = game.roomCode || '------';
  renderPlayers($('#lobby-players'), true);
  $('#start-game-button').disabled = game.players.length < 2;
}

function renderGame() {
  const player = activePlayer();
  $('#round-counter').textContent = game.phase === 'finished' ? 'המשחק הסתיים' : `סבב ${Math.min(game.round + (game.phase === 'idle' ? 1 : 0), game.rounds)} / ${game.rounds}`;
  $('#timer-display').textContent = String(game.seconds).padStart(2, '0');
  $('#category-label').textContent = game.category ? categories[game.category] : 'בחירת קטגוריה';
  $('#turn-banner').textContent = game.phase === 'finished' ? 'כל הכבוד! יש לנו מנצח/ת.' : player ? `התור של ${player.name} לצייר` : 'מחכים לשחקנים…';
  const stageTitle = $('#stage-title'); const status = $('#secret-status'); const reveal = $('#word-reveal');
  stageTitle.textContent = game.phase === 'drawing' ? 'הציור עולה למסך בזמן אמת' : game.phase === 'review' ? 'הזמן נגמר — מה הייתה המילה?' : game.phase === 'finished' ? 'סיכום המשחק' : 'הלוח מוכן לסבב הבא';
  status.textContent = game.phase === 'drawing' ? (game.mode === 'local' ? `🎨 לצייר/ת בלבד: ${game.word}` : '🔒 המילה הסודית מופיעה רק בטלפון של הצייר.') : game.phase === 'review' ? '✦ חשפו את התשובה ובחרו אם הניחוש הצליח.' : 'בחרו קטגוריה והתחילו כשכולם מוכנים.';
  const revealed = game.revealedWord || (['review', 'finished'].includes(game.phase) ? game.word : '');
  reveal.hidden = !revealed; $('#revealed-word').textContent = revealed || '—';
  renderPlayers($('#scoreboard'));
  const primary = $('#host-primary-button'); const review = $('#review-actions'); const select = $('#category-select');
  const isHostScreen = game.mode === 'host' || game.mode === 'local';
  $('#host-controls').hidden = !isHostScreen;
  if (!isHostScreen) return;
  select.disabled = game.phase !== 'idle'; review.hidden = game.phase !== 'review';
  primary.disabled = ['review', 'finished'].includes(game.phase);
  primary.textContent = game.phase === 'drawing' ? 'סיום סבב ⏹' : game.phase === 'finished' ? 'המשחק הסתיים' : 'התחל סבב ▶';
  $('#host-help').textContent = game.phase === 'drawing' ? `מצייר/ת עכשיו: ${player?.name || ''}. כשהזמן נגמר אפשר להכריע.` : game.phase === 'review' ? 'האם הקבוצה ניחשה את המילה?' : game.phase === 'finished' ? 'לחצו על סיום משחק כדי לחזור לתפריט.' : `הסבב הבא: ${player?.name || '—'}. המילה תגיע לצייר בלבד.`;
}

function renderPhone() {
  const player = game.players.find((item) => item.id === game.clientId);
  const isActive = player && player.id === activeId();
  const isDrawing = game.phase === 'drawing' && isActive && game.privateWord;
  show('phone-view');
  $('#phone-timer').textContent = String(game.seconds).padStart(2, '0');
  $('#phone-category').textContent = game.category ? categories[game.category] : 'קטגוריה';
  $('#phone-word').textContent = game.privateWord || '—';
  $('#phone-wait').hidden = Boolean(isDrawing); $('#phone-draw').hidden = !isDrawing;
  if (isDrawing) { $('#phone-title').textContent = 'זה התור שלכם!'; $('#phone-message').textContent = 'שמרו את המילה בסוד וציירו על הלוח.'; }
  else {
    $('#phone-title').textContent = game.phase === 'finished' ? 'המשחק הסתיים!' : player ? 'אתם בחדר!' : 'מתחברים לחדר…';
    $('#phone-message').textContent = game.phase === 'drawing' ? (isActive ? 'המילה מגיעה אליכם…' : `עכשיו ${activePlayer()?.name || 'שחקן'} מצייר/ת. נחשו מהמסך הגדול!`) : game.phase === 'review' ? `התשובה: ${game.revealedWord || '—'}` : 'חכו שהמארח יתחיל את הסבב הבא.';
  }
}

function updateViews() { if (game.mode === 'client') renderPhone(); else if (game.mode) renderGame(); }

function chooseWord() {
  const selected = $('#category-select').value;
  game.category = selected === 'random' ? Object.keys(wordsDB)[Math.floor(Math.random() * Object.keys(wordsDB).length)] : selected;
  const pool = wordsDB[game.category]; game.word = pool[Math.floor(Math.random() * pool.length)]; game.privateWord = game.word;
}

function startGame() {
  if (game.players.length < 2) return toast('צריך לפחות שני שחקנים כדי להתחיל.');
  game.round = 0; game.activeIndex = 0; game.phase = 'idle'; game.seconds = 60; game.word = ''; game.revealedWord = ''; clearDrawing(false);
  show('game-view'); renderGame(); broadcastState();
}

function sendSecretWord() {
  const id = activeId();
  if (game.mode === 'host') send(game.connections.get(id), { type: 'secret', word: game.word });
}

function beginRound() {
  if (game.phase === 'drawing') return endRound();
  if (game.phase !== 'idle') return;
  game.round += 1; game.seconds = 60; game.revealedWord = ''; chooseWord(); clearDrawing(false); game.phase = 'drawing';
  if (game.mode === 'host') { broadcast({ type: 'clear' }); broadcastState(); sendSecretWord(); }
  renderGame();
  clearInterval(game.timer);
  game.timer = setInterval(() => {
    game.seconds -= 1; renderGame(); broadcastState();
    if (game.seconds <= 0) endRound();
  }, 1000);
}

function endRound() {
  if (game.phase !== 'drawing') return;
  clearInterval(game.timer); game.timer = null; game.seconds = 0; game.phase = 'review'; game.revealedWord = game.word; game.privateWord = '';
  renderGame(); broadcastState();
}

function resolveRound(correct) {
  if (game.phase !== 'review') return;
  if (correct && activePlayer()) activePlayer().score += 1;
  if (game.round >= game.rounds) { game.phase = 'finished'; renderGame(); broadcastState(); return; }
  game.activeIndex = (game.activeIndex + 1) % game.players.length; game.phase = 'idle'; game.seconds = 60; game.word = ''; game.revealedWord = ''; game.privateWord = ''; clearDrawing(false); renderGame(); broadcastState();
}

function hostReceive(connection, message) {
  if (!message?.type) return;
  if (message.type === 'join') {
    const id = connection.peer;
    let player = game.players.find((item) => item.id === id);
    if (!player) { player = makePlayer(message.name, id); game.players.push(player); } else { player.online = true; player.name = safeName(message.name, player.name); }
    game.connections.set(id, connection); send(connection, { type: 'welcome', playerId: id }); send(connection, { type: 'state', state: publicState() }); renderLobby(); broadcastState();
    toast(`${player.name} הצטרף/ה לחדר`); return;
  }
  if (message.type === 'stroke' && game.phase === 'drawing' && connection.peer === activeId()) {
    const stroke = { ...message.stroke, playerId: connection.peer }; game.history.push(stroke); drawStroke(sharedCanvas, stroke, `shared-${connection.peer}`); broadcast({ type: 'stroke', stroke }, connection.peer);
  }
  if (message.type === 'clear' && connection.peer === activeId()) { clearDrawing(false); broadcast({ type: 'clear' }, connection.peer); }
}

function clientReceive(message) {
  if (!message?.type) return;
  if (message.type === 'welcome') { game.clientId = message.playerId; return; }
  if (message.type === 'state') { syncState(message.state); if (game.phase !== 'drawing' || activeId() !== game.clientId) game.privateWord = ''; renderPhone(); }
  if (message.type === 'secret') { game.privateWord = message.word; renderPhone(); }
  if (message.type === 'clear') { game.history = []; game.lastPoints = {}; prepareCanvas(phoneCanvas); }
}

function createRoom() {
  if (!window.Peer) return toast('לא ניתן לטעון את שירות החיבור. בדקו את החיבור לאינטרנט.');
  game.mode = 'host'; game.rounds = Number($('#round-picker .is-selected').dataset.rounds); game.roomCode = randomCode(); game.players = []; game.connections = new Map();
  const createPeer = () => {
    game.peer = new Peer(`pictionary-${game.roomCode.toLowerCase()}`);
    game.peer.on('open', () => {
      $('#room-code-display').textContent = game.roomCode; show('lobby-view'); renderLobby(); renderQR();
    });
    game.peer.on('connection', (connection) => {
      connection.on('data', (message) => hostReceive(connection, message));
      connection.on('close', () => { const player = game.players.find((item) => item.id === connection.peer); if (player) player.online = false; game.connections.delete(connection.peer); broadcastState(); renderLobby(); });
      connection.on('error', () => toast('חיבור של שחקן נותק.'));
    });
    game.peer.on('error', (error) => {
      if (error.type === 'unavailable-id') { game.roomCode = randomCode(); createPeer(); }
      else toast('לא הצלחנו לפתוח חדר. נסו שוב.');
    });
  };
  createPeer();
}

function renderQR() {
  const frame = $('#qr-code'); frame.replaceChildren();
  const joinUrl = `${location.origin}${location.pathname}?join=${game.roomCode}`;
  if (window.QRCode) new QRCode(frame, { text: joinUrl, width: 190, height: 190, colorDark: '#101a35', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M });
  else frame.textContent = joinUrl;
}

function joinRoom() {
  if (!window.Peer) return toast('לא ניתן לטעון את שירות החיבור. בדקו את החיבור לאינטרנט.');
  const name = safeName($('#join-name').value, 'שחקן'); const code = normalizeCode($('#room-code-input').value);
  if (!code) return toast('הזינו קוד חדר.');
  game.mode = 'client'; game.roomCode = code; $('#join-status').textContent = 'מתחברים לחדר…';
  game.peer = new Peer();
  game.peer.on('open', () => {
    const connection = game.peer.connect(`pictionary-${code.toLowerCase()}`, { reliable: true }); game.clientConnection = connection;
    connection.on('open', () => { $('#join-status').textContent = 'מחובר!'; send(connection, { type: 'join', name }); });
    connection.on('data', clientReceive);
    connection.on('close', () => { $('#phone-connection').textContent = '● החיבור נותק'; $('#phone-connection').style.color = '#fb7185'; });
    connection.on('error', () => { $('#join-status').textContent = 'לא הצלחנו להתחבר. ודאו שהקוד נכון והמסך פתוח.'; });
  });
  game.peer.on('error', () => { $('#join-status').textContent = 'לא נמצא חדר כזה. בדקו את הקוד.'; });
}

function startLocalGame() {
  if (game.localPlayers.length < 2) return toast('הוסיפו לפחות שני שחקנים.');
  game.mode = 'local'; game.players = game.localPlayers.map((player) => ({ ...player, score: 0 })); game.rounds = 8; game.activeIndex = 0; game.phase = 'idle'; startGame();
}

function emitPhoneStroke(stroke) {
  drawStroke(phoneCanvas, stroke, 'phone-local'); send(game.clientConnection, { type: 'stroke', stroke });
}

function bindDrawing(canvas, onStroke, allowed) {
  let drawing = false;
  const emit = (kind, event) => {
    const point = pointOnCanvas(canvas, event); onStroke({ kind, ...point, color: '#172554', size: 5 });
  };
  canvas.addEventListener('pointerdown', (event) => { if (!allowed()) return; drawing = true; canvas.setPointerCapture(event.pointerId); emit('start', event); });
  canvas.addEventListener('pointermove', (event) => { if (drawing && allowed()) emit('move', event); });
  canvas.addEventListener('pointerup', (event) => { if (!drawing) return; emit('end', event); drawing = false; });
  canvas.addEventListener('pointercancel', () => { drawing = false; });
}

function bindEvents() {
  $('#open-host-setup').onclick = () => show('host-setup-view');
  $('#open-join-setup').onclick = () => show('join-setup-view');
  $('#open-local-setup').onclick = () => show('local-setup-view');
  $$('.back-link').forEach((button) => button.onclick = () => show(button.dataset.go));
  $('#fullscreen-button').onclick = () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.();
  $$('#round-picker button').forEach((button) => button.onclick = () => { $$('#round-picker button').forEach((item) => item.classList.remove('is-selected')); button.classList.add('is-selected'); });
  $('#create-room-button').onclick = createRoom;
  $('#join-room-button').onclick = joinRoom;
  $('#room-code-input').addEventListener('input', (event) => { event.target.value = normalizeCode(event.target.value); });
  $('#copy-room-button').onclick = async () => { try { await navigator.clipboard.writeText(game.roomCode); toast('קוד החדר הועתק.'); } catch { toast(`קוד החדר: ${game.roomCode}`); } };
  $('#add-demo-player-button').onclick = () => { game.players.push(makePlayer(`שחקן ${game.players.length + 1}`, `demo-${Date.now()}`)); renderLobby(); toast('שחקן דוגמה נוסף — למשחק אמיתי הצטרפו מהטלפון.'); };
  $('#start-game-button').onclick = startGame;
  $('#host-primary-button').onclick = beginRound;
  $('#correct-button').onclick = () => resolveRound(true); $('#skip-button').onclick = () => resolveRound(false);
  $('#leave-game-button').onclick = () => { clearInterval(game.timer); game.peer?.destroy?.(); location.href = location.pathname; };
  $('#add-local-player-button').onclick = () => { const input = $('#local-player-name'); const name = safeName(input.value, ''); if (!name) return toast('כתבו שם לשחקן.'); if (game.localPlayers.length >= 6) return toast('אפשר עד שישה שחקנים.'); game.localPlayers.push(makePlayer(name)); input.value = ''; renderLocalPlayers(); };
  $('#local-player-name').addEventListener('keydown', (event) => { if (event.key === 'Enter') $('#add-local-player-button').click(); });
  $('#start-local-game-button').onclick = startLocalGame;
  $('#phone-clear-button').onclick = () => clearDrawing(true);
  bindDrawing(phoneCanvas, emitPhoneStroke, () => game.mode === 'client' && game.phase === 'drawing' && activeId() === game.clientId && Boolean(game.privateWord));
  bindDrawing(sharedCanvas, (stroke) => { stroke.playerId = 'local'; game.history.push(stroke); drawStroke(sharedCanvas, stroke, 'shared-local'); }, () => game.mode === 'local' && game.phase === 'drawing');
  window.addEventListener('resize', () => { if (game.mode !== 'client') redrawShared(); });
}

function renderLocalPlayers() {
  const container = $('#local-players'); container.replaceChildren(); game.localPlayers.forEach((player) => { const chip = document.createElement('div'); chip.className = 'player-chip'; chip.textContent = player.name; container.append(chip); }); $('#start-local-game-button').disabled = game.localPlayers.length < 2;
}

function init() {
  bindEvents(); prepareCanvas(sharedCanvas); prepareCanvas(phoneCanvas);
  const joinCode = normalizeCode(new URLSearchParams(location.search).get('join') || '');
  if (joinCode) { $('#room-code-input').value = joinCode; show('join-setup-view'); }
}

init();
