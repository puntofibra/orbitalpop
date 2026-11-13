
/* ═════════════ BOTONES DE PODER Y BARRA DE CARGA (dentro del tablero) ═════════════ */
const PW_KEYS = ['bomb','rainbow','laser'];
const PW_POS = k => ({x: 22, y: 438 + PW_KEYS.indexOf(k)*38});
Board.prototype.powerAt = function(x, y){ for (const k of PW_KEYS){ const p = PW_POS(k); if (Math.hypot(p.x-x, p.y-y) < 19) return k; } return null; };
Board.prototype.drawUI = function(g, k){
  for (const key of PW_KEYS){
    const p = PW_POS(key), n = this.powers[key], on = this.armed===key;
    g.save();
    g.globalAlpha = n ? 1 : .35;
    g.fillStyle = on ? 'rgba(255,197,59,.35)' : 'rgba(10,16,40,.85)';
    g.strokeStyle = n ? '#ffc53b' : 'rgba(120,200,255,.3)'; g.lineWidth = on ? 3 : 1.5;
    if (n){ g.shadowColor = '#ffc53b'; g.shadowBlur = on ? 22 : 8 + Math.sin(this.t*5)*5; }
    g.beginPath(); g.arc(p.x, p.y, 15, 0, 7); g.fill(); g.stroke(); g.shadowBlur = 0;
    g.font = '15px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(POWERS[key].i, p.x, p.y + 1);
    if (n){ g.fillStyle = '#ffc53b'; g.beginPath(); g.arc(p.x+11, p.y-11, 6.5, 0, 7); g.fill(); g.fillStyle = '#000'; g.font = '900 9px Orbitron'; g.fillText(n, p.x+11, p.y-10.5); }
    g.restore();
  }
  /* carga */
  const x = BW - 10, y0 = 418, h = 104, f = this.charge/CH_MAX;
  g.save(); g.fillStyle = 'rgba(255,255,255,.08)'; rr(g, x-4, y0, 8, h, 4); g.fill();
  const gr = g.createLinearGradient(0, y0+h, 0, y0); gr.addColorStop(0,'#ffc53b'); gr.addColorStop(1,'#ff2bd6');
  g.fillStyle = gr; g.shadowColor = '#ffc53b'; g.shadowBlur = 8; rr(g, x-4, y0 + h*(1-f), 8, Math.max(1, h*f), 4); g.fill(); g.restore();
  if (this.garbage > 0){
    g.save(); g.font = '900 15px Orbitron'; g.textAlign = 'center'; g.fillStyle = '#ff3355'; g.shadowColor = '#ff3355'; g.shadowBlur = 12;
    g.globalAlpha = .6 + Math.sin(this.t*10)*.4; g.fillText('⚠ +' + this.garbage, BW/2, this.ceil*RH + 22); g.restore();
  }
};

/* ════════════════════════════════════════════════════════════
   PARTIDA: 1 jugador (aventura), 2 en el mismo dispositivo, 2 online
   ════════════════════════════════════════════════════════════ */
const cv = $('#cv'), cx = cv.getContext('2d');
let G = null, DPR = 1, VW = 0, VH = 0, rafId = 0, lastT = 0;
const KEYS = {};

function resize(){
  DPR = Math.min(2.5, devicePixelRatio||1); VW = innerWidth; VH = innerHeight;
  cv.width = Math.round(VW*DPR); cv.height = Math.round(VH*DPR);
  if (G) layout();
}
addEventListener('resize', resize); resize();

function layout(){
  const land = VW > VH, safeT = 8, n = G.boards.length;
  G.rects = [];
  if (G.mode==='solo'){
    const top = 64, bot = 12;
    const s = Math.min((VW-28)/(BW+12), (VH-top-bot)/(BH+12));
    G.rects.push({x:(VW - BW*s)/2, y: top + (VH-top-bot - BH*s)/2, s});
  } else if (G.mode==='local2' || land){
    const top = 70, bot = 12, gap = 26;
    const w2 = G.mode==='online' ? 1.75 : 2;   /* online: el rival un poco más pequeño */
    const s = Math.min((VW-28-gap)/((BW+12)*w2), (VH-top-bot)/(BH+12));
    const s2 = G.mode==='online' ? s*.75 : s, tot = BW*s + BW*s2 + gap;
    const x0 = (VW - tot)/2, y = top + (VH-top-bot - BH*s)/2;
    G.rects.push({x:x0, y, s});
    G.rects.push({x:x0 + BW*s + gap, y: y + (BH*s - BH*s2)/2, s:s2});
  } else {
    /* online con el móvil en vertical: rival en miniatura arriba */
    const topH = Math.max(120, VH*.2), bot = 10;
    const s = Math.min((VW-28)/(BW+12), (VH-topH-bot-12)/(BH+12));
    G.rects.push({x:(VW - BW*s)/2, y: topH + 8 + (VH-topH-8-bot - BH*s)/2, s});
    const s2 = (topH-34)/BH;
    G.rects.push({x: VW - BW*s2 - 16, y: 26 + safeT, s:s2});
  }
}

