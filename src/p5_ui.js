
/* ═════════════ USUARIO Y PROGRESO ═════════════ */
let USER = LS.get('user', null);
function setUser(r){ USER = {ses:r.ses, user:r.user}; LS.set('user', USER); LS.del('guest'); syncProg(); }
function logout(silent){ if (USER && !silent) api('salir', {ses:USER.ses}); USER = null; LS.del('user'); }
async function refreshUser(){ if (!USER) return; const r = await api('yo', {ses:USER.ses}, 10000); if (r.ok){ USER.user = r.user; LS.set('user', USER); } else if (r.error==='SESION'){ logout(true); } }
async function syncProg(){
  const loc = LS.get('prog', {}); if (!USER || !Object.keys(loc).length) return;
  const r = await api('sync', {ses:USER.ses, progreso:loc}); if (r.ok){ USER.user = r.user; LS.set('user', USER); }
}
function prog(){
  const p = Object.assign({}, LS.get('prog', {}));
  if (USER && USER.user && USER.user.progreso){ const s = USER.user.progreso; for (const k in s){ const a = p[k] || [0,0]; p[k] = [Math.max(a[0], s[k][0]), Math.max(a[1], s[k][1])]; } }
  return p;
}
const unlocked = (n, p) => n===1 || !!(p||prog())[n-1];
function totals(){ const p = prog(); let e = 0, pts = 0, max = 0; for (const k in p){ e += p[k][0]; pts += p[k][1]; max = Math.max(max, +k); } return {e, pts, max, p}; }
function nextLevel(){ const p = prog(); for (let n=1;n<=NIV;n++) if (!p[n]) return n; return NIV; }

/* ═════════════ COMPARTIR / INSTALAR ═════════════ */
/* compartir: solo texto con el enlace dentro (sin adjuntar imagen), así WhatsApp crea la tarjeta con og:image y se puede pulsar */
function share(text, url){
  url = url || BASE;
  const msg = text + '\n👉 ' + url;
  if (navigator.share) navigator.share({text: msg}).catch(()=>{});
  else window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank');
}
const SHARE_TXT = '🚀🫧 Dispara burbujas de energía y salva la galaxia en ORBITAL POP. ¡100 niveles y modo a dobles, gratis!';
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', e=>{ e.preventDefault(); deferredInstall = e; });
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
function instalar(){
  if (isStandalone) return toast('✅ ORBITAL POP ya está instalado');
  if (deferredInstall){ deferredInstall.prompt(); deferredInstall.userChoice.finally(()=>deferredInstall=null); return; }
  if (isIOS) return modal(`<h2 class="t">📲 INSTALAR EN IPHONE</h2><div class="howto">
    <p>1. Abre esta página en <b>Safari</b>.</p><p>2. Pulsa el botón <b>Compartir</b> <span style="font-size:22px">⬆️</span> de abajo.</p>
    <p>3. Elige <b>"Añadir a pantalla de inicio"</b>.</p><p>4. Pulsa <b>Añadir</b>. ¡Ya tienes el juego como una app!</p></div>
    <button class="btn cy" onclick="closeModal()">Entendido</button>`);
  modal(`<h2 class="t">📲 INSTALAR</h2><div class="howto"><p>Abre el menú del navegador <b>⋮</b> y pulsa <b>"Instalar aplicación"</b> o <b>"Añadir a pantalla de inicio"</b>.</p></div><button class="btn cy" onclick="closeModal()">Entendido</button>`);
}
if ('serviceWorker' in navigator) window.addEventListener('load', ()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));

/* ═════════════ MODAL ═════════════ */
function modal(html, onClose){
  closeModal();
  const o = document.createElement('div'); o.className = 'ov'; o.id = 'modal';
  o.innerHTML = `<div class="modal glass">${html}</div>`;
  o.addEventListener('click', e=>{ if (e.target===o){ closeModal(); onClose && onClose(); } });
  document.body.appendChild(o); return o;
}
function closeModal(){ const m = $('#modal'); if (m) m.remove(); }

/* ═════════════ LOGO (10 toques = panel admin) ═════════════ */
function logoHTML(){
  const orbs = [0,1,2,3,4,5].map(i=>`<i style="background:radial-gradient(circle at 35% 30%,#fff,${COL[i].c} 45%,${COL[i].d});box-shadow:0 0 10px ${COL[i].c};animation-delay:${i*.12}s"></i>`).join('');
  return `<div class="logo" id="logoBox"><div class="pre">FUTURMOVIL PRESENTA</div>
    ${IMG.logo ? `<img class="lg" src="${IMG.logo.src}" alt="ORBITAL POP">` : '<h1>ORBITAL<br>POP</h1>'}
    <div class="orbs">${orbs}</div></div>`;
}
function logoTaps(el){ if (!el) return; let n = 0, t = 0; el.addEventListener('click', ()=>{ n++; clearTimeout(t); t = setTimeout(()=>n=0, 1500); if (n >= 10){ n = 0; Admin.abrir(); } }); }
function holdBtn(el, ms, onHold, onClick){
  let t = null, start = 0, raf = 0, fired = false;
  const prog = ()=>{ const p = Math.min(1,(Date.now()-start)/ms); el.style.setProperty('--hold', (p*100)+'%'); if (p<1) raf = requestAnimationFrame(prog); };
  const down = ()=>{ fired = false; start = Date.now(); t = setTimeout(()=>{ fired = true; vib(60); el.style.setProperty('--hold','0%'); onHold(); }, ms); prog(); };
  const up = ()=>{ clearTimeout(t); cancelAnimationFrame(raf); el.style.setProperty('--hold','0%'); };
  el.addEventListener('pointerdown', down); el.addEventListener('pointerup', up); el.addEventListener('pointerleave', up); el.addEventListener('pointercancel', up);
  el.addEventListener('contextmenu', e=>e.preventDefault());
  el.addEventListener('click', e=>{ if (fired){ e.preventDefault(); e.stopPropagation(); fired = false; return; } onClick && onClick(e); });
}

