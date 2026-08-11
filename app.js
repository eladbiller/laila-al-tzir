const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const CATEGORY = {
  yellow: { name: 'אנשים, מקומות וחיות', color: '#fbbf24' },
  blue: { name: 'חפצים', color: '#60a5fa' },
  orange: { name: 'פעולות', color: '#fb923c' },
  green: { name: 'קשה', color: '#34d399' },
  red: { name: 'All Play', color: '#fb7185' }
};

const WORDS = {
  yellow: ['אסטרונאוט','כבאי','קוסם','מגדל אייפל','מגדלור','רופא שיניים','ליצן','פירמידה','דייג','מציל','שוטר','טבח','ספרייה','קולנוע','בית חולים','קרקס','גן חיות','מדען','חשמלאי','אריה','פיל','נחש','פינגווין','דולפין','קוף','גמל','דבורה','ג׳ירפה','זברה','תנין','כריש','לווייתן','קיפוד','פנדה'],
  blue: ['קומקום','טלסקופ','מנגל','מקדחה','חנוכייה','סקייטבורד','משקפת','מצפן','מזלג','מספריים','מקרר','גיטרה','מפתח','נורה','ארנק','מטרייה','מצלמה','פטיש','אופניים','כדור פורח','סולם','מגהץ','מיקרוגל','שואב אבק','מייבש שיער','מברג','פנס','קורקינט','כינור','פסנתר','מכחול','אוהל','מחשב נייד','שעון חול'],
  orange: ['לגהץ','לקפוץ בחבל','לגלוש גלים','לצחצח שיניים','לטפס על הר','לאפות עוגה','להפריח בועות','לצבוע קיר','להשקות עציץ','לדוג','לרכוב על אופניים','לרקוד','לשרוק','להחליק על הקרח','לצנוח','לשחק טניס','לצלול','לתפור','לנגן בפסנתר','לבשל','לצלם','לקרוא ספר','לנקות חלון','לשיר','לרוץ','לישון','לבכות','לצחוק','להתעטש','לפהק','להרים משקולות','ללחוץ יד','לחבק','למחוא כפיים'],
  green: ['חור תולעת','מערבולת','הד','צלליות','כוח משיכה','מיגרנה','נוסטלגיה','אי הבנה','תקווה','חלום בלהות','סערת רגשות','זיכרון','הפתעה','סוד','שיווי משקל','אשליה אופטית','חופש','מחשבה','הצלחה','פחד','אהבה','דמיון','גורל','תורת היחסות','מגנטיות','פוטוסינתזה','אבולוציה','חשמל סטטי','אופק','סבלנות','סקרנות','נדיבות','קנאה','גאווה'],
  red: ['רעידת אדמה','מסיבת הפתעה','סוף העולם','טיסה לחלל','שטיח מעופף','סופת שלגים','ליקוי חמה','התפרצות הר געש','חתונה','נחיתה על הירח','טורנדו','שיטפון','פסטיבל','הופעת רוק','מסע בזמן','צונאמי','מפולת שלגים','נפילת מטאור','הצלת העולם','קרנבל','קרב אבירים','מסע בים','שיגור טיל','תעלומה','תחרות ריצה']
};

const TEAM_COLORS = ['#38bdf8','#f472b6','#fbbf24','#34d399','#a78bfa','#fb923c','#fb7185','#22d3ee'];
const PATH = [
  [10,82,'yellow','START'],[20,88,'blue'],[32,89,'orange'],[44,89,'green'],[56,89,'red'],[69,87,'yellow'],[80,82,'blue'],[88,73,'orange'],
  [90,61,'green'],[89,49,'red'],[90,37,'yellow'],[85,26,'blue'],[77,18,'orange'],[66,12,'green'],[54,10,'red'],[42,11,'yellow'],[30,15,'blue'],[19,23,'orange'],
  [11,34,'green'],[9,46,'red'],[11,58,'yellow'],[19,67,'blue'],[30,71,'orange'],[42,70,'green'],[54,65,'red'],[63,56,'yellow'],[61,46,'blue'],[52,39,'orange'],[42,40,'green'],[33,47,'red'],[31,57,'yellow'],[40,62,'blue'],[50,56,'orange','FINISH']
].map(([x,y,category,mark]) => ({ x, y, category, mark: mark || '' }));
const FINISH = PATH.length - 1;

const game = {
  mode: null, peer: null, roomCode: '', connections: new Map(), teams: [], turnIndex: 0, phase: 'lobby',
  category: '', word: '', seconds: 60, timer: null, strokes: [], usedWords: new Set(), finalTeamId: '',
  finalAllPlay: false, allPlayReady: {}, lastRoll: null, winnerId: ''
};
const client = { teamId: '', reconnectKey: '', pairName: '', connection: null, reconnectTimer: null, reconnectAttempts: 0, canvasOpen: false, canvasReady: false, localStrokes: [], lastWord: '', lastPhase: '', connected: false };
let toastTimer;

const sharedCanvas = $('#viewer-canvas');
const pairCanvas = $('#pair-canvas');