function showCanvas(on){
  cv.classList.toggle('hidden', !on); $('#hud').classList.toggle('hidden', !on);
  app.classList.toggle('off', on);
  if (on) app.innerHTML = '';
}

function newGameCommon(mode){
  if (G) stopLoop();
  G = {mode, boards:[], rects:[], paused:false, over:false, t0:Date.now(), id: Date.now().toString(36)+Math.random().toString(36).slice(2,6)};
}
/* ── 1 jugador ── */
function startSolo(n){
  ac(); closeModal();
  newGameCommon('solo');
  const def = levelDef(n), sc = sectOf(n);
  BG.setHue(sc.h);
  const b = new Board(def, {color: sc.c});
  b.onEnd = st => soloEnd(st);
  b.onPower = () => {};
  G.boards.push(b); G.lvl = n;
  showCanvas(true); layout(); hudSolo(); startLoop();
  b.texts.push({x:BW/2, y:BH*.36, s:'NIVEL '+n, c:sc.c, life:1.6, max:1.6, size:34, big:true});
  b.texts.push({x:BW/2, y:BH*.36+34, s:sc.n, c:'#fff', life:1.6, max:1.6, size:13});
  LS.set('last', n);
}
function hudSolo(){
  const b = G.boards[0], sc = sectOf(G.lvl), left = b.def.dropEvery - b.sinceDrop;
  const st = b.shots <= b.def.par ? 3 : b.shots <= Math.round(b.def.par*1.5) ? 2 : 1;
  $('#hud').innerHTML = `<button class="hIco" id="hP">⏸</button>
    <div class="hb"><small style="color:${sc.c}">Nivel</small><b>${G.lvl}</b></div>
    <div class="hb"><small>Puntos</small><b id="hS">${fmt(b.score)}</b></div>
    <div class="hsp"></div>
    <div class="hb"><small>Estrellas</small><b style="color:#ffd23f;letter-spacing:-2px">${'★'.repeat(st)}<span style="opacity:.25">${'★'.repeat(3-st)}</span></b></div>
    <div class="hb"><small>Techo</small><b style="color:${left<=2?'#ff3355':'#fff'}">${left}</b></div>`;
  $('#hP').onclick = ()=>pause();
}
function hudVs(){
  $('#hud').innerHTML = `<button class="hIco" id="hP">⏸</button><div class="hsp"></div>`;
  $('#hP').onclick = ()=>pause();
}

/* ── a dobles ── */
function startLocal2(){
  ac(); closeModal();
  newGameCommon('local2');
  const seed = Math.floor(Math.random()*1e9), def = versusDef(seed);
  const A = new Board(def, {vs:true, name:'JUGADOR 1', color:'#2bf0ff'});
  const B = new Board(versusDef(seed), {vs:true, name:'JUGADOR 2', color:'#ff2bd6'});
  A.rng = RNG(seed+1); B.rng = RNG(seed+1);
  A.onAttack = n=>{ B.garbage += n; SFX.attack(); };
  B.onAttack = n=>{ A.garbage += n; SFX.attack(); };
  G.boards.push(A, B);
  BG.setHue(280);
  showCanvas(true); layout(); hudVs(); startLoop();
  countdown();
}
function startOnline(seed, names, me){
  ac(); closeModal();
  newGameCommon('online');
  const def = versusDef(seed);
  const mine = new Board(def, {vs:true, name:names[me], color: me ? '#ff2bd6' : '#2bf0ff'});
  const rival = new Board(versusDef(seed), {vs:true, local:false, name:names[1-me], color: me ? '#2bf0ff' : '#ff2bd6'});
  mine.rng = RNG(seed + 7 + me);
  mine.onAttack = n=>{ Net.send({t:'atk', n}); SFX.attack(); mine.texts.push({x:BW/2, y:BH*.62, s:'⚔ ATAQUE x'+n, c:'#2dff8a', life:1, max:1, size:20, big:true}); };
  mine.onChange = ()=>{ G.dirty = true; };
  G.boards.push(mine, rival); G.me = me; G.names = names; G.seed = seed;
  BG.setHue(280);
  showCanvas(true); layout(); hudVs(); startLoop();
  countdown();
}
function countdown(){
  G.boards.forEach(b=>{ b.state = 'wait'; });
  let n = 3;
  const tick = ()=>{
    if (!G) return;
    if (n > 0){ G.boards.forEach(b=>b.texts.push({x:BW/2, y:BH*.4, s:String(n), c:'#fff', life:.9, max:.9, size:64, big:true})); SFX.click(); tone(440,.15,'square',.08); n--; setTimeout(tick, 800); }
    else { G.boards.forEach(b=>{ b.state = 'play'; b.idle = 0; b.texts.push({x:BW/2, y:BH*.4, s:'¡YA!', c:'#2dff8a', life:.9, max:.9, size:56, big:true}); }); tone(880,.3,'square',.1); }
  };
  tick();
}