/* ═════════════ MENÚ PRINCIPAL ═════════════ */
function showMenu(){
  closeModal();
  if (G) exitGame();
  const T = totals(), u = USER && USER.user;
  const nl = nextLevel();
  app.innerHTML = `<div class="screen"><div class="menu glass split">
    <div class="colL">
      ${logoHTML()}
      ${PUB.mant ? `<div class="banner" style="border-color:var(--rd)">🛠 ${esc(PUB.mantMsg)}</div>` : ''}
      ${PUB.banner ? `<div class="banner">📢 ${esc(PUB.banner)}</div>` : ''}
      <div class="who">${u ? `<span>👤 <b>${esc(u.nombre)}</b></span><button class="lnk" id="bOut">Salir</button>` : `<span>🎮 Jugando sin cuenta</span><button class="lnk" id="bIn">Entrar / crear cuenta</button>`}</div>
      <div class="stats">
        <div class="stat"><b style="color:#ffd23f">${T.e}</b><small>de 300 ⭐</small></div>
        <div class="stat"><b>${T.max}</b><small>Niveles</small></div>
        <div class="stat"><b>${u ? u.victorias : '—'}</b><small>Victorias</small></div>
      </div>
    </div>
    <div class="colR">
      <button class="btn huge cy pulse" id="bPlay">▶ ${T.max ? 'CONTINUAR · NIVEL '+nl : 'JUGAR'}</button>
      <button class="btn big" id="bMap">🗺 MAPA DE LA GALAXIA</button>
      <button class="btn big mg" id="bVs">👥 2 JUGADORES</button>
      <div class="row"><button class="btn am" id="bRk">🏆 RANKING</button><button class="btn ghost" id="bHow">❓ CÓMO SE JUEGA</button></div>
      <div class="icons">
        <button class="btn ghost" id="bSnd" title="Sonido">${AU.on?'🔊':'🔇'}</button>
        <button class="btn ghost" id="bMus" title="Música">${AU.mus?'🎵':'🚫'}</button>
        <button class="btn ghost" id="bInst" title="Instalar">📲</button>
        <button class="btn ghost" id="bShare" title="Compartir">📤</button>
      </div>
      <div class="ptxt" style="font-size:12px;letter-spacing:3px;font-family:Orbitron">UN JUEGO DE FUTURMOVIL</div>
    </div>
  </div></div>`;
  logoTaps($('#logoBox'));
  $('#bPlay').onclick = ()=>{ SFX.click(); ac(); MUS.sync(); startSolo(nl); };
  $('#bMap').onclick = ()=>{ SFX.click(); showMap(); };
  $('#bVs').onclick = ()=>{ SFX.click(); showDobles(); };
  $('#bRk').onclick = ()=>{ SFX.click(); showRanking(); };
  $('#bHow').onclick = ()=>{ SFX.click(); howTo(); };
  $('#bSnd').onclick = ()=>{ ac(); setSound(!AU.on); MUS.sync(); SFX.click(); showMenu(); };
  $('#bMus').onclick = ()=>{ ac(); setMusic(!AU.mus); showMenu(); };
  $('#bInst').onclick = instalar;
  $('#bShare').onclick = ()=>share(SHARE_TXT);
  if ($('#bOut')) $('#bOut').onclick = ()=>{ logout(); showLogin(); };
  if ($('#bIn')) $('#bIn').onclick = ()=>showLogin();
}
document.addEventListener('pointerdown', ()=>{ ac(); MUS.sync(); }, {once:true});

function howTo(){
  modal(`<h2 class="t">❓ CÓMO SE JUEGA</h2><div class="howto">
    <p>🎯 <b>Apunta</b> arrastrando el dedo (o con el ratón / ← →) y <b>suelta</b> para disparar (clic o espacio en el ordenador).</p>
    <p>🫧 Junta <b>3 o más</b> burbujas del mismo color y explotan. Las que se quedan colgando sin nada que las sujete <b>caen</b> y dan muchos más puntos.</p>
    <p>🔄 Toca la burbuja del cañón o la <b>siguiente</b> para cambiarlas (↓ en el teclado).</p>
    <p>🧱 Rebota en las paredes para llegar a los huecos difíciles. Cada pocos disparos <b>el techo baja</b>: si una burbuja cruza la <b style="color:var(--rd)">línea roja</b>, pierdes.</p>
    <p>⚙️ Las burbujas de <b>metal</b> no explotan: hay que dejarlas caer. Las <b>bombas</b> explotan si revientas algo a su lado.</p>
    <p>⚡ Llena la barra de energía y ganas poderes: 💣 <b>Bomba</b>, 🌈 <b>Arcoíris</b> y ⚡ <b>Rayo</b> (teclas 1, 2, 3).</p>
    <p>⭐ Cuantos menos disparos uses, más estrellas. ¡Hay 100 niveles en 10 sectores!</p>
    <p>👥 <b>A dobles</b>: lo que tiras al rival se convierte en burbujas en su tablero. Pierde quien cruce antes la línea roja.</p></div>
    <button class="btn cy" onclick="closeModal()">¡A JUGAR!</button>`);
}