function show(viewId) { const changed = !document.getElementById(viewId)?.classList.contains('is-active'); $$('.view').forEach((view) => view.classList.toggle('is-active', view.id === viewId)); if (changed) window.scrollTo({ top: 0, behavior: 'smooth' }); }
function toast(message) { const el = $('#toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2800); }
function randomCode() { return Math.random().toString(36).slice(2, 8).toUpperCase(); }
function randomId() { return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function normalizeCode(value) { return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6); }
function cleanName(value, fallback = '') { return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 20) || fallback; }
function activeTeam() { return game.teams[game.turnIndex]; }
function isAllPlayPhase() { return ['allplay-word','allplay-resolve'].includes(game.phase); }
function currentTile(team = activeTeam()) { return PATH[team?.position || 0] || PATH[0]; }
function teamColor(index) { return TEAM_COLORS[index % TEAM_COLORS.length]; }
function deviceKey() { return new URLSearchParams(location.search).get('device') || 'main'; }
function storageName() { return `pictionary-device-${deviceKey()}`; }
function readSavedDevice() { try { return JSON.parse(localStorage.getItem(storageName()) || 'null'); } catch { return null; } }
function saveDevice() { localStorage.setItem(storageName(), JSON.stringify({ roomCode: game.roomCode, teamId: client.teamId, reconnectKey: client.reconnectKey, pairName: client.pairName })); }

function visible(element, value) { element.hidden = !value; }
function categoryStyle(element, category) { element.style.setProperty('--category', CATEGORY[category]?.color || '#fbbf24'); }
function setReveal(element, shown) { element.classList.toggle('is-revealed', shown); }

function snapshot() {
  return { roomCode: game.roomCode, teams: game.teams.map((team) => ({ id: team.id, name: team.name, position: team.position, online: team.online, color: team.color })), turnIndex: game.turnIndex, phase: game.phase, category: game.category, word: game.word, seconds: game.seconds, strokes: game.strokes, finalTeamId: game.finalTeamId, finalAllPlay: game.finalAllPlay, allPlayReady: game.allPlayReady, lastRoll: game.lastRoll, winnerId: game.winnerId };
}
function send(connection, message) { if (connection?.open) connection.send(message); }
function broadcast(message, exclude = '') { game.connections.forEach((connection, id) => { if (id !== exclude) send(connection, message); }); }
function broadcastState() { if (game.mode === 'host') broadcast({ type: 'state', state: snapshot() }); }
function applySnapshot(state) {
  game.roomCode = state.roomCode || game.roomCode; game.teams = state.teams || []; game.turnIndex = state.turnIndex || 0; game.phase = state.phase || 'lobby'; game.category = state.category || ''; game.word = state.word || ''; game.seconds = Number.isFinite(state.seconds) ? state.seconds : 60; game.strokes = state.strokes || []; game.finalTeamId = state.finalTeamId || ''; game.finalAllPlay = Boolean(state.finalAllPlay); game.allPlayReady = state.allPlayReady || {}; game.lastRoll = state.lastRoll || null; game.winnerId = state.winnerId || '';
}

function prepareCanvas(canvas) {
  const bounds = canvas.getBoundingClientRect(); const ratio = Math.max(1, window.devicePixelRatio || 1); const width = Math.max(1, Math.floor(bounds.width * ratio)); const height = Math.max(1, Math.floor(bounds.height * ratio));
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  const ctx = canvas.getContext('2d'); ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 0, bounds.width, bounds.height);
}
function clearCanvas(canvas) { prepareCanvas(canvas); }
function canvasPoint(canvas, event) { const b = canvas.getBoundingClientRect(); return { x: Math.max(0, Math.min(1, (event.clientX - b.left) / b.width)), y: Math.max(0, Math.min(1, (event.clientY - b.top) / b.height)) }; }
function drawStroke(canvas, stroke, previous) {
  const ctx = canvas.getContext('2d'); const b = canvas.getBoundingClientRect(); const point = { x: stroke.x * b.width, y: stroke.y * b.height }; ctx.strokeStyle = '#172554'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); if (stroke.kind === 'start' || !previous.point) { ctx.moveTo(point.x, point.y); ctx.lineTo(point.x + .01, point.y + .01); } else { ctx.moveTo(previous.point.x, previous.point.y); ctx.lineTo(point.x, point.y); } ctx.stroke(); previous.point = stroke.kind === 'end' ? null : point;
}
function redrawViewer() { if (!sharedCanvas.offsetParent) return; prepareCanvas(sharedCanvas); const points = {}; game.strokes.forEach((stroke) => { points[stroke.teamId] ||= {}; drawStroke(sharedCanvas, stroke, points[stroke.teamId]); }); }
function resetPairCanvas() { prepareCanvas(pairCanvas); client.canvasReady = true; client.localStrokes = []; }