/* ── bucle ── */
function startLoop(){ cancelAnimationFrame(rafId); lastT = performance.now(); rafId = requestAnimationFrame(loop); }
function stopLoop(){ cancelAnimationFrame(rafId); rafId = 0; }
let sendT = 0, hudT = 0;
function loop(ts){
  if (!G) return;
  const dt = Math.min(.033, (ts - lastT)/1000); lastT = ts;
  if (!G.paused){
    keyAim(dt);
    G.boards.forEach(b=>b.update(dt));
    vsCheck();
  }
  render();
  if (G && G.mode==='online'){
    sendT += dt;
    const me = G.boards[0];
    if (sendT > .075 && (G.dirty || me.ball || Math.abs((G.lastAng||0) - me.ang) > .004)){ sendT = 0; G.dirty = false; G.lastAng = me.ang; Net.send(Object.assign({t:'s'}, me.snap())); }
  }
  if (G && G.mode==='solo'){ hudT += dt; if (hudT > .15){ hudT = 0; const e = $('#hS'); if (e) hudSolo(); } }
  if (G) rafId = requestAnimationFrame(loop);
}
function render(){
  const g = cx; g.setTransform(1,0,0,1,0,0); g.clearRect(0,0,cv.width,cv.height);
  G.boards.forEach((b,i)=>{
    const r = G.rects[i]; if (!r) return;
    g.setTransform(DPR*r.s, 0, 0, DPR*r.s, DPR*r.x, DPR*r.y);
    b.draw(g, DPR*r.s);
    if (b.local || G.mode==='online') b.drawUI(g, DPR*r.s);
    if (G.mode !== 'solo'){
      /* nombre y puntos encima del tablero */
      g.save(); g.textBaseline = 'bottom'; g.font = '900 15px Orbitron'; g.fillStyle = b.color; g.shadowColor = b.color; g.shadowBlur = 10;
      g.textAlign = 'left'; g.fillText(b.name || '', 0, -12);
      g.textAlign = 'right'; g.fillStyle = '#fff'; g.fillText(fmt(b.score), BW, -12); g.restore();
      if (G.mode==='online' && i===1 && !b.local){ g.save(); g.font = '700 11px Rajdhani'; g.fillStyle = '#8ea3c4'; g.textAlign='left'; g.textBaseline='top'; g.fillText('RIVAL', 0, BH+8); g.restore(); }
    }
  });
}