/* ═════════════ MAPA DE NIVELES ═════════════ */
let mapSect = -1;
function showMap(sect){
  closeModal();
  const T = totals(), p = T.p;
  if (sect == null) sect = mapSect >= 0 ? mapSect : Math.floor((nextLevel()-1)/10);
  mapSect = sect;
  const sc = SECT[sect], nl = nextLevel();
  BG.setHue(sc.h);
  const sStars = n => { let e = 0; for (let i=n*10+1;i<=n*10+10;i++) e += (p[i]||[0])[0]; return e; };
  app.innerHTML = `<div class="screen"><div class="menu glass wide" style="--sc:${sc.c}">
    <div class="mapHead"><button class="btn ghost sm" id="mBack">←</button><h2>🗺 GALAXIA</h2><div class="hb" style="min-width:auto"><b style="color:#ffd23f">${T.e}</b><small>⭐ / 300</small></div></div>
    <div class="sectTabs">${SECT.map((s,i)=>`<button class="${i===sect?'on':''} ${unlocked(i*10+1,p)?'':'lock'}" data-s="${i}" style="--sc:${s.c}">${unlocked(i*10+1,p)?i+1:'🔒'}</button>`).join('')}</div>
    <div class="sectName">SECTOR ${sect+1} · ${sc.n}</div>
    <div class="ptxt" style="font-size:14px;margin-top:-6px">${sStars(sect)} de 30 ⭐ en este sector</div>
    <div class="lvls">${Array.from({length:10},(_,i)=>{ const n = sect*10+i+1, ok = unlocked(n,p), st = (p[n]||[0])[0];
      return `<button class="lv ${ok?'':'lock'} ${n===nl?'cur':''}" data-n="${n}" ${ok?'':'disabled'}>${ok?n:'🔒'}${ok&&st?`<span class="st">${'⭐'.repeat(st)}</span>`:''}</button>`; }).join('')}</div>
    <div class="row"><button class="btn ghost sm" id="mPrev" ${sect?'':'disabled'}>◀ Sector</button><button class="btn ghost sm" id="mNext" ${sect<9?'':'disabled'}>Sector ▶</button></div>
    ${USER ? '' : '<div class="ptxt" style="font-size:14px">💾 Sin cuenta el progreso solo se guarda en este dispositivo. <a class="lnk" id="mIn">Entrar para guardarlo en la nube</a></div>'}
  </div></div>`;
  $('#mBack').onclick = ()=>{ SFX.click(); showMenu(); };
  app.querySelectorAll('.sectTabs button').forEach(b=>b.onclick=()=>{ SFX.click(); showMap(+b.dataset.s); });
  app.querySelectorAll('.lv').forEach(b=>b.onclick=()=>{ if (b.disabled) return; SFX.click(); ac(); MUS.sync(); startSolo(+b.dataset.n); });
  $('#mPrev').onclick = ()=>showMap(sect-1); $('#mNext').onclick = ()=>showMap(sect+1);
  if ($('#mIn')) $('#mIn').onclick = ()=>showLogin();
}

/* ═════════════ RANKING ═════════════ */
let RK = null, rkTab = 'estrellas';
async function showRanking(tab){
  rkTab = tab || rkTab;
  const pinta = ()=>{
    const list = RK ? (RK[rkTab]||[]) : null, yo = USER ? USER.user.nombre : '', m = $('#modal'); if (!m) return;
    const val = r => rkTab==='estrellas' ? `${r.e} ⭐` : rkTab==='puntos' ? fmt(r.p) : `${r.v} 🏆`;
    m.querySelector('.modal').innerHTML = `<h2 class="t">🏆 RANKING</h2>
      <div class="segm">${[['estrellas','⭐ Estrellas'],['puntos','Puntos'],['dobles','👥 Dobles']].map(([k,t])=>`<button class="${rkTab===k?'on':''}" data-k="${k}">${t}</button>`).join('')}</div>
      <div class="rk">${!list ? '<div class="spinner"></div>' : list.length ? list.map((r,i)=>`<div class="r ${r.n===yo?'me':''}"><span class="p">${i+1}</span><span class="n">${esc(r.n)}</span><span class="s">${val(r)}</span></div>`).join('')
        : '<div class="ptxt">Todavía no hay nadie. ¡Sé el primero!</div>'}</div>
      ${USER ? '' : '<div class="ptxt" style="font-size:14px">Crea una cuenta para salir en el ranking.</div>'}
      <button class="btn ghost" onclick="closeModal()">Cerrar</button>`;
    m.querySelectorAll('.segm button').forEach(b=>b.onclick=()=>{ rkTab = b.dataset.k; pinta(); });
  };
  modal('<div class="spinner"></div>'); pinta();
  const r = await api('ranking'); if (r.ok){ RK = r.ranking; pinta(); } else if (!RK) toast(r.error, 1);
}