function renderBoard() {
  const board = $('#game-board'); board.replaceChildren();
  const centre = document.createElement('div'); centre.className = 'board-centre';
  const centreKicker = document.createElement('span'); centreKicker.textContent = 'DRAW · GUESS · MOVE';
  const centreTitle = document.createElement('strong'); centreTitle.textContent = 'PICTIONARY';
  const centreRule = document.createElement('small'); centreRule.textContent = 'ציירו • נחשו • נצחו';
  centre.append(centreKicker, centreTitle, centreRule); board.append(centre);
  const symbols = { yellow: '●', blue: '◆', orange: '▲', green: '✦', red: '★' };
  PATH.forEach((space) => { const item = document.createElement('div'); item.className = `board-space ${space.category} ${space.mark === 'START' ? 'start' : ''} ${space.mark === 'FINISH' ? 'finish' : ''}`; item.style.left = `${space.x}%`; item.style.top = `${space.y}%`; item.dataset.mark = space.mark || symbols[space.category]; board.append(item); });
  const groups = new Map(); game.teams.forEach((team, index) => { const list = groups.get(team.position) || []; list.push({ team, index }); groups.set(team.position, list); });
  groups.forEach((items, position) => { const space = PATH[position]; const stack = document.createElement('div'); stack.className = 'token-stack'; stack.style.left = `${space.x}%`; stack.style.top = `${space.y}%`; items.forEach(({ team, index }) => { const token = document.createElement('span'); token.className = `token ${team.id === activeTeam()?.id && !['lobby','gameover'].includes(game.phase) ? 'active' : ''} ${team.online ? '' : 'offline'}`; token.style.setProperty('--team-color', team.color || teamColor(index)); token.title = team.name; stack.append(token); }); board.append(stack); });
}
function renderTeamChips(container, detailed = false) {
  container.replaceChildren(); game.teams.forEach((team, index) => { const chip = document.createElement('div'); chip.className = `team-chip ${team.id === activeTeam()?.id && game.phase !== 'gameover' ? 'active' : ''} ${team.online ? '' : 'offline'}`; chip.style.setProperty('--team-color', team.color || teamColor(index)); chip.textContent = detailed ? `${team.name} · ${team.position === FINISH ? 'סיום' : team.position}` : team.name; container.append(chip); });
}
function phaseText() {
  if (game.phase === 'final-awaiting') return 'All Play אחרון'; if (game.phase.startsWith('allplay')) return 'All Play'; if (game.phase === 'word') return 'כרטיס נשלח'; if (game.phase === 'drawing') return 'ציור חי'; if (game.phase.includes('resolve')) return 'הכרעה'; if (game.phase === 'rolling') return 'קובייה'; if (game.phase === 'gameover') return 'ניצחון'; return 'תור רגיל';
}
function boardTurnText() {
  const team = activeTeam(); if (game.phase === 'gameover') return `${game.teams.find((item) => item.id === game.winnerId)?.name || ''} ניצחו!`; if (!team) return 'מחכים לזוגות'; if (game.phase === 'drawing') return `${team.name} מציירים`; if (game.phase === 'normal-resolve') return 'האם הצליחו לנחש?'; if (game.phase === 'allplay-resolve') return 'מי הצליח ב־All Play?'; if (game.phase === 'rolling') return 'מגלגלים קובייה…'; if (game.phase === 'allplay-word') return 'All Play — כולם מציירים'; if (game.phase === 'final-awaiting') return `${team.name}: All Play אחרון`; return `${team.name} בתור`;
}
function setBoardActions() {
  const area = $('#board-actions'); area.replaceChildren(); const message = document.createElement('p'); const team = activeTeam();
  const addButton = (label, action, cls = 'secondary-button') => { const button = document.createElement('button'); button.type = 'button'; button.className = cls; button.textContent = label; button.onclick = action; controls.append(button); };
  const controls = document.createElement('div'); controls.className = 'context-actions';
  if (game.phase === 'awaiting' || game.phase === 'final-awaiting') { message.textContent = team?.online ? 'הזוג הפעיל מתחיל את התור מהטלפון שלו.' : 'הזוג הפעיל מנותק — אפשר לדלג עליו.'; if (!team?.online) addButton('דלגו על הזוג המנותק', () => nextTurn(), 'danger-button'); }
  else if (game.phase === 'word') message.textContent = 'הכרטיס מופיע אצל הזוגות. הזוג הפעיל פותח את לוח הציור.';
  else if (game.phase === 'drawing') { message.textContent = 'הטיימר רץ. הפעולה הזאת מופיעה רק עד שהסבב מסתיים.'; addButton('סיימו תור', endNormalDrawing, 'danger-button'); }
  else if (game.phase === 'normal-resolve') { message.textContent = 'האם הניחוש הצליח?'; addButton('✓ הצליחו — גלגלו D6', () => resolveNormal(true), 'main-button'); addButton('✕ לא הצליחו', () => resolveNormal(false), 'danger-button'); }
  else if (game.phase === 'allplay-word') { message.textContent = `All Play פעיל${game.finalAllPlay ? ' — זהו סבב הסיום!' : ''}. אין טיימר.`; addButton('סיימו All Play', finishAllPlay, 'main-button'); }
  else if (game.phase === 'allplay-resolve') {
    message.textContent = 'בחרו את הזוג שהצליח.'; const select = document.createElement('select'); select.id = 'allplay-winner'; const none = document.createElement('option'); none.value = ''; none.textContent = 'אף זוג לא הצליח'; select.append(none); game.teams.filter((item) => item.online).forEach((item) => { const option = document.createElement('option'); option.value = item.id; option.textContent = item.name; select.append(option); }); controls.append(select); addButton('הכריעו וגלגלו D6', () => resolveAllPlay(select.value), 'main-button');
  } else if (game.phase === 'rolling') { message.textContent = game.lastRoll ? 'הקובייה נקבעה.' : 'מגלגלים…'; if (game.lastRoll) { const die = document.createElement('span'); die.className = 'roll-die'; die.textContent = game.lastRoll; controls.append(die); } }
  else if (game.phase === 'gameover') { message.textContent = 'המשחק הסתיים.'; addButton('משחק חדש', resetGame, 'main-button'); }
  else message.textContent = 'הלוח מוכן.';
  area.append(message); if (controls.childElementCount) area.append(controls);
}
function renderConnectionNotice() { const offline = game.teams.filter((team) => !team.online); const notice = $('#connection-notice'); visible(notice, offline.length > 0); notice.textContent = offline.length ? `${offline.map((team) => team.name).join(', ')} מנותקים/ות. כשהם יחזרו לאותו קוד, המיקום שלהם ישוחזר.` : ''; }
function renderTools() {
  $('#tools-code').textContent = game.roomCode; const list = $('#tools-teams'); list.replaceChildren(); game.teams.forEach((team) => { const row = document.createElement('div'); row.className = 'tools-team'; const name = document.createElement('span'); name.textContent = `${team.name} — ${team.online ? 'מחוברים' : 'מנותקים'}`; row.append(name); if (!team.online) { const remove = document.createElement('button'); remove.className = 'danger-button'; remove.textContent = 'הסר'; remove.onclick = () => removeOfflineTeam(team.id); row.append(remove); } list.append(row); });
}
function renderHost() {
  show('board-view'); $('#board-phase-label').textContent = phaseText(); $('#board-turn').textContent = boardTurnText(); $('#board-status').textContent = game.finalTeamId ? `${game.teams.find((item) => item.id === game.finalTeamId)?.name || 'זוג'} הגיעו לסיום — עליהם להצליח ב־All Play כדי לנצח.` : 'הצבע של המשבצת קובע את סוג הכרטיס.'; $('#board-connection').textContent = `● ${game.teams.filter((team) => team.online).length}/${game.teams.length}`;
  const timer = $('#host-timer'); visible(timer, game.phase === 'drawing'); timer.textContent = String(game.seconds).padStart(2, '0'); renderBoard(); renderTeamChips($('#board-teams'), true); setBoardActions(); renderConnectionNotice(); renderTools(); visible($('#winner-sheet'), game.phase === 'gameover'); if (game.phase === 'gameover') $('#winner-title').textContent = `${game.teams.find((item) => item.id === game.winnerId)?.name || ''} ניצחו!`;
}
function renderLobby() { $('#room-code-display').textContent = game.roomCode; renderTeamChips($('#lobby-teams')); $('#start-game').disabled = game.teams.length < 2; }