/* ── fin de partida ── */
function soloEnd(st){
  if (!G || G.over) return; G.over = true;
  const b = G.boards[0], n = G.lvl, seg = Math.round((Date.now()-G.t0)/1000);
  if (st==='won'){
    const stars = b.stars(), bonus = Math.max(0, b.def.par - b.shots)*100 + n*50;
    const total = b.score + bonus;
    const pg = LS.get('prog', {}), old = pg[n] || [0,0];
    pg[n] = [Math.max(old[0], stars), Math.max(old[1], total)]; LS.set('prog', pg);
    if (USER) call('nivel', {ses:USER.ses, nivel:n, estrellas:stars, puntos:total, disparos:b.shots, seg, id:G.id})
      .then(r=>{ if (r.user){ USER.user = r.user; LS.set('user', USER); } }).catch(e=>toast(errMsg(e),1));
    const nuevo = stars > old[0], last = n >= NIV;
    modal(`<h2 class="t" style="color:#2dff8a">${last ? '🏆 ¡GALAXIA SALVADA!' : '✅ ¡SECTOR DESPEJADO!'}</h2>
      <div class="ptxt" style="margin-top:-6px">Nivel ${n} · ${esc(sectOf(n).n)}</div>
      <div class="stars3"><span>⭐</span><span>⭐</span><span>⭐</span></div>
      <div class="bigNum" id="eNum">0</div>
      <div class="ptxt" style="font-size:15px">Puntos ${fmt(b.score)} + bonus ${fmt(bonus)} · ${b.shots} disparos (par ${b.def.par}) · combo máx x${b.maxCombo}</div>
      ${nuevo && old[0] ? '<div class="banner">🌟 ¡Nuevo récord de estrellas!</div>' : ''}
      ${USER ? '' : '<div class="ptxt" style="font-size:14px">Sin cuenta, el progreso solo queda en este dispositivo. <a class="lnk" id="eIn">Crear cuenta</a></div>'}
      ${last ? '' : '<button class="btn huge cy pulse" id="eNext">SIGUIENTE ▶</button>'}
      <div class="row"><button class="btn ghost" id="eRep">↻ Repetir</button><button class="btn ghost" id="eMap">🗺 Mapa</button></div>`, ()=>{ toMap(); });
    const spans = document.querySelectorAll('.stars3 span');
    spans.forEach((s,i)=>setTimeout(()=>{ if (i < stars){ s.className = 'on'; SFX.star(i); vib(25); } else s.className = 'off'; }, 350 + i*380));
    let v = 0; const tgt = total, t0 = performance.now();
    const cnt = ()=>{ const e = $('#eNum'); if (!e) return; const p = Math.min(1, (performance.now()-t0)/1100); e.textContent = fmt(tgt*p); if (p < 1) requestAnimationFrame(cnt); };
    requestAnimationFrame(cnt);
    confetti();
    if ($('#eNext')) $('#eNext').onclick = ()=>{ SFX.click(); startSolo(n+1); };
    $('#eRep').onclick = ()=>{ SFX.click(); startSolo(n); };
    $('#eMap').onclick = ()=>{ SFX.click(); toMap(); };
    if ($('#eIn')) $('#eIn').onclick = ()=>{ closeModal(); exitGame(); showLogin('registro'); };
  } else {
    modal(`<h2 class="t" style="color:#ff3355">💥 ¡CASCO PERFORADO!</h2>
      <div class="ptxt">Las burbujas han cruzado la línea roja en el nivel ${n}.</div>
      <div style="text-align:center;font-size:60px">🤖💦</div>
      <button class="btn huge mg pulse" id="eRep">↻ REINTENTAR</button>
      <button class="btn ghost" id="eMap">🗺 Volver al mapa</button>`, ()=>toMap());
    $('#eRep').onclick = ()=>{ SFX.click(); startSolo(n); };
    $('#eMap').onclick = ()=>{ SFX.click(); toMap(); };
  }
}
function vsCheck(){
  if (!G || G.over || G.mode==='solo') return;
  if (G.mode==='local2'){
    const [A, B] = G.boards;
    const lost = A.state==='lost' ? 0 : B.state==='lost' ? 1 : -1;
    if (lost >= 0){
      G.over = true; const w = G.boards[1-lost]; w.state = 'won'; w.endT = 0; SFX.win();
      setTimeout(()=>vsEnd(w.name, w.color), 1700);
    }
  } else if (G.mode==='online'){
    const me = G.boards[0];
    if (me.state==='lost'){ G.over = true; Net.send(Object.assign({t:'s'}, me.snap())); Net.send({t:'lose'}); setTimeout(()=>vsEnd(null, null, false), 1700); }
  }
}
function rivalLost(){
  if (!G || G.mode!=='online' || G.over) return;
  G.over = true; const me = G.boards[0]; me.state = 'won'; me.endT = 0; SFX.win(); confetti();
  const r = G.boards[1]; r.lose(); r.endT = 0;
  setTimeout(()=>vsEnd(null, null, true), 1400);
}
function vsEnd(name, color, gano){
  if (!G) return;
  let title, sub;
  if (G.mode==='local2'){ title = `🏆 ¡GANA ${esc(name)}!`; sub = 'El otro jugador ha dejado que las burbujas crucen la línea roja.'; confetti(); }
  else {
    title = gano ? '🏆 ¡VICTORIA!' : '💥 DERROTA';
    sub = gano ? `Has vencido a <b>${esc(G.names[1-G.me])}</b>.` : `<b>${esc(G.names[1-G.me])}</b> te ha ganado esta vez.`;
    if (USER) call('versus', {ses:USER.ses, gana:!!gano, id:G.id+(G.me)}).then(r=>{ if (r.user){ USER.user = r.user; LS.set('user', USER); } }).catch(()=>{});
  }
  modal(`<h2 class="t" style="color:${G.mode==='local2' ? color : gano ? '#2dff8a' : '#ff3355'}">${title}</h2>
    <div class="ptxt">${sub}</div>
    <div class="stats">${G.boards.map(b=>`<div class="stat"><b style="color:${b.color}">${fmt(b.score)}</b><small>${esc(b.name)}</small></div>`).join('')}</div>
    <button class="btn huge cy pulse" id="vAgain">⚔ REVANCHA</button>
    <button class="btn ghost" id="vOut">Salir</button>`);
  $('#vAgain').onclick = ()=>{
    SFX.click();
    if (G.mode==='local2') return startLocal2();
    if (Net.role==='host') Net.restart();
    else { Net.send({t:'again'}); $('#vAgain').disabled = true; $('#vAgain').textContent = 'ESPERANDO AL RIVAL…'; }
  };
  $('#vOut').onclick = ()=>{ SFX.click(); Net.close(true); exitGame(); showMenu(); };
}
function exitGame(){ stopLoop(); G = null; showCanvas(false); BG.setHue(200); }
function toMap(){ closeModal(); exitGame(); showMap(); }