/* ═════════════ LOGIN ═════════════ */
function loadGoogle(cb){
  if (window.google && google.accounts) return cb();
  if (document.getElementById('gsi')){ const i = setInterval(()=>{ if (window.google && google.accounts){ clearInterval(i); cb(); } }, 200); return; }
  const s = document.createElement('script'); s.id = 'gsi'; s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.onload = cb; document.head.appendChild(s);
}
function showLogin(vista){
  closeModal(); if (G) exitGame();
  vista = vista || 'entrar';
  const tabs = `<div class="segm"><button class="${vista==='entrar'?'on':''}" data-v="entrar">Entrar</button><button class="${vista==='registro'?'on':''}" data-v="registro">Crear cuenta</button></div>`;
  let form = '';
  if (vista==='entrar') form = `
    <div class="lbl">Correo</div><input class="inp" id="lEmail" type="email" autocomplete="username" placeholder="tu@correo.com">
    <div class="lbl">Contraseña</div><input class="inp" id="lPass" type="password" autocomplete="current-password" placeholder="••••••">
    <button class="btn big cy holdable" id="bEntrar">ENTRAR</button>
    <button class="lnk" id="bOlv">¿Has olvidado la contraseña?</button>`;
  else if (vista==='registro') form = `
    <div class="lbl">Nombre de jugador</div><input class="inp" id="rNom" maxlength="16" autocomplete="nickname" placeholder="Así saldrás en el ranking">
    <div class="lbl">Correo</div><input class="inp" id="rEmail" type="email" autocomplete="username" placeholder="tu@correo.com">
    <div class="lbl">Contraseña</div><input class="inp" id="rPass" type="password" autocomplete="new-password" placeholder="Mínimo 6 caracteres">
    <button class="btn big cy" id="bReg">CREAR CUENTA</button>`;
  else form = `
    <div class="ptxt" style="font-size:15px">Te enviamos un código a tu correo para poner una contraseña nueva.</div>
    <div class="lbl">Correo</div><input class="inp" id="cEmail" type="email" placeholder="tu@correo.com">
    <button class="btn" id="bCod">📧 Enviarme el código</button>
    <div class="lbl">Código</div><input class="inp" id="cCod" inputmode="numeric" maxlength="6" placeholder="123456">
    <div class="lbl">Contraseña nueva</div><input class="inp" id="cPass" type="password" autocomplete="new-password" placeholder="Mínimo 6 caracteres">
    <button class="btn big cy" id="bRes">CAMBIAR Y ENTRAR</button>
    <button class="lnk" id="bVolv">← Volver</button>`;
  app.innerHTML = `<div class="screen"><div class="menu glass">
    ${logoHTML()}
    <div class="ptxt" style="font-size:15px;margin:-2px 0 2px">Entra para guardar tu progreso de los 100 niveles en la nube y salir en el ranking.</div>
    ${vista!=='recuperar' ? tabs : ''}
    ${form}
    ${vista!=='recuperar' ? '<div class="sep"><span>o</span></div><div id="gBtn" class="gBtn"></div>' : ''}
    <button class="btn ghost" id="bGuest">🎮 Jugar sin cuenta</button>
    <div class="row"><button class="btn ghost sm" id="bInst">📲 Instalar</button><button class="btn ghost sm" id="bShare">📤 Compartir</button></div>
  </div></div>`;
  logoTaps($('#logoBox'));
  const done = r=>{ setUser(r); SFX.power(); toast('👋 ¡Hola, '+r.user.nombre+'!'); showMenu(); };
  app.querySelectorAll('.segm button').forEach(b=>b.onclick=()=>showLogin(b.dataset.v));
  $('#bGuest').onclick = ()=>{ LS.set('guest', true); showMenu(); };
  $('#bInst').onclick = instalar;
  $('#bShare').onclick = ()=>share(SHARE_TXT);
  if (vista==='entrar'){
    const go = async()=>{ const b = $('#bEntrar'); b.disabled = true;
      try{ done(await call('entrar', {email:$('#lEmail').value, pass:$('#lPass').value})); }catch(e){ toast(errMsg(e),1); b.disabled = false; } };
    holdBtn($('#bEntrar'), 3000, ()=>Admin.abrir(), go);
    $('#lPass').onkeydown = e=>{ if (e.key==='Enter') go(); };
    $('#bOlv').onclick = ()=>showLogin('recuperar');
  }
  if (vista==='registro') $('#bReg').onclick = async()=>{ const b = $('#bReg'); b.disabled = true;
    try{ done(await call('registro', {nombre:$('#rNom').value, email:$('#rEmail').value, pass:$('#rPass').value})); }catch(e){ toast(errMsg(e),1); b.disabled = false; } };
  if (vista==='recuperar'){
    $('#bVolv').onclick = ()=>showLogin('entrar');
    $('#bCod').onclick = async()=>{ try{ await call('recuperar', {email:$('#cEmail').value}); toast('📧 Código enviado. Mira tu correo (y el spam)'); }catch(e){ toast(errMsg(e),1); } };
    $('#bRes').onclick = async()=>{ try{ done(await call('restablecer', {email:$('#cEmail').value, codigo:$('#cCod').value, pass:$('#cPass').value})); }catch(e){ toast(errMsg(e),1); } };
  }
  if ($('#gBtn')) loadGoogle(()=>{
    try{
      google.accounts.id.initialize({client_id:CFG.GOOGLE, ux_mode:'popup', callback: async r=>{
        toast('Comprobando tu cuenta de Google…');
        try{ done(await call('google', {credential:r.credential})); }catch(e){ toast(errMsg(e),1); }
      }});
      google.accounts.id.renderButton($('#gBtn'), {theme:'filled_black', size:'large', shape:'pill', text:'continue_with', width: Math.min(360, $('#gBtn').offsetWidth||320)});
    }catch(e){}
  });
}