function pairPanels() { [$('#pair-wait'), $('#pair-word'), $('#pair-draw'), $('#pair-viewer')].forEach((panel) => visible(panel, false)); }
function drawCategory(category) { const title = CATEGORY[category]?.name || ''; ['#pair-category','#draw-category','#viewer-category'].forEach((selector) => { const el = $(selector); el.textContent = title; categoryStyle(el, category); }); const viewerCategory = $('#viewer-category'); viewerCategory.style.background = CATEGORY[category]?.color || '#fbbf24'; viewerCategory.style.color = '#172554'; viewerCategory.style.padding = '5px 9px'; viewerCategory.style.borderRadius = '7px'; categoryStyle($('#hold-card'), category); categoryStyle($('#viewer-word-card'), category); }
function renderPair() {
  show('pair-view'); const mine = game.teams.find((team) => team.id === client.teamId); const active = activeTeam(); const isActive = mine?.id === active?.id; $('#pair-connection').textContent = client.connected ? '● מחובר' : '● מנסה להתחבר'; $('#pair-connection').style.color = client.connected ? '' : '#fbbf24'; pairPanels(); drawCategory(game.category);
  const wait = $('#pair-wait'), title = $('#pair-title'), message = $('#pair-message'), start = $('#pair-start-turn'); visible(start, false);
  const resetForNewWord = client.lastWord !== game.word && Boolean(game.word); if (resetForNewWord) { client.canvasOpen = false; client.canvasReady = false; client.localStrokes = []; } client.lastWord = game.word; client.lastPhase = game.phase;
  if (game.phase === 'lobby') { visible(wait, true); title.textContent = 'הצטרפתם ללוח!'; message.textContent = 'חכו שהמארח יתחיל את המשחק.'; return; }
  if (game.phase === 'gameover') { visible(wait, true); title.textContent = `${game.teams.find((team) => team.id === game.winnerId)?.name || ''} ניצחו!`; message.textContent = 'המשחק הסתיים. חזרו ללוח המארח למשחק חדש.'; return; }
  if (game.phase === 'awaiting' || game.phase === 'final-awaiting') { visible(wait, true); title.textContent = isActive ? (game.phase === 'final-awaiting' ? 'הגעתם לסיום!' : 'זה התור שלכם!') : `${active?.name || 'זוג'} בתור`; message.textContent = isActive ? (game.phase === 'final-awaiting' ? 'התחילו את ה־All Play האחרון. הצלחה שלכם תנצח את המשחק.' : 'לחצו כדי לשלוח את הכרטיס לכל הזוגות.') : 'חכו לתור שלכם וצפו בלוח.'; visible(start, isActive && mine?.online); start.textContent = game.phase === 'final-awaiting' ? 'התחילו All Play אחרון ▶' : 'התחילו תור ▶'; return; }
  if (game.phase === 'word') { if (isActive && client.canvasOpen) { renderDrawer(false); } else renderWord(isActive); return; }
  if (game.phase === 'drawing') { if (isActive) renderDrawer(true); else renderViewer(); return; }
  if (game.phase === 'allplay-word') { if (client.canvasOpen) renderDrawer(true, true); else renderWord(true, true); return; }
  if (game.phase === 'normal-resolve') { visible(wait, true); title.textContent = 'הזמן נגמר'; message.textContent = 'המארח מכריע אם הניחוש הצליח.'; return; }
  if (game.phase === 'allplay-resolve') { visible(wait, true); title.textContent = 'All Play הסתיים'; message.textContent = 'המארח בוחר את הזוג שהצליח.'; return; }
  if (game.phase === 'rolling') { visible(wait, true); title.textContent = 'מגלגלים קובייה…'; message.textContent = 'הסתכלו בלוח המארח.'; }
}
function renderWord(isActive, allPlay = false) { visible($('#pair-word'), true); $('#hold-word').textContent = game.word; $('#word-instruction').textContent = 'לחצו והחזיקו כדי לראות את המילה'; $('#word-footnote').textContent = isActive ? (allPlay ? 'אחרי פתיחת לוח הציור הכרטיס לא יחזור עד סיום ה־All Play.' : 'אחרי פתיחת לוח הציור הכרטיס ייעלם לכם עד שהסבב יסתיים.') : 'שחררו כדי להסתיר את המילה שוב.'; $('#open-pair-canvas').textContent = allPlay ? 'פתחו לוח ציור ←' : 'עברו ללוח הציור ←'; visible($('#open-pair-canvas'), isActive || allPlay); setReveal($('#hold-card'), false); }
function renderDrawer(live, allPlay = false) { visible($('#pair-draw'), true); if (!client.canvasReady) resetPairCanvas(); const begin = $('#begin-drawing'); visible(begin, !live && !allPlay); begin.textContent = 'התחילו לצייר ▶'; visible($('#pair-clock'), live); $('#pair-clock').textContent = String(game.seconds).padStart(2, '0'); $('#draw-state').textContent = allPlay ? 'All Play: ציירו בקצב שלכם. אין טיימר.' : live ? 'הטיימר פועל. ציירו מהזיכרון.' : 'זכרו את המילה. הטיימר יתחיל רק כשתלחצו.'; visible($('#return-to-word'), !live && !allPlay); }
function renderViewer() { visible($('#pair-viewer'), true); $('#viewer-clock').textContent = String(game.seconds).padStart(2, '0'); $('#viewer-word').textContent = 'החזיקו למילה'; setReveal($('#viewer-word-card'), false); redrawViewer(); }