function pause(){
  if (!G || G.over) return;
  if (G.mode !== 'online') G.paused = true;
  SFX.click();
  modal(`<h2 class="t">⏸ PAUSA</h2>
    ${G.mode==='online' ? '<div class="ptxt" style="font-size:14px">A dobles online la partida sigue corriendo.</div>' : ''}
    <button class="btn huge cy" id="pC">▶ CONTINUAR</button>
    ${G.mode==='solo' ? '<button class="btn" id="pR">↻ Reiniciar nivel</button>' : ''}
    <div class="row"><button class="btn ghost" id="pS">${AU.on?'🔊':'🔇'} Sonido</button><button class="btn ghost" id="pM">${AU.mus?'🎵':'🚫'} Música</button></div>
    <button class="btn ghost" id="pX">${G.mode==='solo' ? '🗺 Salir al mapa' : '🚪 Abandonar'}</button>`, resume);
  $('#pC').onclick = resume;
  if ($('#pR')) $('#pR').onclick = ()=>startSolo(G.lvl);
  $('#pS').onclick = ()=>{ setSound(!AU.on); MUS.sync(); $('#pS').textContent = (AU.on?'🔊':'🔇')+' Sonido'; };
  $('#pM').onclick = ()=>{ setMusic(!AU.mus); $('#pM').textContent = (AU.mus?'🎵':'🚫')+' Música'; };
  $('#pX').onclick = ()=>{ if (G.mode==='solo') return toMap(); if (G.mode==='online'){ Net.send({t:'lose'}); Net.close(true); } closeModal(); exitGame(); showMenu(); };
}
function resume(){ closeModal(); if (G){ G.paused = false; lastT = performance.now(); } }

/* confeti a pantalla completa */
function confetti(){
  const c = document.createElement('canvas'); c.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:30;pointer-events:none';
  document.body.appendChild(c); const g = c.getContext('2d'); c.width = innerWidth; c.height = innerHeight;
  const P = []; for (let i=0;i<160;i++) P.push({x:innerWidth/2 + rnd(-60,60), y:innerHeight*.45, vx:rnd(-520,520), vy:rnd(-900,-250), r:rnd(0,6), vr:rnd(-10,10), c:COL[Math.floor(Math.random()*6)].c, w:rnd(5,10), h:rnd(8,16)});
  let t0 = performance.now();
  const f = ts=>{ const dt = .016, el = (ts-t0)/1000; g.clearRect(0,0,c.width,c.height);
    for (const p of P){ p.vy += 900*dt; p.vx *= .99; p.x += p.vx*dt; p.y += p.vy*dt; p.r += p.vr*dt; g.save(); g.translate(p.x,p.y); g.rotate(p.r); g.fillStyle = p.c; g.globalAlpha = Math.max(0, 1-el/3); g.fillRect(-p.w/2,-p.h/2,p.w,p.h); g.restore(); }
    if (el < 3) requestAnimationFrame(f); else c.remove(); };
  requestAnimationFrame(f);
}