/* ════════════════════════════════════════════════════════════
   A DOBLES ONLINE: conexión directa entre los dos móviles (WebRTC).
   Apps Script solo guarda la "invitación" del QR para emparejarlos.
   Cada móvil mueve su propio tablero y manda su estado al otro.
   ════════════════════════════════════════════════════════════ */
const ICE = {iceServers:[{urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302','stun:stun.cloudflare.com:3478']}]};
const Net = (()=>{
  let pc = null, dc = null, role = null, code = null, pollT = 0, names = ['',''], timeoutT = 0;
  const myName = ()=> (USER && USER.user.nombre) || LS.get('name','') || '';
  function waitIce(){ return new Promise(res=>{ if (pc.iceGatheringState==='complete') return res(); const t = setTimeout(res, 3500);
    pc.addEventListener('icegatheringstatechange', ()=>{ if (pc.iceGatheringState==='complete'){ clearTimeout(t); res(); } }); }); }
  function send(o){ try{ if (dc && dc.readyState==='open') dc.send(JSON.stringify(o)); }catch(e){} }
  function close(bye){
    if (bye) send({t:'bye'});
    clearInterval(pollT); clearTimeout(timeoutT);
    const d = dc, p = pc; dc = pc = null; role = null;
    setTimeout(()=>{ try{ d && d.close(); }catch(e){} try{ p && p.close(); }catch(e){} }, bye ? 200 : 0);
  }
  function setupDc(ch){
    dc = ch;
    dc.onopen = ()=>{ clearTimeout(timeoutT); if (role==='host'){ SFX.power(); restart(); } };
    dc.onclose = ()=>{ if (G && G.mode==='online' && role) lost(); };
    dc.onmessage = ev=>{ let m; try{ m = JSON.parse(ev.data); }catch(e){ return; } onMsg(m); };
  }
  function lost(){
    role = null;
    if (G && G.mode==='online' && !G.over){ toast('Se ha cortado la conexión con tu rival', 1); closeModal(); exitGame(); showMenu(); }
  }
  function restart(){
    if (role !== 'host') return;
    const seed = Math.floor(Math.random()*1e9);
    send({t:'start', seed, names});
    startOnline(seed, names, 0);
  }
  function onMsg(m){
    if (m.t==='start'){ names = m.names || names; startOnline(m.seed, names, 1); return; }
    if (m.t==='again'){ if (role==='host') restart(); return; }
    if (m.t==='bye'){ if (G && G.mode==='online' && !G.over){ toast('Tu rival ha salido de la partida', 1); rivalLost(); } role = null; close(); return; }
    if (!G || G.mode!=='online') return;
    if (m.t==='s'){ G.boards[1].apply(m); }
    else if (m.t==='atk'){ G.boards[0].garbage += m.n; SFX.hurt(); }
    else if (m.t==='lose'){ rivalLost(); }
  }

  async function host(){
    close(); role = 'host'; names = [myName() || 'Jugador 1', ''];
    modal(`<h2 class="t">👥 A DOBLES</h2><div class="ptxt">Preparando la sala…</div><div class="spinner"></div><button class="btn ghost" id="nCan">Cancelar</button>`);
    $('#nCan').onclick = ()=>{ close(); closeModal(); };
    try{
      pc = new RTCPeerConnection(ICE);
      setupDc(pc.createDataChannel('orbital', {ordered:true}));
      await pc.setLocalDescription(await pc.createOffer()); await waitIce();
      const r = await call('salaCrear', {sdp: pc.localDescription.sdp, nombre: names[0]});
      code = r.code;
      const url = BASE + '?dobles=' + code;
      modal(`<h2 class="t">👥 A DOBLES</h2>
        <div class="ptxt">Tu rival escanea este código con su móvil para unirse (no hace falta cuenta)</div>
        <div id="nQr" style="background:#fff;padding:12px;border-radius:16px;align-self:center"></div>
        <div style="text-align:center;font-family:Orbitron;font-weight:900;font-size:34px;letter-spacing:10px;color:#2bf0ff;text-shadow:0 0 14px #2bf0ff">${code}</div>
        <div class="ptxt" style="font-size:14px">o que entre en el juego, pulse <b>2 JUGADORES → Unirme</b> y escriba el código</div>
        <div class="ptxt" id="nSt"><div class="spinner" style="width:24px;height:24px;margin:0 auto 6px"></div>Esperando a tu rival…</div>
        <div class="row"><button class="btn" id="nSh">📤 Enviar enlace</button><button class="btn ghost" id="nCan">Cancelar</button></div>`, ()=>close());
      drawQR($('#nQr'), url, 210);
      $('#nSh').onclick = ()=>share('🫧⚔ ¡Te reto a ORBITAL POP a dobles! Código de sala: '+code, url);
      $('#nCan').onclick = ()=>{ close(); closeModal(); };
      let busy = false;
      pollT = setInterval(async ()=>{
        if (busy || !pc) return; busy = true;
        const s = await api('salaVer', {code, rol:'host'}, 8000); busy = false;
        if (!s.ok){ if (/caducado|no existe/.test(s.error||'')){ clearInterval(pollT); const e = $('#nSt'); if (e) e.innerHTML = '⌛ La sala ha caducado. Crea otra.'; } return; }
        if (s.a && pc && !pc.remoteDescription){
          clearInterval(pollT); names[1] = s.gn || 'Jugador 2';
          const e = $('#nSt'); if (e) e.innerHTML = `<b style="color:#ff2bd6">${esc(names[1])}</b> se está uniendo…`;
          try{ await pc.setRemoteDescription({type:'answer', sdp:s.a}); }catch(err){ failed(); }
          timeoutT = setTimeout(failed, 20000);
        }
      }, 1300);
    }catch(e){ toast(errMsg(e), 1); close(); closeModal(); }
  }
  async function join(c, nombre){
    close(); role = 'guest'; code = String(c||'').toUpperCase().replace(/[^A-Z]/g,'');
    names = ['', (nombre || myName() || 'Jugador 2').slice(0,16)];
    LS.set('name', names[1]);
    modal(`<h2 class="t">👥 UNIÉNDOTE…</h2><div class="ptxt">Conectando con la sala <b style="color:#2bf0ff">${esc(code)}</b></div><div class="spinner"></div><button class="btn ghost" id="nCan">Cancelar</button>`, ()=>close());
    $('#nCan').onclick = ()=>{ close(); closeModal(); showMenu(); };
    try{
      const s = await call('salaVer', {code, rol:'guest'});
      names[0] = s.hn || 'Jugador 1';
      pc = new RTCPeerConnection(ICE);
      pc.ondatachannel = ev=>setupDc(ev.channel);
      await pc.setRemoteDescription({type:'offer', sdp:s.o});
      await pc.setLocalDescription(await pc.createAnswer()); await waitIce();
      await call('salaUnir', {code, sdp: pc.localDescription.sdp, nombre: names[1]});
      const st = $('#modal .ptxt'); if (st) st.innerHTML = `Conectando con <b style="color:#2bf0ff">${esc(names[0])}</b>…`;
      timeoutT = setTimeout(failed, 20000);
    }catch(e){ toast(errMsg(e), 1); close(); closeModal(); showMenu(); }
  }
  function failed(){
    if (dc && dc.readyState==='open') return;
    toast('No se ha podido conectar. Poneos los dos en la misma wifi e inténtalo otra vez.', 1);
    close(); closeModal(); if (!G) showMenu();
  }
  return { host, join, send, close, restart, get role(){ return role; } };
})();

function showDobles(){
  modal(`<h2 class="t">👥 2 JUGADORES</h2>
    <div class="ptxt">Lo que hagas caer en tu tablero <b>le llega al rival</b> como burbujas extra. Pierde quien cruce antes la línea roja.</div>
    <button class="btn big" id="dLoc">🖥 EN ESTE DISPOSITIVO</button>
    <div class="ptxt" style="font-size:13px;margin-top:-6px">Mejor en tablet u ordenador. Teclado: J1 A/D/W/S · J2 flechas</div>
    <button class="btn huge mg" id="dCrear">📱 CREAR SALA ONLINE</button>
    <div class="sep"><span>o únete a la de tu amigo</span></div>
    <div class="lbl">Tu nombre</div><input class="inp" id="dNom" maxlength="16" placeholder="Cómo te verá tu rival" value="${esc((USER&&USER.user.nombre)||LS.get('name',''))}">
    <div class="lbl">Código de la sala</div><input class="inp" id="dCod" maxlength="4" placeholder="ABCD" style="text-transform:uppercase;letter-spacing:8px;text-align:center;font-family:Orbitron">
    <button class="btn" id="dUnir">🔗 UNIRME</button>
    <button class="btn ghost" onclick="closeModal()">Cerrar</button>`);
  $('#dLoc').onclick = ()=>{ SFX.click(); startLocal2(); };
  $('#dCrear').onclick = ()=>{
    if (!('RTCPeerConnection' in window)) return toast('Este navegador no permite jugar online', 1);
    const n = $('#dNom').value.trim(); if (n) LS.set('name', n); Net.host(); };
  $('#dUnir').onclick = ()=>{ const c = $('#dCod').value.trim(); if (c.length < 4) return toast('Escribe el código de 4 letras', 1); Net.join(c, $('#dNom').value.trim()); };
}
function showJoinDobles(code){
  modal(`<h2 class="t">⚔ TE HAN RETADO</h2>
    <div class="ptxt">Vas a jugar a dobles en la sala <b style="color:#2bf0ff;font-family:Orbitron;letter-spacing:3px">${esc(code)}</b></div>
    <div class="lbl">Tu nombre</div><input class="inp" id="jNom" maxlength="16" placeholder="Tu nombre" value="${esc((USER&&USER.user.nombre)||LS.get('name',''))}">
    <button class="btn huge mg" id="jGo">🎮 ¡A JUGAR!</button>
    <button class="btn ghost" id="jNo">Ahora no</button>`);
  $('#jGo').onclick = ()=>{ ac(); const n = $('#jNom').value.trim(); if (!n) return toast('Pon tu nombre', 1); history.replaceState(null,'',location.pathname); Net.join(code, n); };
  $('#jNo').onclick = ()=>{ closeModal(); history.replaceState(null,'',location.pathname); showMenu(); };
}
function drawQR(el, text, size){
  try{ const q = qrcode(0,'M'); q.addData(text); q.make(); const cell = Math.max(2, Math.ceil(size/q.getModuleCount()));
    el.innerHTML = `<img src="${q.createDataURL(cell,0)}" width="${size}" height="${size}" style="image-rendering:pixelated;display:block" alt="QR">`; }
  catch(e){ el.innerHTML = `<div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;color:#000;font-weight:700">${esc(text)}</div>`; }
}

/* ═════════════ PANEL ADMIN (oculto: 10 toques al título · solo llave NFC) ═════════════ */
const NFC_SVG = '<svg viewBox="0 0 64 64"><rect x="14" y="6" width="36" height="52" rx="7" fill="none" stroke="currentColor" stroke-width="3"/><path d="M27 24a9 9 0 0 1 0 16M33 19a16 16 0 0 1 0 26M39 14a23 23 0 0 1 0 36" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>';
const Admin = (()=>{
  let ADM = null, D = null, nfcCtrl = null, nfcBusy = false;
  try{ ADM = sessionStorage.getItem('op_adm'); }catch(e){}
  const hayNfc = 'NDEFReader' in window;
  const setAdm = t=>{ ADM = t; try{ sessionStorage.setItem('op_adm', t); }catch(e){} };
  function pararNfc(){ if (nfcCtrl){ try{ nfcCtrl.abort(); }catch(e){} nfcCtrl = null; } nfcBusy = false; }
  async function escuchar(onSerial, t){
    pararNfc();
    try{
      nfcCtrl = new AbortController(); const r = new NDEFReader();
      await r.scan({signal:nfcCtrl.signal});
      t('📡 Esperando la llave… acércala a la parte de atrás del móvil');
      r.onreading = async ev=>{
        if (nfcBusy) return; nfcBusy = true; vib(80);
        try{ await onSerial(String(ev.serialNumber||'').replace(/:/g,'')); pararNfc(); }
        catch(e){ toast(errMsg(e),1); t('Vuelve a acercar la llave'); nfcBusy = false; }
      };
    }catch(e){ pararNfc(); t('Toca el botón para activar el lector NFC'); }
  }
  function abrir(){
    SFX.click();
    if (ADM) return panel();
    modal(`<div style="text-align:center;display:flex;flex-direction:column;gap:10px">
      <div class="nfcAnim">${NFC_SVG}</div><h2 class="t">ACCESO RESTRINGIDO</h2>
      ${hayNfc ? `<div class="ptxt" id="aTxt">Activando lector…</div><button class="btn cy hidden" id="bNfc">🔑 Activar lector NFC</button>` : '<div class="ptxt">Este dispositivo no tiene NFC. Entra desde tu móvil Android con la llave.</div>'}
      <button class="btn ghost" id="aCerrar">Cerrar</button></div>`, pararNfc);
    $('#aCerrar').onclick = ()=>{ pararNfc(); closeModal(); };
    if (hayNfc){
      const txt = t=>{ const e = $('#aTxt'); if (e) e.textContent = t; const b = $('#bNfc'); if (b) b.classList.toggle('hidden', !/Toca el botón/.test(t)); };
      const ok = async serial=>{ const r = await call('admLlave', {llave:serial, ses:USER&&USER.ses});
        if (r.nueva) toast('🔑 Llave registrada como llave de admin'); setAdm(r.adm); SFX.power(); panel(); };
      $('#bNfc').onclick = ()=>escuchar(ok, txt);
      escuchar(ok, txt);
    }
  }
  async function adm(op, d){
    const r = await api('adm', {adm:ADM, op, d});
    if (!r.ok){ if (r.error==='ADMIN'){ ADM = null; try{ sessionStorage.removeItem('op_adm'); }catch(e){} closeModal(); toast('La sesión de admin ha caducado',1); } throw new Error(r.error); }
    return r;
  }
  async function panel(){
    modal('<h2 class="t">🛠 PANEL ADMIN</h2><div class="spinner"></div>');
    try{ D = await adm('resumen'); pinta(); }catch(e){ toast(errMsg(e),1); }
  }
  function pinta(){
    const m = $('#modal .modal'); if (!m) return; m.style.maxWidth = '760px';
    const a = D.ajustes;
    m.innerHTML = `<h2 class="t">🛠 PANEL ADMIN</h2>
      <div class="stats"><div class="stat"><b>${D.usuarios.length}</b><small>Jugadores</small></div><div class="stat"><b>${D.partidasHoy}</b><small>Niveles hoy</small></div><div class="stat"><b>${D.partidasTotal}</b><small>Niveles total</small></div></div>
      <div class="lbl">Aviso en el menú</div><input class="inp" id="aBan" value="${esc(a.banner)}" placeholder="Ej: ¡Torneo este fin de semana!">
      <label class="chk"><input type="checkbox" id="aMant" ${a.mant?'checked':''}> Mostrar aviso de mantenimiento</label>
      <input class="inp" id="aMantMsg" value="${esc(a.mantMsg)}">
      <div class="row"><button class="btn cy" id="aSave">💾 Guardar</button><button class="btn ghost" id="aImg">🖼 Recargar imágenes (v${a.imgVer})</button></div>
      <h2 class="t" style="font-size:15px">JUGADORES</h2>
      <div style="overflow:auto;max-height:40vh"><table><tr><th>Jugador</th><th>⭐</th><th>Niv</th><th>🏆</th><th></th></tr>
      ${D.usuarios.map(u=>`<tr><td>${esc(u.nombre)}<br><small style="color:var(--mut)">${esc(u.email)}${u.google?' · G':''}</small></td><td>${u.estrellas}</td><td>${u.nivel}</td><td>${u.v}</td>
        <td style="white-space:nowrap"><button class="btn ghost sm" data-op="todo" data-e="${esc(u.email)}" title="Desbloquear los 100 niveles">🔓</button>
        <button class="btn ghost sm" data-op="reset" data-e="${esc(u.email)}" title="Borrar progreso">♻</button>
        <button class="btn ghost sm" data-op="bloquear" data-e="${esc(u.email)}" data-v="${u.bloq?0:1}">${u.bloq?'Desbloquear':'Bloquear'}</button></td></tr>`).join('')}</table></div>
      <h2 class="t" style="font-size:15px">ÚLTIMOS NIVELES SUPERADOS</h2>
      <div style="overflow:auto;max-height:26vh"><table><tr><th>Fecha</th><th>Jugador</th><th>Nivel</th><th>⭐</th><th>Puntos</th></tr>
      ${D.ultimas.map(p=>`<tr><td>${new Date(p.f).toLocaleString('es-ES',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</td><td>${esc(p.j)}</td><td>${p.l}</td><td>${p.e}</td><td>${fmt(p.p)}</td></tr>`).join('')}</table></div>
      <h2 class="t" style="font-size:15px">SEGURIDAD</h2>
      <div class="ptxt">Llaves NFC registradas: <b>${D.llaves}</b></div>
      <button class="btn ghost sm" id="aLlB" style="align-self:center">Borrar llaves</button>
      <div class="row"><button class="btn ghost" id="aSalir">Salir del panel</button><button class="btn ghost" id="aCer">Cerrar</button></div>`;
    $('#aSave').onclick = async()=>{ try{ const r = await adm('ajustes', {banner:$('#aBan').value, mant:$('#aMant').checked, mantMsg:$('#aMantMsg').value}); D.ajustes = r.ajustes; Object.assign(PUB, {banner:r.ajustes.banner, mant:r.ajustes.mant, mantMsg:r.ajustes.mantMsg}); toast('✅ Guardado'); }catch(e){ toast(errMsg(e),1); } };
    $('#aImg').onclick = async()=>{ try{ const r = await adm('imgVer'); D.ajustes.imgVer = r.imgVer; toast('✅ Las imágenes se recargarán en todos los móviles'); pinta(); }catch(e){ toast(errMsg(e),1); } };
    m.querySelectorAll('[data-op]').forEach(b=>b.onclick=async()=>{
      const op = b.dataset.op;
      if (op==='reset' && !confirm('¿Borrar todo el progreso de '+b.dataset.e+'?')) return;
      try{ await adm(op, {email:b.dataset.e, bloq:b.dataset.v==='1'}); D = await adm('resumen'); pinta(); toast('✅ Hecho'); }catch(e){ toast(errMsg(e),1); } });
    $('#aLlB').onclick = async()=>{ if (!confirm('¿Borrar las llaves NFC? La próxima que acerques con tu sesión de admin quedará registrada.')) return; try{ await adm('llavesBorrar'); D.llaves = 0; toast('Llaves borradas'); pinta(); }catch(e){ toast(errMsg(e),1); } };
    $('#aSalir').onclick = ()=>{ ADM = null; try{ sessionStorage.removeItem('op_adm'); }catch(e){} closeModal(); };
    $('#aCer').onclick = closeModal;
  }
  return { abrir };
})();

/* ═════════════ AUTO-ACTUALIZACIÓN ═════════════ */
async function checkVersion(){
  try{
    const r = await fetch('version.json?t='+Date.now(), {cache:'no-store'}); if (!r.ok) return;
    const v = String((await r.json()).v);
    if (v && v !== APP_V){
      if ((G && !G.over && !document.hidden) || Net.role) return;   // no cortar una partida
      const o = document.createElement('div'); o.className = 'ov'; o.style.zIndex = 99;
      o.innerHTML = '<div style="text-align:center"><div class="spinner"></div><h2 class="t">NUEVA VERSIÓN</h2><p class="ptxt">Actualizando la nave…</p></div>';
      document.body.appendChild(o);
      try{ const ks = await caches.keys(); await Promise.all(ks.map(k=>caches.delete(k))); }catch(e){}
      setTimeout(()=>location.reload(), 1000);
    }
  }catch(e){}
}
setInterval(checkVersion, 60000);
document.addEventListener('visibilitychange', ()=>{ if (!document.hidden) checkVersion(); });
setTimeout(checkVersion, 4000);

/* ═════════════ ARRANQUE ═════════════ */
(async function init(){
  app.innerHTML = `<div class="screen"><div style="text-align:center">${logoHTML()}<div class="spinner"></div></div></div>`;
  const c = await api('config', null, 8000);
  if (c.ok){ PUB = c.cfg; IMGV = String(PUB.imgVer||1); }
  loadImages();
  if (USER) refreshUser().then(()=>{ if (!G && app.querySelector('.stats')) showMenu(); });
  const dob = new URLSearchParams(location.search).get('dobles');
  if (dob){ showMenu(); return showJoinDobles(dob.toUpperCase()); }
  if (USER || LS.get('guest', false)) showMenu(); else showLogin();
})();
</script>
</body>
</html>