function chooseWord(category) { const pool = WORDS[category]; const unused = pool.filter((word) => !game.usedWords.has(word)); const word = (unused.length ? unused : pool)[Math.floor(Math.random() * (unused.length ? unused.length : pool.length))]; game.usedWords.add(word); game.category = category; game.word = word; }
function clearRoundData() { game.word = ''; game.category = ''; game.strokes = []; game.seconds = 60; game.allPlayReady = {}; game.lastRoll = null; }
function hostStartGame() { if (game.teams.length < 2) return toast('צריך לפחות שני זוגות.'); game.turnIndex = 0; game.finalTeamId = ''; game.finalAllPlay = false; game.winnerId = ''; game.usedWords = new Set(); clearRoundData(); game.phase = 'awaiting'; broadcastState(); renderHost(); }
function beginTurn(teamId) {
  const team = activeTeam(); if (team?.id !== teamId || !['awaiting','final-awaiting'].includes(game.phase)) return;
  game.finalAllPlay = game.phase === 'final-awaiting'; const allPlay = game.finalAllPlay || currentTile(team).category === 'red'; chooseWord(allPlay ? 'red' : currentTile(team).category); game.phase = allPlay ? 'allplay-word' : 'word'; broadcastState(); renderHost();
}
function beginDrawing(teamId) { if (activeTeam()?.id !== teamId || game.phase !== 'word') return; game.phase = 'drawing'; game.seconds = 60; broadcastState(); renderHost(); clearInterval(game.timer); game.timer = setInterval(() => { game.seconds -= 1; broadcastState(); renderHost(); if (game.seconds <= 0) endNormalDrawing(); }, 1000); }
function endNormalDrawing() { if (game.phase !== 'drawing') return; clearInterval(game.timer); game.timer = null; game.seconds = 0; game.phase = 'normal-resolve'; broadcastState(); renderHost(); }
function resolveNormal(success) { if (game.phase !== 'normal-resolve') return; if (!success) return nextTurn(); rollTeam(activeTeam()?.id, false); }
function finishAllPlay() { if (game.phase !== 'allplay-word') return; game.phase = 'allplay-resolve'; broadcastState(); renderHost(); }
function resolveAllPlay(winnerId) { if (game.phase !== 'allplay-resolve') return; if (!winnerId) return nextTurn(); if (game.finalAllPlay && winnerId === game.finalTeamId) return declareWinner(winnerId); rollTeam(winnerId, false); }
function rollTeam(teamId) {
  const team = game.teams.find((item) => item.id === teamId); if (!team) return nextTurn(); game.phase = 'rolling'; game.lastRoll = null; broadcastState(); renderHost();
  setTimeout(() => { const roll = Math.floor(Math.random() * 6) + 1; team.position = Math.min(FINISH, team.position + roll); game.lastRoll = roll; if (team.position === FINISH && !game.finalTeamId) game.finalTeamId = team.id; broadcastState(); renderHost(); setTimeout(() => nextTurn(), 950); }, 620);
}
function nextTurn() {
  clearInterval(game.timer); game.timer = null; clearRoundData(); if (!game.teams.length) return;
  let attempts = 0; do { game.turnIndex = (game.turnIndex + 1) % game.teams.length; attempts += 1; } while (!game.teams[game.turnIndex].online && attempts < game.teams.length);
  game.phase = activeTeam()?.id === game.finalTeamId ? 'final-awaiting' : 'awaiting'; game.finalAllPlay = false; broadcastState(); renderHost();
}
function declareWinner(teamId) { clearInterval(game.timer); game.timer = null; game.winnerId = teamId; game.phase = 'gameover'; broadcastState(); renderHost(); }
function resetGame() { game.turnIndex = 0; game.teams.forEach((team) => { team.position = 0; }); game.finalTeamId = ''; game.finalAllPlay = false; game.winnerId = ''; game.usedWords = new Set(); clearRoundData(); game.phase = 'awaiting'; broadcastState(); renderHost(); }
function removeOfflineTeam(teamId) { const index = game.teams.findIndex((team) => team.id === teamId); if (index < 0 || game.teams[index].online) return; game.teams.splice(index, 1); if (game.turnIndex >= game.teams.length) game.turnIndex = 0; if (game.finalTeamId === teamId) game.finalTeamId = ''; broadcastState(); renderHost(); }