/* ── controles: táctil / ratón ── */
function boardAt(px, py){
  if (!G) return -1;
  for (let i=0;i<G.boards.length;i++){
    const r = G.rects[i], b = G.boards[i]; if (!r || !b.local) continue;
    if (G.mode==='online' && i!==0) continue;
    if (G.mode==='local2'){ const mid = G.rects[1].x - 13; if ((i===0 && px < mid) || (i===1 && px >= mid)) return i; continue; }
    return i;
  }
  return -1;
}
const toLocal = (i, px, py) => { const r = G.rects[i]; return [(px - r.x)/r.s, (py - r.y)/r.s]; };
const PTR = {};
cv.addEventListener('pointerdown', e=>{
  if (!G || G.paused) return; ac();
  const i = boardAt(e.clientX, e.clientY); if (i < 0) return;
  const b = G.boards[i], [x, y] = toLocal(i, e.clientX, e.clientY);
  const pk = b.powerAt(x, y); if (pk){ b.arm(pk); return; }
  if (Math.hypot(x - (SX-78), y - (SY+30)) < 26 || Math.hypot(x - SX, y - SY) < R+8){ b.swap(); return; }
  PTR[e.pointerId] = {i, mouse: e.pointerType==='mouse'};
  b.aimAt(x, y);
  try{ cv.setPointerCapture(e.pointerId); }catch(err){}
});
cv.addEventListener('pointermove', e=>{
  if (!G || G.paused) return;
  const p = PTR[e.pointerId];
  if (p){ const [x, y] = toLocal(p.i, e.clientX, e.clientY); G.boards[p.i].aimAt(x, y); return; }
  if (e.pointerType==='mouse' && G.mode!=='local2'){ const i = boardAt(e.clientX, e.clientY); if (i>=0){ const [x,y] = toLocal(i, e.clientX, e.clientY); if (y < SY) G.boards[i].aimAt(x, y); } }
});
const ptrUp = e=>{
  const p = PTR[e.pointerId]; if (!p) return; delete PTR[e.pointerId];
  if (!G || G.paused) return;
  const [x, y] = toLocal(p.i, e.clientX, e.clientY);
  if (y < SY - 6 && x > -20 && x < BW + 20) G.boards[p.i].fire();
};
cv.addEventListener('pointerup', ptrUp);
cv.addEventListener('pointercancel', e=>{ delete PTR[e.pointerId]; });
cv.addEventListener('contextmenu', e=>e.preventDefault());

/* ── teclado ── */
addEventListener('keydown', e=>{
  KEYS[e.code] = true;
  if (!G) return;
  if (e.code==='Escape' || e.code==='KeyP'){ if ($('#modal')) resume(); else pause(); return; }
  if (G.paused || $('#modal')) return;
  const two = G.mode==='local2', A = G.boards[0], B = two ? G.boards[1] : null;
  const P1 = two ? {fire:['KeyW','Space'], swap:['KeyS'], pw:['Digit1','Digit2','Digit3']} : {fire:['Space','ArrowUp','KeyW','Enter'], swap:['ArrowDown','KeyS'], pw:['Digit1','Digit2','Digit3']};
  if (P1.fire.includes(e.code)){ A.fire(); e.preventDefault(); }
  if (P1.swap.includes(e.code)){ A.swap(); e.preventDefault(); }
  if (P1.pw.includes(e.code)) A.arm(PW_KEYS[P1.pw.indexOf(e.code)]);
  if (B){
    if (e.code==='ArrowUp' || e.code==='Enter'){ B.fire(); e.preventDefault(); }
    if (e.code==='ArrowDown'){ B.swap(); e.preventDefault(); }
    const k2 = ['Digit8','Digit9','Digit0'].indexOf(e.code); if (k2>=0) B.arm(PW_KEYS[k2]);
  }
});
addEventListener('keyup', e=>{ KEYS[e.code] = false; });
function keyAim(dt){
  if (!G) return;
  const sp = 1.9*dt, two = G.mode==='local2', A = G.boards[0];
  if (two){
    if (KEYS.KeyA) A.aimBy(-sp); if (KEYS.KeyD) A.aimBy(sp);
    const B = G.boards[1]; if (KEYS.ArrowLeft) B.aimBy(-sp); if (KEYS.ArrowRight) B.aimBy(sp);
  } else if (A && A.local){
    if (KEYS.ArrowLeft || KEYS.KeyA) A.aimBy(-sp); if (KEYS.ArrowRight || KEYS.KeyD) A.aimBy(sp);
  }
}
document.addEventListener('visibilitychange', ()=>{ if (document.hidden && G && !G.over && G.mode!=='online' && !G.paused) pause(); });
