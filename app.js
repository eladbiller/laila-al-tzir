/* לילה על הציר — a static GitHub Pages party game.
   Shared rooms use PeerJS WebRTC data channels; no account or database is needed. */
(function () {
  'use strict';

  const TRACKS = [
    ['Dancing Queen', 'ABBA', 1976], ['I Will Survive', 'Gloria Gaynor', 1978], ['Another Brick in the Wall', 'Pink Floyd', 1979],
    ['Billie Jean', 'Michael Jackson', 1982], ['Sweet Dreams', 'Eurythmics', 1983], ['Like a Prayer', 'Madonna', 1989],
    ['Smells Like Teen Spirit', 'Nirvana', 1991], ['Wonderwall', 'Oasis', 1995], ['Wannabe', 'Spice Girls', 1996],
    ['...Baby One More Time', 'Britney Spears', 1998], ['Beautiful Day', 'U2', 2000], ['Crazy in Love', 'Beyoncé', 2003],
    ['Hey Ya!', 'OutKast', 2003], ['Hips Don’t Lie', 'Shakira', 2005], ['Rehab', 'Amy Winehouse', 2006],
    ['Poker Face', 'Lady Gaga', 2008], ['I Gotta Feeling', 'The Black Eyed Peas', 2009], ['Rolling in the Deep', 'Adele', 2010],
    ['Somebody That I Used to Know', 'Gotye', 2011], ['Call Me Maybe', 'Carly Rae Jepsen', 2011], ['Get Lucky', 'Daft Punk', 2013],
    ['Happy', 'Pharrell Williams', 2013], ['Uptown Funk', 'Mark Ronson ft. Bruno Mars', 2014], ['Shape of You', 'Ed Sheeran', 2017],
    ['Blinding Lights', 'The Weeknd', 2019], ['Levitating', 'Dua Lipa', 2020], ['Flowers', 'Miley Cyrus', 2023],
    ['אני ואתה', 'אריק איינשטיין', 1971], ['הללויה', 'חלב ודבש', 1979], ['עוד נגיע', 'ירדנה ארזי', 1984],
    ['עוף גוזל', 'אריק איינשטיין', 1987], ['שיר לשירה', 'קורין אלאל', 1990], ['שיר אהבה בדואי', 'יצחק קלפטר', 1991],
    ['עניין של זמן', 'גידי גוב', 1992], ['שניים', 'שלמה ארצי', 1996], ['יותר מדי', 'הדג נחש', 2000],
    ['ממעמקים', 'עידן רייכל', 2005], ['ניצחת איתי הכל', 'עמיר בניון', 2006], ['אם יש גן עדן', 'אייל גולן', 2008],
    ['ואיך שלא', 'אריק ברמן', 2010], ['רוקד עם דמעות בעיניים', 'מירי מסיקה', 2012], ['תל אביב', 'עומר אדם', 2013],
    ['מסיבה בחיפה', 'סטטיק ובן אל', 2015], ['שבט אחים ואחיות', 'אמני ישראל', 2018], ['פאוץ׳', 'נועה קירל', 2019],
    ['מועבט', 'עדן בן זקן', 2020], ['קומסי קומסה', 'אנה זק', 2022], ['יוניקורן', 'נועה קירל', 2023]
  ].map(([title, artist, year], id) => ({ id: `song-${id}`, title, artist, year, url: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${artist} ${title}`)}` }));

  const $ = (id) => document.getElementById(id);
  const app = { role: null, peer: null, connection: null, hostConnections: new Map(), state: null, roomCode: '', rounds: 8, localPlayers: [], toastTimer: null };
  const clone = (value) => JSON.parse(JSON.stringify(value));

  function blankState(rounds) {
    return { phase: 'lobby', rounds, round: 0, deck: [], currentCard: null, players: [], activePlayerId: null, lastResult: null };
  }
  function showView(id) {
    document.querySelectorAll('.view').forEach((view) => view.classList.toggle('is-active', view.id === id));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function toast(message) {
    const target = $('toast'); target.textContent = message; target.classList.add('is-shown');
    clearTimeout(app.toastTimer); app.toastTimer = setTimeout(() => target.classList.remove('is-shown'), 2700);
  }
  function randomCode() { return Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join(''); }
  function hostPeerId(code) { return `laila-tzir-${code.toLowerCase()}`; }
  function shuffle(items) { const copy = [...items]; for (let i = copy.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; } return copy; }
  function sortedTimeline(player) { return [...player.timeline].sort((a, b) => a.year - b.year || a.title.localeCompare(b.title)); }
  function getActivePlayer() { return app.state?.players.find((player) => player.id === app.state.activePlayerId); }
  function getPlayer(id) { return app.state?.players.find((player) => player.id === id); }
  function isHost() { return app.role === 'host'; }
  function isLocal() { return app.role === 'local'; }
  function controlledPlayer() { return isLocal() ? getActivePlayer() : getPlayer(app.connection?.metadata?.playerId); }

  function sanitizeName(value, fallback) { return value.replace(/[<>]/g, '').trim().slice(0, 20) || fallback; }
  function makePlayer(id, name) { return { id, name: sanitizeName(name, 'שחקן'), score: 0, timeline: [] }; }
  function statusText() {
    if (!app.state) return '';
    if (app.state.phase === 'lobby') return 'מחכים לשחקנים';
    if (app.state.phase === 'finished') return 'המשחק הסתיים';
    const active = getActivePlayer();
    if (app.state.phase === 'reveal') return 'פותחים את הקלף…';
    return active ? `התור של ${active.name}` : 'מתחילים תכף';
  }

  function render() {
    if (!app.state) return;
    if (app.state.phase === 'lobby' && isHost()) renderLobby();
    else renderGame();
  }
  function renderLobby() {
    const list = $('lobby-players');
    list.replaceChildren();
    app.state.players.forEach((player) => {
      const chip = document.createElement('span'); chip.className = 'player-chip'; chip.textContent = player.name; list.append(chip);
    });
    $('start-game-button').disabled = app.state.players.length === 0;
    $('start-game-button').textContent = app.state.players.length ? `מתחילים עם ${app.state.players.length} שחקנים ♫` : 'מחכים לשחקנים…';
  }
  function renderGame() {
    showView('game-view');
    const state = app.state; const card = state.currentCard;
    $('round-counter').textContent = state.phase === 'finished' ? 'סיום המשחק' : `סיבוב ${Math.min(state.round + 1, state.rounds)} / ${state.rounds}`;
    $('turn-banner').textContent = statusText();
    $('connection-pill').textContent = isLocal() ? '● משחק מקומי' : isHost() ? '● מסך משותף פעיל' : '● הטלפון מחובר';
    $('song-stage').hidden = !card;
    if (card) {
      const revealed = state.phase === 'reveal' || state.phase === 'finished';
      $('song-eyebrow').textContent = revealed ? 'הקלף נחשף' : 'השיר החדש';
      $('song-title').textContent = card.title;
      $('song-artist').textContent = card.artist;
      $('listen-link').href = card.url;
      $('reveal-year').hidden = !revealed;
      $('reveal-year').textContent = card.year;
    }
    renderScores(); renderHostControls(); renderController();
  }
  function renderScores() {
    const board = $('scoreboard'); board.replaceChildren();
    const ranking = [...app.state.players].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    ranking.forEach((player) => {
      const card = document.createElement('article'); card.className = `score-card${player.id === app.state.activePlayerId ? ' is-active' : ''}`;
      const years = sortedTimeline(player).map((track) => `<span title="${escapeHtml(track.title)}">${track.year}</span>`).join('') || '<span>עוד אין קלפים</span>';
      card.innerHTML = `<div class="score-card-head"><strong>${escapeHtml(player.name)}</strong><b>${player.score} ✦</b></div><div class="mini-timeline">${years}</div>`;
      board.append(card);
    });
  }
  function renderHostControls() {
    const controls = $('host-controls'); const button = $('host-next-button'); const help = $('host-help');
    const visible = isHost() || isLocal(); controls.hidden = !visible;
    if (!visible) return;
    if (app.state.phase === 'playing') { button.hidden = true; help.textContent = isLocal() ? 'בחרו את המקום הנכון בציר של השחקן הנוכחי.' : 'השיר פתוח? עכשיו השחקן שבתוֹר בוחר מקום בציר שלו בטלפון.'; }
    if (app.state.phase === 'reveal') { button.hidden = false; button.textContent = app.state.round + 1 >= app.state.rounds ? 'לסיום התוצאות ←' : 'לשיר הבא ←'; help.textContent = resultSummary(); }
    if (app.state.phase === 'finished') { button.hidden = false; button.textContent = 'משחק חדש ♫'; help.textContent = winnerSummary(); }
  }
  function renderController() {
    const panel = $('controller-panel');
    if (isHost() && !isLocal()) { panel.hidden = true; return; }
    const player = controlledPlayer();
    if (!player) { panel.hidden = true; return; }
    panel.hidden = false;
    const local = isLocal(); const state = app.state;
    if (state.phase === 'playing' && player.id === state.activePlayerId) {
      const timeline = sortedTimeline(player);
      panel.innerHTML = `<h3>${local ? `${escapeHtml(player.name)}, זה התור שלך` : 'זה התור שלכם'}</h3><p>הקשיבו לשיר ובחרו איפה השנה שלו משתלבת בציר שלכם.</p><div class="placement-buttons" id="placement-buttons"></div>`;
      const holder = $('placement-buttons');
      placementOptions(timeline).forEach(({ label, position }) => {
        const button = document.createElement('button'); button.className = 'placement-button'; button.type = 'button'; button.textContent = label;
        button.addEventListener('click', () => submitGuess(position)); holder.append(button);
      });
    } else if (state.phase === 'playing') {
      panel.innerHTML = `<h3>הטלפון בידיים של ${escapeHtml(getActivePlayer()?.name || 'השחקן הבא')}</h3><p>מחכים לבחירה שלו בציר הזמן.</p>`;
    } else if (state.phase === 'reveal') {
      const result = state.lastResult; const won = result?.playerId === player.id && result.success;
      const lost = result?.playerId === player.id && !result.success;
      panel.innerHTML = `<h3 class="${won ? 'result-success' : lost ? 'result-fail' : ''}">${won ? 'בול על השנה! ✦' : lost ? 'כמעט, לא נכנס הפעם' : 'השנה נחשפה'}</h3><p>${escapeHtml(resultSummary())}</p>`;
    } else if (state.phase === 'finished') {
      panel.innerHTML = `<h3>נגמרה המסיבה!</h3><p>${escapeHtml(winnerSummary())}</p>`;
    }
  }
  function placementOptions(timeline) {
    if (!timeline.length) return [{ label: 'זה הקלף הראשון בציר שלי', position: 0 }];
    const options = [{ label: `לפני ${timeline[0].year} · ${timeline[0].title}`, position: 0 }];
    for (let index = 0; index < timeline.length - 1; index += 1) options.push({ label: `בין ${timeline[index].year} ל-${timeline[index + 1].year}`, position: index + 1 });
    options.push({ label: `אחרי ${timeline[timeline.length - 1].year} · ${timeline[timeline.length - 1].title}`, position: timeline.length });
    return options;
  }
  function resultSummary() {
    const result = app.state?.lastResult; if (!result) return 'השנה הנכונה נחשפה.';
    const player = getPlayer(result.playerId); const card = result.card;
    return result.success ? `${player?.name || 'השחקן'} מיקם/ה נכון: ${card.year}. הקלף נוסף לציר!` : `${player?.name || 'השחקן'} ניחש/ה לא נכון. ${card.title} יצא בשנת ${card.year}.`;
  }
  function winnerSummary() {
    const first = [...app.state.players].sort((a, b) => b.score - a.score)[0];
    return first ? `המנצח/ת: ${first.name} עם ${first.score} נקודות!` : 'תודה ששיחקתם.';
  }
  function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[char])); }

  function createRoom() {
    if (!window.Peer) { toast('ספריית החיבור לא נטענה. בדקו חיבור לאינטרנט ונסו שוב.'); return; }
    app.role = 'host'; app.rounds = Number(document.querySelector('#round-picker .is-selected').dataset.rounds); app.state = blankState(app.rounds); app.roomCode = randomCode();
    $('room-code-display').textContent = app.roomCode;
    const joinUrl = `${location.origin}${location.pathname}?join=${app.roomCode}`;
    const qr = $('qr-code'); qr.replaceChildren();
    if (window.QRCode) new QRCode(qr, { text: joinUrl, width: 190, height: 190, colorDark: '#161224', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M });
    else qr.textContent = 'פתחו בטלפון: ' + joinUrl;
    showView('lobby-view'); renderLobby();
    app.peer = new Peer(hostPeerId(app.roomCode), { debug: 1 });
    app.peer.on('open', () => toast('החדר מוכן. שתפו את ה-QR עם השחקנים.'));
    app.peer.on('connection', attachHostConnection);
    app.peer.on('error', (error) => { if (error.type === 'unavailable-id') { toast('הקוד תפוס, מייצרים חדר חדש…'); app.peer.destroy(); createRoom(); } else toast('תקלה בחיבור לחדר. נסו לרענן את הדף.'); });
  }
  function attachHostConnection(connection) {
    connection.on('open', () => { app.hostConnections.set(connection.peer, connection); connection.send({ type: 'STATE', state: app.state }); });
    connection.on('data', (message) => hostMessage(connection, message));
    connection.on('close', () => { app.hostConnections.delete(connection.peer); });
  }
  function hostMessage(connection, message) {
    if (!message || !message.type) return;
    if (message.type === 'JOIN') {
      const name = sanitizeName(message.name, `שחקן ${app.state.players.length + 1}`);
      const duplicate = app.state.players.find((player) => player.id === connection.peer);
      if (!duplicate) app.state.players.push(makePlayer(connection.peer, name));
      connection.metadata = { playerId: connection.peer };
      broadcast(); render(); toast(`${name} הצטרף/ה למשחק`);
    }
    if (message.type === 'GUESS' && app.state.phase === 'playing' && connection.peer === app.state.activePlayerId) scoreGuess(connection.peer, Number(message.position));
  }
  function broadcast() {
    if (!isHost()) return;
    app.hostConnections.forEach((connection) => { if (connection.open) connection.send({ type: 'STATE', state: clone(app.state) }); });
  }

  function joinRoom() {
    const name = sanitizeName($('join-name').value, 'שחקן'); const code = $('room-code-input').value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== 6) { $('join-status').textContent = 'הכניסו קוד חדר בן 6 תווים.'; return; }
    if (!window.Peer) { $('join-status').textContent = 'ספריית החיבור לא נטענה. בדקו את החיבור ונסו שוב.'; return; }
    $('join-status').textContent = 'מתחברים למסך המשותף…'; $('join-room-button').disabled = true; app.role = 'player';
    app.peer = new Peer(undefined, { debug: 1 });
    app.peer.on('open', () => {
      app.connection = app.peer.connect(hostPeerId(code), { reliable: true, metadata: { playerId: app.peer.id } });
      app.connection.on('open', () => { app.connection.send({ type: 'JOIN', name }); $('join-status').textContent = 'מחוברים! מחכים שהמארח יתחיל.'; });
      app.connection.on('data', playerMessage);
      app.connection.on('close', () => { toast('החיבור למסך המשותף נסגר.'); $('connection-pill').textContent = '● החיבור נותק'; });
      app.connection.on('error', () => { $('join-status').textContent = 'לא הצלחנו להתחבר. בדקו את הקוד ושהמסך המשותף פתוח.'; $('join-room-button').disabled = false; });
    });
    app.peer.on('error', () => { $('join-status').textContent = 'לא הצלחנו למצוא את החדר. בדקו את הקוד ונסו שוב.'; $('join-room-button').disabled = false; });
  }
  function playerMessage(message) {
    if (message?.type !== 'STATE') return; app.state = message.state; render();
  }

  function startGame() {
    if (!app.state.players.length) return;
    app.state.deck = shuffle(TRACKS).slice(0, app.state.rounds); app.state.round = 0; app.state.activePlayerId = app.state.players[0].id; app.state.currentCard = app.state.deck[0]; app.state.phase = 'playing'; app.state.lastResult = null; broadcast(); render();
  }
  function submitGuess(position) {
    if (isLocal()) scoreGuess(app.state.activePlayerId, position);
    else if (app.connection?.open) { app.connection.send({ type: 'GUESS', position }); document.querySelectorAll('.placement-button').forEach((button) => { button.disabled = true; }); }
  }
  function scoreGuess(playerId, position) {
    const player = getPlayer(playerId); if (!player || !Number.isInteger(position)) return;
    const card = app.state.currentCard; const timeline = sortedTimeline(player); if (position < 0 || position > timeline.length) return;
    const before = timeline[position - 1]; const after = timeline[position];
    const success = (!before || before.year <= card.year) && (!after || card.year <= after.year);
    if (success) { player.timeline.splice(position, 0, card); player.score += 1; }
    app.state.lastResult = { playerId, success, card }; app.state.phase = 'reveal'; broadcast(); render();
  }
  function nextRound() {
    if (app.state.phase === 'finished') { startGame(); return; }
    if (app.state.round + 1 >= app.state.rounds) { app.state.phase = 'finished'; broadcast(); render(); return; }
    const currentIndex = app.state.players.findIndex((player) => player.id === app.state.activePlayerId);
    app.state.round += 1; app.state.activePlayerId = app.state.players[(currentIndex + 1) % app.state.players.length].id; app.state.currentCard = app.state.deck[app.state.round]; app.state.phase = 'playing'; app.state.lastResult = null; broadcast(); render();
  }

  function openLocalSetup() { app.role = null; app.localPlayers = []; renderLocalPlayers(); showView('local-setup-view'); }
  function addLocalPlayer() {
    const input = $('local-player-name'); const name = sanitizeName(input.value, ''); if (!name) { toast('כתבו שם לשחקן.'); return; }
    if (app.localPlayers.length >= 6) { toast('אפשר לשחק עד 6 שחקנים על אותו מכשיר.'); return; }
    app.localPlayers.push({ id: `local-${Date.now()}-${app.localPlayers.length}`, name }); input.value = ''; renderLocalPlayers();
  }
  function renderLocalPlayers() {
    const list = $('local-players'); list.replaceChildren(); app.localPlayers.forEach((player) => { const item = document.createElement('span'); item.className = 'removable-chip'; item.innerHTML = `${escapeHtml(player.name)} <button aria-label="הסר ${escapeHtml(player.name)}" type="button">×</button>`; item.querySelector('button').addEventListener('click', () => { app.localPlayers = app.localPlayers.filter((entry) => entry.id !== player.id); renderLocalPlayers(); }); list.append(item); });
    $('start-local-game-button').disabled = app.localPlayers.length < 2;
  }
  function startLocalGame() { app.role = 'local'; app.state = blankState(8); app.state.players = app.localPlayers.map((player) => makePlayer(player.id, player.name)); startGame(); }

  function leaveGame() {
    if (app.peer) app.peer.destroy(); app.peer = null; app.connection = null; app.hostConnections.clear(); app.state = null; app.role = null; history.replaceState({}, '', location.pathname); showView('welcome-view');
  }
  function setupEvents() {
    $('open-host-setup').addEventListener('click', () => showView('host-setup-view'));
    $('open-join-setup').addEventListener('click', () => showView('join-setup-view'));
    $('open-local-setup').addEventListener('click', openLocalSetup);
    document.querySelectorAll('[data-go]').forEach((button) => button.addEventListener('click', () => showView(button.dataset.go)));
    document.querySelectorAll('#round-picker button').forEach((button) => button.addEventListener('click', () => { document.querySelectorAll('#round-picker button').forEach((other) => other.classList.remove('is-selected')); button.classList.add('is-selected'); }));
    $('create-room-button').addEventListener('click', createRoom); $('join-room-button').addEventListener('click', joinRoom);
    $('room-code-input').addEventListener('input', (event) => { event.target.value = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
    $('copy-room-button').addEventListener('click', async () => { try { await navigator.clipboard.writeText(app.roomCode); toast('קוד החדר הועתק.'); } catch { toast(`קוד החדר: ${app.roomCode}`); } });
    $('add-demo-player-button').addEventListener('click', () => { if (!isHost()) return; const number = app.state.players.length + 1; app.state.players.push(makePlayer(`demo-${Date.now()}`, `שחקן ${number}`)); broadcast(); render(); });
    $('start-game-button').addEventListener('click', startGame); $('host-next-button').addEventListener('click', nextRound); $('leave-game-button').addEventListener('click', leaveGame);
    $('add-local-player-button').addEventListener('click', addLocalPlayer); $('local-player-name').addEventListener('keydown', (event) => { if (event.key === 'Enter') addLocalPlayer(); }); $('start-local-game-button').addEventListener('click', startLocalGame);
    $('fullscreen-button').addEventListener('click', () => { if (!document.fullscreenElement) document.documentElement.requestFullscreen?.(); else document.exitFullscreen?.(); });
  }
  function handleJoinLink() {
    const code = new URLSearchParams(location.search).get('join'); if (!code) return; $('room-code-input').value = code.toUpperCase(); showView('join-setup-view'); $('join-name').focus();
  }
  setupEvents(); handleJoinLink();
}());