function hostReceive(connection, message) {
  if (!message?.type) return;
  if (message.type === 'join') {
    let team = game.teams.find((item) => item.id === message.teamId && item.reconnectKey === message.reconnectKey);
    if (!team && game.phase !== 'lobby') { send(connection, { type: 'rejected', message: 'המשחק כבר התחיל. בקשו מהמארח לפתוח משחק חדש.' }); return; }
    if (!team) { if (game.teams.length >= 8) { send(connection, { type: 'rejected', message: 'החדר מלא.' }); return; } team = { id: message.teamId, reconnectKey: message.reconnectKey, name: cleanName(message.name, 'זוג'), position: 0, online: true, color: teamColor(game.teams.length) }; game.teams.push(team); toast(`${team.name} הצטרפו.`); }
    else { team.online = true; team.name = cleanName(message.name, team.name); toast(`${team.name} התחברו מחדש.`); }
    game.connections.set(team.id, connection); send(connection, { type: 'accepted', teamId: team.id }); send(connection, { type: 'state', state: snapshot() }); renderLobby(); if (game.phase !== 'lobby') { broadcastState(); renderHost(); } return;
  }
  const isSender = activeTeam()?.id === message.teamId;
  if (message.type === 'start-turn' && isSender) beginTurn(message.teamId);
  if (message.type === 'begin-drawing' && isSender) beginDrawing(message.teamId);
  if (message.type === 'stroke' && isSender && game.phase === 'drawing') { const stroke = { ...message.stroke, teamId: message.teamId }; game.strokes.push(stroke); broadcast({ type: 'stroke', stroke }, message.teamId); }
  if (message.type === 'clear-drawing' && isSender && game.phase === 'drawing') { game.strokes = []; broadcast({ type: 'clear-viewer' }, message.teamId); }
  if (message.type === 'allplay-ready' && game.phase === 'allplay-word') { game.allPlayReady[message.teamId] = true; broadcastState(); renderHost(); }
}
function attachHostConnection(connection) {
  connection.on('data', (message) => hostReceive(connection, message));
  connection.on('close', () => { const team = game.teams.find((item) => game.connections.get(item.id) === connection); if (!team) return; team.online = false; game.connections.delete(team.id); broadcastState(); if (game.phase === 'lobby') renderLobby(); else renderHost(); });
  connection.on('error', () => toast('חיבור של זוג נותק.'));
}
function renderQR(target) { const el = $(target); el.replaceChildren(); const url = `${location.origin}${location.pathname}?join=${game.roomCode}`; if (window.QRCode) new QRCode(el, { text: url, width: target === '#qr-code' ? 180 : 190, height: target === '#qr-code' ? 180 : 190, colorDark: '#0f172a', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M }); else el.textContent = url; }
function createRoom() {
  if (!window.Peer) return toast('שירות החיבור לא נטען. בדקו אינטרנט ונסו שוב.'); game.mode = 'host'; game.teams = []; game.connections = new Map(); game.roomCode = randomCode();
  const openPeer = () => { game.peer = new Peer(`pictionary-${game.roomCode.toLowerCase()}`); game.peer.on('open', () => { show('host-lobby-view'); renderLobby(); renderQR('#qr-code'); renderQR('#tools-qr'); }); game.peer.on('connection', attachHostConnection); game.peer.on('error', (error) => { if (error.type === 'unavailable-id') { game.roomCode = randomCode(); openPeer(); } else toast('לא הצלחנו לפתוח חדר. נסו שוב.'); }); };
  openPeer();
}

function connectClient() {
  if (!game.peer?.open) return; const connection = game.peer.connect(`pictionary-${game.roomCode.toLowerCase()}`, { reliable: true }); client.connection = connection;
  connection.on('open', () => { client.connected = true; client.reconnectAttempts = 0; send(connection, { type: 'join', teamId: client.teamId, reconnectKey: client.reconnectKey, name: client.pairName }); renderPair(); });
  connection.on('data', clientReceive); connection.on('close', () => { client.connected = false; renderPair(); scheduleReconnect(); }); connection.on('error', () => { client.connected = false; scheduleReconnect(); });
}
function scheduleReconnect() { clearTimeout(client.reconnectTimer); if (game.mode !== 'client') return; const delay = Math.min(8000, 1000 * (2 ** Math.min(client.reconnectAttempts, 3))); client.reconnectAttempts += 1; client.reconnectTimer = setTimeout(() => { if (game.peer?.open) connectClient(); else startClientPeer(); }, delay); }
function startClientPeer() { if (!window.Peer) return toast('שירות החיבור לא נטען.'); game.peer?.destroy?.(); game.peer = new Peer(); game.peer.on('open', connectClient); game.peer.on('error', () => { client.connected = false; renderPair(); scheduleReconnect(); }); }
function clientReceive(message) {
  if (!message?.type) return;
  if (message.type === 'accepted') { client.teamId = message.teamId; saveDevice(); return; }
  if (message.type === 'rejected') { $('#join-status').textContent = message.message; game.peer?.destroy?.(); game.mode = null; show('join-setup-view'); return; }
  if (message.type === 'state') { const beforeWord = game.word; applySnapshot(message.state); if (beforeWord !== game.word) client.canvasReady = false; renderPair(); return; }
  if (message.type === 'stroke') { game.strokes.push(message.stroke); if ($('#pair-viewer').offsetParent) redrawViewer(); }
  if (message.type === 'clear-viewer') { game.strokes = []; if ($('#pair-viewer').offsetParent) redrawViewer(); }
}
function joinRoom(auto = false) {
  if (!window.Peer) return toast('שירות החיבור לא נטען.'); const code = normalizeCode($('#room-code').value); const name = cleanName($('#pair-name').value); if (!code || !name) { if (!auto) toast('כתבו שם זוג וקוד חדר.'); return; }
  game.mode = 'client'; game.roomCode = code; const saved = readSavedDevice(); if (saved?.roomCode === code && saved.teamId && saved.reconnectKey) { client.teamId = saved.teamId; client.reconnectKey = saved.reconnectKey; client.pairName = saved.pairName || name; } else { client.teamId = `team-${randomId()}`; client.reconnectKey = randomId(); client.pairName = name; }
  $('#join-status').textContent = auto ? 'מתחברים מחדש…' : 'מתחברים לחדר…'; startClientPeer();
}

function sendFromPair(message) { send(client.connection, { ...message, teamId: client.teamId }); }
function openPairCanvas() { client.canvasOpen = true; client.canvasReady = false; renderPair(); if (game.phase === 'allplay-word') sendFromPair({ type: 'allplay-ready' }); }
function beginPairDrawing() { sendFromPair({ type: 'begin-drawing' }); }
function bindCanvas(canvas, callback, allowed) {
  let drawing = false; let previous = {};
  const emit = (kind, event) => { const stroke = { kind, ...canvasPoint(canvas, event) }; drawStroke(canvas, stroke, previous); callback(stroke); };
  canvas.addEventListener('pointerdown', (event) => { if (!allowed()) return; drawing = true; try { canvas.setPointerCapture(event.pointerId); } catch {} emit('start', event); });
  canvas.addEventListener('pointermove', (event) => { if (drawing && allowed()) emit('move', event); });
  canvas.addEventListener('pointerup', (event) => { if (!drawing) return; emit('end', event); drawing = false; previous = {}; }); canvas.addEventListener('pointercancel', () => { drawing = false; previous = {}; });
}
function pairCanDraw() { return client.canvasOpen && ((game.phase === 'drawing' && activeTeam()?.id === client.teamId) || game.phase === 'allplay-word'); }
function clearPairDrawing() { resetPairCanvas(); if (game.phase === 'drawing') sendFromPair({ type: 'clear-drawing' }); }

function generatorWord(category) { const pool = WORDS[category]; const word = pool[Math.floor(Math.random() * pool.length)]; $('#generator-card').hidden = false; $('#generator-category').textContent = CATEGORY[category].name; $('#generator-category').style.color = CATEGORY[category].color; $('#generator-word').textContent = word; $('#generator-word').dataset.hidden = 'false'; }
function bindFreeCanvas(canvas) { let prev = {}; bindCanvas(canvas, () => {}, () => true); prepareCanvas(canvas); }

function bindEvents() {
  $('#open-host').onclick = () => show('host-setup-view'); $('#open-join').onclick = () => show('join-setup-view'); $('#open-cards').onclick = () => show('cards-view'); $('#open-solo-canvas').onclick = () => { show('solo-canvas-view'); prepareCanvas($('#solo-canvas')); };
  $$('.back-link').forEach((button) => button.onclick = () => show(button.dataset.go)); $('#fullscreen-button').onclick = () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.();
  $('#create-room').onclick = createRoom; $('#join-room').onclick = () => joinRoom(false); $('#room-code').addEventListener('input', (event) => { event.target.value = normalizeCode(event.target.value); });
  $('#copy-code').onclick = copyRoomCode; $('#copy-code-tools').onclick = copyRoomCode; $('#start-game').onclick = hostStartGame; $('#open-room-tools').onclick = () => { $('#room-tools').hidden = false; }; $('#close-room-tools').onclick = () => { $('#room-tools').hidden = true; }; $('#new-game').onclick = resetGame;
  $('#pair-start-turn').onclick = () => sendFromPair({ type: 'start-turn' }); $('#open-pair-canvas').onclick = openPairCanvas; $('#begin-drawing').onclick = beginPairDrawing; $('#clear-pair-canvas').onclick = clearPairDrawing; $('#return-to-word').onclick = () => { if (game.phase === 'word') { client.canvasOpen = false; client.canvasReady = false; renderPair(); } };
  const revealEvents = (button, reveal, hide) => { button.addEventListener('pointerdown', () => { setReveal(button, true); reveal?.(); }); ['pointerup','pointerleave','pointercancel'].forEach((type) => button.addEventListener(type, () => { setReveal(button, false); hide?.(); })); }; revealEvents($('#hold-card')); revealEvents($('#viewer-word-card'), () => { $('#viewer-word').textContent = game.word; }, () => { $('#viewer-word').textContent = 'החזיקו למילה'; });
  bindCanvas(pairCanvas, (stroke) => { client.localStrokes.push(stroke); if (game.phase === 'drawing') sendFromPair({ type: 'stroke', stroke }); }, pairCanDraw);
  $$('.category-buttons button').forEach((button) => button.onclick = () => generatorWord(button.dataset.category)); $('#toggle-generator-word').onclick = () => { const word = $('#generator-word'); const hidden = word.dataset.hidden === 'true'; word.dataset.hidden = String(!hidden); word.style.filter = hidden ? '' : 'blur(9px)'; };
  bindFreeCanvas($('#solo-canvas')); $('#clear-solo').onclick = () => prepareCanvas($('#solo-canvas'));
  window.addEventListener('resize', () => { if ($('#pair-viewer').offsetParent) redrawViewer(); if ($('#pair-draw').offsetParent && client.canvasReady) { const history = client.localStrokes; resetPairCanvas(); const previous = {}; history.forEach((stroke) => drawStroke(pairCanvas, stroke, previous)); client.localStrokes = history; } });
}
function copyRoomCode() { navigator.clipboard?.writeText(game.roomCode).then(() => toast('קוד החדר הועתק.')).catch(() => toast(`קוד החדר: ${game.roomCode}`)); }
function autoReconnectFromLink() { const code = normalizeCode(new URLSearchParams(location.search).get('join')); if (!code) return; $('#room-code').value = code; const saved = readSavedDevice(); if (saved?.roomCode === code && saved.pairName) { $('#pair-name').value = saved.pairName; setTimeout(() => joinRoom(true), 150); } else show('join-setup-view'); }
function init() { bindEvents(); autoReconnectFromLink(); }
init();
