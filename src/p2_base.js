'use strict';
/* ═════════════ CONFIG ═════════════ */
const CFG = {
  API: 'PON_AQUI_LA_URL_EXEC',
  GOOGLE: '454055120059-nuhaop4r62urc3u036cc3grpqo71ulg7.apps.googleusercontent.com'
};
const BASE = 'https://puntofibra.github.io/orbitalpop/';
const APP_V = '1';   // ¡tiene que coincidir SIEMPRE con version.json!
const NIV = 100;
let PUB = {}, IMGV = '1';

/* ═════════════ UTIL ═════════════ */
const $ = s => document.querySelector(s);
const app = $('#app');
const esc = s => String(s==null?'':s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmt = n => Math.round(n).toLocaleString('es-ES');
const clamp = (v,a,b) => v<a?a:v>b?b:v;
const rnd = (a,b) => a + Math.random()*(b-a);
let toastT;
function toast(m, err){
  const t=$('#toast'); t.textContent = m;
  t.className=''; void t.offsetWidth; t.className=(err?'err ':'')+'on';
  if (err) vib(30);
  clearTimeout(toastT); toastT=setTimeout(()=>t.className=(err?'err':''), Math.min(6000, 2400 + m.length*35));
}
function api(accion, d, ms){
  if (/PON_AQUI/.test(CFG.API)) return Promise.resolve({ok:false, error:'El servidor aún no está configurado'});
  const ctl = window.AbortController ? new AbortController() : null;
  const tm = setTimeout(()=>{ try{ ctl && ctl.abort(); }catch(e){} }, ms || 25000);
  return fetch(CFG.API, {method:'POST', body: JSON.stringify(Object.assign({accion}, d||{})), signal: ctl ? ctl.signal : undefined})
    .then(r=>r.json()).catch(()=>({ok:false, error:'Sin conexión. Inténtalo otra vez.'}))
    .finally(()=>clearTimeout(tm));
}
async function call(accion, d){
  const r = await api(accion, d);
  if (!r.ok){ if (r.error==='SESION'){ logout(true); throw new Error('Tu sesión ha caducado. Vuelve a entrar.'); } throw new Error(r.error||'Error'); }
  return r;
}
const errMsg = e => (e && e.message ? e.message : String(e)).replace(/^Error:\s*/,'');
function vib(p){ try{ navigator.vibrate && navigator.vibrate(p); }catch(e){} }
const LS = {
  get(k, d){ try{ const v=localStorage.getItem('op_'+k); return v==null?d:JSON.parse(v); }catch(e){ return d; } },
  set(k, v){ try{ localStorage.setItem('op_'+k, JSON.stringify(v)); }catch(e){} },
  del(k){ try{ localStorage.removeItem('op_'+k); }catch(e){} }
};
/* generador aleatorio con semilla (los niveles y las partidas a dobles salen iguales en los dos móviles) */
function RNG(seed){ let s = (seed>>>0) || 1; return ()=>{ s ^= s<<13; s>>>=0; s ^= s>>17; s ^= s<<5; s>>>=0; return s/4294967296; }; }

/* ═════════════ COLORES DE LAS BURBUJAS ═════════════ */
/* cada color lleva su símbolo para distinguirlos aunque no se vean bien los colores */
const COL = [
  {n:'Cian',     c:'#2bf0ff', d:'#006b8f', s:'ring'},
  {n:'Magenta',  c:'#ff2bd6', d:'#7a0068', s:'tri'},
  {n:'Ámbar',    c:'#ffc53b', d:'#8a5200', s:'sq'},
  {n:'Verde',    c:'#2dff8a', d:'#007a3a', s:'dia'},
  {n:'Rojo',     c:'#ff3355', d:'#7a0018', s:'star'},
  {n:'Violeta',  c:'#a46bff', d:'#3b1491', s:'hex'},
  {n:'Hielo',    c:'#eaf6ff', d:'#5c7894', s:'plus'},
  {n:'Naranja',  c:'#ff7a1a', d:'#7a2a00', s:'moon'}
];

/* ═════════════ SECTORES (10 sectores de 10 niveles) ═════════════ */
const SECT = [
  {n:'ÓRBITA TERRESTRE',        c:'#2bf0ff', h:200},
  {n:'CINTURÓN DE ASTEROIDES',  c:'#ffc53b', h:35},
  {n:'NEBULOSA CARMESÍ',        c:'#ff3355', h:350},
  {n:'LUNAS DE CRISTAL',        c:'#a46bff', h:265},
  {n:'TORMENTA SOLAR',          c:'#ff7a1a', h:20},
  {n:'BOSQUE DE QUÁSARES',      c:'#2dff8a', h:145},
  {n:'AGUJERO DE GUSANO',       c:'#ff2bd6', h:310},
  {n:'GALAXIA ESPEJO',          c:'#eaf6ff', h:220},
  {n:'HORIZONTE DE SUCESOS',    c:'#7b5cff', h:250},
  {n:'NÚCLEO ORBITAL',          c:'#ffd23f', h:50}
];
const sectOf = n => SECT[Math.floor((n-1)/10)] || SECT[0];

/* ═════════════ AUDIO (sintetizado, sin MP3: va en cualquier TV o móvil) ═════════════ */
const AU = { ctx:null, on: LS.get('snd', true), mus: LS.get('mus', true), master:null, musG:null };
function ac(){
  if (!AU.ctx){
    try{
      AU.ctx = new (window.AudioContext||window.webkitAudioContext)();
      AU.master = AU.ctx.createGain(); AU.master.gain.value = .55; AU.master.connect(AU.ctx.destination);
      AU.musG = AU.ctx.createGain(); AU.musG.gain.value = .0; AU.musG.connect(AU.master);
    }catch(e){ return null; }
  }
  if (AU.ctx.state === 'suspended') AU.ctx.resume();
  return AU.ctx;
}
function tone(f, d, type, v, slide, when, dest){
  const c = AU.ctx; if (!c || (!AU.on && !dest)) return;
  const t = (when||c.currentTime), o = c.createOscillator(), g = c.createGain();
  o.type = type||'sine'; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t+d);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v||.2, t+.008); g.gain.exponentialRampToValueAtTime(0.0001, t+d);
  o.connect(g); g.connect(dest||AU.master); o.start(t); o.stop(t+d+.05);
}
function noise(d, v, fr, when){
  const c = AU.ctx; if (!c || !AU.on) return;
  const t = when||c.currentTime, n = Math.floor(c.sampleRate*d), b = c.createBuffer(1, n, c.sampleRate), a = b.getChannelData(0);
  for (let i=0;i<n;i++) a[i] = (Math.random()*2-1)*(1-i/n);
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = b; f.type='lowpass'; f.frequency.value = fr||2000; g.gain.value = v||.2;
  s.connect(f); f.connect(g); g.connect(AU.master); s.start(t);
}
const PENTA = [0,2,4,7,9,12,14,16,19,21,24,26,28];
const SFX = {
  click(){ tone(900,.06,'square',.06,1400); },
  shoot(){ tone(320,.16,'sawtooth',.1,1300); tone(640,.12,'sine',.08,1900); noise(.08,.06,4000); },
  bounce(){ tone(1400,.05,'triangle',.07,900); },
  stick(){ tone(180,.09,'sine',.18,90); noise(.05,.08,900); },
  pop(i){ const f = 440*Math.pow(2, PENTA[Math.min(i, PENTA.length-1)]/12); tone(f,.14,'triangle',.13,f*1.5); tone(f*2,.08,'sine',.06); },
  drop(i){ const c=AU.ctx; if(!c) return; for(let k=0;k<Math.min(i,8);k++) tone(1200-k*90,.12,'sine',.07,600-k*40,c.currentTime+k*.04); },
  ceil(){ tone(70,.5,'sawtooth',.22,35); noise(.4,.22,500); },
  warn(){ tone(880,.08,'square',.06); tone(660,.08,'square',.06,null,AU.ctx&&AU.ctx.currentTime+.1); },
  power(){ const c=AU.ctx; if(!c) return; [523,659,784,1046,1318].forEach((f,i)=>tone(f,.18,'triangle',.1,null,c.currentTime+i*.05)); },
  boom(){ tone(120,.6,'sawtooth',.25,30); noise(.6,.35,1200); },
  laser(){ tone(1800,.5,'sawtooth',.12,200); tone(900,.5,'square',.06,100); },
  win(){ const c=AU.ctx; if(!c) return; [523,659,784,1046,784,1046,1318,1568].forEach((f,i)=>tone(f,.25,'triangle',.12,null,c.currentTime+i*.09)); },
  lose(){ const c=AU.ctx; if(!c) return; [392,330,262,196].forEach((f,i)=>tone(f,.35,'sawtooth',.1,f*.9,c.currentTime+i*.16)); },
  star(i){ tone(880*Math.pow(1.26,i),.3,'triangle',.14,null); tone(1760*Math.pow(1.26,i),.2,'sine',.06); },
  attack(){ tone(200,.3,'square',.1,600); noise(.2,.1,3000); },
  hurt(){ tone(300,.25,'sawtooth',.12,120); }
};
function setSound(v){ AU.on = v; LS.set('snd', v); }
/* música: secuenciador espacial muy ligero */
const MUS = (()=>{
  let t = 0, step = 0, timer = 0, playing = false;
  const BPM = 104, S = 60/BPM/4;
  const prog = [[57,60,64],[53,57,60],[48,52,55],[55,59,62]];   // Am F C G
  const mtf = m => 440*Math.pow(2,(m-69)/12);
  function tick(){
    const c = AU.ctx; if (!c || !playing) return;
    while (t < c.currentTime + .25){
      const ch = prog[Math.floor(step/16)%4], s = step%16;
      if (s%4===0) tone(mtf(ch[0]-24), S*3.5, 'sawtooth', .07, null, t, AU.musG);
      if (s%2===0) tone(mtf(ch[(s/2)%3]+12), S*1.6, 'triangle', .045, null, t, AU.musG);
      if (s===6 || s===14) tone(mtf(ch[2]+24), S*2.5, 'sine', .03, null, t, AU.musG);
      t += S; step++;
    }
  }
  return {
    start(){ const c = ac(); if (!c || playing) return; playing = true; t = c.currentTime + .1; AU.musG.gain.setTargetAtTime(.5, c.currentTime, .5); timer = setInterval(tick, 80); },
    stop(){ playing = false; clearInterval(timer); if (AU.musG) AU.musG.gain.value = 0; },
    sync(){ (AU.mus && AU.on) ? this.start() : this.stop(); }
  };
})();
function setMusic(v){ AU.mus = v; LS.set('mus', v); MUS.sync(); }

/* ═════════════ FONDO: estrellas, nebulosa y estrellas fugaces ═════════════ */
const BG = (()=>{
  const cv = $('#bg'), cx = cv.getContext('2d');
  let W=0, H=0, stars=[], shoot=null, hue=200, targetHue=200, dpr=1;
  function size(){
    dpr = Math.min(2, devicePixelRatio||1); W = innerWidth; H = innerHeight;
    cv.width = W*dpr; cv.height = H*dpr; cx.setTransform(dpr,0,0,dpr,0,0);
    stars = []; const n = Math.round(W*H/2600);
    for (let i=0;i<n;i++) stars.push({x:Math.random()*W, y:Math.random()*H, z:Math.random()*.9+.1, tw:Math.random()*6.28});
  }
  addEventListener('resize', size); size();
  let last = 0;
  function frame(ts){
    const dt = Math.min(.05, (ts-last)/1000||0); last = ts;
    hue += (targetHue-hue)*Math.min(1, dt*2);
    cx.fillStyle = '#04050d'; cx.fillRect(0,0,W,H);
    const g1 = cx.createRadialGradient(W*.2,H*.15,0,W*.2,H*.15,Math.max(W,H)*.7);
    g1.addColorStop(0,`hsla(${hue},90%,45%,.28)`); g1.addColorStop(1,'transparent');
    cx.fillStyle = g1; cx.fillRect(0,0,W,H);
    const g2 = cx.createRadialGradient(W*.85,H*.85,0,W*.85,H*.85,Math.max(W,H)*.6);
    g2.addColorStop(0,`hsla(${(hue+120)%360},90%,45%,.22)`); g2.addColorStop(1,'transparent');
    cx.fillStyle = g2; cx.fillRect(0,0,W,H);
    for (const s of stars){
      s.y += s.z*s.z*14*dt; if (s.y > H) { s.y = 0; s.x = Math.random()*W; }
      s.tw += dt*2*s.z;
      const a = .35 + .65*Math.abs(Math.sin(s.tw));
      cx.fillStyle = `rgba(220,240,255,${a*s.z})`;
      const r = s.z*1.6; cx.fillRect(s.x, s.y, r, r);
    }
    if (!shoot && Math.random() < dt*.25) shoot = {x:Math.random()*W, y:Math.random()*H*.5, vx:-500-Math.random()*400, vy:250+Math.random()*200, l:1};
    if (shoot){
      shoot.x += shoot.vx*dt; shoot.y += shoot.vy*dt; shoot.l -= dt*1.2;
      const g = cx.createLinearGradient(shoot.x, shoot.y, shoot.x-shoot.vx*.15, shoot.y-shoot.vy*.15);
      g.addColorStop(0, `rgba(255,255,255,${Math.max(0,shoot.l)})`); g.addColorStop(1,'transparent');
      cx.strokeStyle = g; cx.lineWidth = 2; cx.beginPath(); cx.moveTo(shoot.x, shoot.y); cx.lineTo(shoot.x-shoot.vx*.15, shoot.y-shoot.vy*.15); cx.stroke();
      if (shoot.l <= 0) shoot = null;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return { setHue(h){ targetHue = h; } };
})();

/* ═════════════ IMÁGENES PNG PROPIAS (opcionales) ═════════════
   Si subes estos PNG sin fondo a la carpeta img/ del repositorio, sustituyen al dibujo básico:
   img/b1.png … img/b8.png  → burbujas de cada color (orden de COL)
   img/metal.png  img/bomba.png  → burbujas especiales
   img/lanzador.png → cañón (apuntando hacia arriba)   img/robot.png → robot junto al cañón
   img/logo.png → logo del juego   img/fondo.jpg → fondo del tablero */
const IMG = {};
function loadImg(k, src){
  const i = new Image(); i.onload = ()=>{ IMG[k] = i; Spr.clear(); }; i.src = src + '?v=' + IMGV; return i;
}
function loadImages(){
  for (let i=0;i<8;i++) loadImg('b'+i, 'img/b'+(i+1)+'.png');
  ['metal','bomba','lanzador','robot','logo'].forEach(k=>loadImg(k, 'img/'+k+'.png'));
  loadImg('fondo','img/fondo.jpg');
}

/* ═════════════ SPRITES DE LAS BURBUJAS (pre-renderizados) ═════════════ */
const Spr = (()=>{
  let cache = {};
  function sym(g, s, r, col){
    g.save(); g.fillStyle = 'rgba(255,255,255,.85)'; g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = r*.13; g.shadowColor = col; g.shadowBlur = r*.3;
    const k = r*.36; g.beginPath();
    if (s==='ring'){ g.arc(0,0,k,0,7); g.stroke(); }
    else if (s==='tri'){ g.moveTo(0,-k); g.lineTo(k*.95,k*.7); g.lineTo(-k*.95,k*.7); g.closePath(); g.fill(); }
    else if (s==='sq'){ g.rect(-k*.75,-k*.75,k*1.5,k*1.5); g.fill(); }
    else if (s==='dia'){ g.moveTo(0,-k); g.lineTo(k*.8,0); g.lineTo(0,k); g.lineTo(-k*.8,0); g.closePath(); g.fill(); }
    else if (s==='star'){ for(let i=0;i<10;i++){ const a=-Math.PI/2+i*Math.PI/5, rr=i%2?k*.45:k*1.05; g.lineTo(Math.cos(a)*rr, Math.sin(a)*rr);} g.closePath(); g.fill(); }
    else if (s==='hex'){ for(let i=0;i<6;i++){ const a=i*Math.PI/3; g.lineTo(Math.cos(a)*k, Math.sin(a)*k);} g.closePath(); g.stroke(); }
    else if (s==='plus'){ g.rect(-k*.25,-k,k*.5,k*2); g.rect(-k,-k*.25,k*2,k*.5); g.fill(); }
    else if (s==='moon'){ g.arc(0,0,k,0,7); g.fill(); g.globalCompositeOperation='destination-out'; g.beginPath(); g.arc(k*.45,-k*.25,k*.8,0,7); g.fill(); }
    g.restore();
  }
  function make(key, px){
    const pad = Math.ceil(px*.35), S = px+pad*2, c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d'), r = px/2; g.translate(S/2, S/2);
    if (key==='metal'){
      if (IMG.metal){ g.drawImage(IMG.metal, -r, -r, px, px); return c; }
      const gr = g.createRadialGradient(-r*.35,-r*.4,r*.1,0,0,r);
      gr.addColorStop(0,'#f4f8ff'); gr.addColorStop(.35,'#9aa6b8'); gr.addColorStop(1,'#2b3240');
      g.fillStyle = gr; g.beginPath(); g.arc(0,0,r*.96,0,7); g.fill();
      g.strokeStyle='#1a1f29'; g.lineWidth=r*.08; g.beginPath(); g.arc(0,0,r*.62,0,7); g.stroke();
      g.fillStyle='#d8e0ec'; for(let i=0;i<4;i++){ const a=i*Math.PI/2+Math.PI/4; g.beginPath(); g.arc(Math.cos(a)*r*.78, Math.sin(a)*r*.78, r*.09, 0, 7); g.fill(); }
      g.strokeStyle='rgba(43,240,255,.6)'; g.lineWidth=r*.06; g.beginPath(); g.arc(0,0,r*.96,0,7); g.stroke();
      return c;
    }
    if (key==='bomba'){
      if (IMG.bomba){ g.drawImage(IMG.bomba, -r, -r, px, px); return c; }
      g.shadowColor='#ff3355'; g.shadowBlur=r*.6;
      const gr = g.createRadialGradient(-r*.3,-r*.35,r*.05,0,0,r);
      gr.addColorStop(0,'#5a5f70'); gr.addColorStop(.5,'#1d2030'); gr.addColorStop(1,'#07080f');
      g.fillStyle = gr; g.beginPath(); g.arc(0,0,r*.94,0,7); g.fill(); g.shadowBlur=0;
      g.strokeStyle='#ff3355'; g.lineWidth=r*.1;
      for(let i=0;i<8;i++){ const a=i*Math.PI/4; g.beginPath(); g.moveTo(Math.cos(a)*r*.55,Math.sin(a)*r*.55); g.lineTo(Math.cos(a)*r*.85,Math.sin(a)*r*.85); g.stroke(); }
      const core = g.createRadialGradient(0,0,0,0,0,r*.42); core.addColorStop(0,'#fff'); core.addColorStop(.4,'#ff6b85'); core.addColorStop(1,'rgba(255,51,85,0)');
      g.fillStyle = core; g.beginPath(); g.arc(0,0,r*.45,0,7); g.fill();
      return c;
    }
    if (key==='rainbow'){
      const gr = g.createConicGradient ? g.createConicGradient(0,0,0) : null;
      if (gr){ ['#ff3355','#ffc53b','#2dff8a','#2bf0ff','#a46bff','#ff2bd6','#ff3355'].forEach((cc,i,a)=>gr.addColorStop(i/(a.length-1), cc)); g.fillStyle = gr; }
      else g.fillStyle = '#fff';
      g.shadowColor='#fff'; g.shadowBlur=r*.6; g.beginPath(); g.arc(0,0,r*.94,0,7); g.fill(); g.shadowBlur=0;
      const hl = g.createRadialGradient(-r*.35,-r*.4,0,-r*.2,-r*.25,r*.9); hl.addColorStop(0,'rgba(255,255,255,.9)'); hl.addColorStop(.4,'rgba(255,255,255,.15)'); hl.addColorStop(1,'rgba(255,255,255,0)');
      g.fillStyle = hl; g.beginPath(); g.arc(0,0,r*.94,0,7); g.fill();
      return c;
    }
    const i = Number(key), C = COL[i];
    if (IMG['b'+i]){ g.drawImage(IMG['b'+i], -r, -r, px, px); return c; }
    /* halo */
    g.shadowColor = C.c; g.shadowBlur = r*.55;
    const gr = g.createRadialGradient(-r*.3,-r*.35,r*.05,0,0,r);
    gr.addColorStop(0,'#ffffff'); gr.addColorStop(.18, C.c); gr.addColorStop(.75, C.d); gr.addColorStop(1, '#02030a');
    g.fillStyle = gr; g.beginPath(); g.arc(0,0,r*.95,0,7); g.fill(); g.shadowBlur = 0;
    /* núcleo de energía */
    const core = g.createRadialGradient(0,0,0,0,0,r*.6); core.addColorStop(0, 'rgba(255,255,255,.35)'); core.addColorStop(1,'rgba(255,255,255,0)');
    g.fillStyle = core; g.beginPath(); g.arc(0,0,r*.6,0,7); g.fill();
    sym(g, C.s, r, C.c);
    /* borde y brillo de cristal */
    g.strokeStyle = C.c; g.lineWidth = r*.07; g.globalAlpha = .9; g.beginPath(); g.arc(0,0,r*.92,0,7); g.stroke(); g.globalAlpha = 1;
    g.fillStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.ellipse(-r*.38,-r*.45,r*.26,r*.14,-.6,0,7); g.fill();
    g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.arc(r*.42,r*.4,r*.08,0,7); g.fill();
    return c;
  }
  return {
    get(key, px){ px = Math.max(8, Math.round(px)); const k = key+'_'+px; return cache[k] || (cache[k] = make(String(key), px)); },
    clear(){ cache = {}; }
  };
})();

/* ═════════════ NIVELES (100, generados siempre igual a partir del número) ═════════════ */
const PATTERNS = ['full','tri','diamond','stripesH','vee','checker','rings','invader','zig','columns','heart','cross','pyramid','holes','waves'];
function levelDef(n){
  const r = RNG(n*7919 + 13);
  const colors = n<=4?3 : n<=14?4 : n<=34?5 : n<=64?6 : n<=88?7 : 8;
  const rows = Math.min(10, 4 + Math.floor(n/11) + (n%10===0?1:0));
  const dropEvery = Math.max(5, 11 - Math.floor(n/14));
  const pat = n<=3 ? 'full' : PATTERNS[(n*7 + Math.floor(n/10)) % PATTERNS.length];
  const pal = []; const pool = [0,1,2,3,4,5,6,7].slice(0, Math.max(colors, 8));
  while (pal.length < colors){ const k = pool.splice(Math.floor(r()*pool.length),1)[0]; pal.push(k); }
  const cell = [];
  for (let y=0;y<rows;y++){
    const w = y%2 ? 7 : 8; cell.push([]);
    for (let x=0;x<w;x++){
      const cx = (x + (y%2?.5:0)) - 3.5, cy = y;
      let on = true;
      switch (pat){
        case 'tri': on = Math.abs(cx) <= (rows-y)*0.55+.3; break;
        case 'pyramid': on = Math.abs(cx) <= y*0.5+.6; break;
        case 'diamond': on = Math.abs(cx) + Math.abs(cy-(rows-1)/2)*0.7 <= 3.6 || (y===0 && Math.abs(cx)<2); break;
        case 'stripesH': on = y%3 !== 2; break;
        case 'vee': on = Math.abs(Math.abs(cx) - y*0.5) < 1.3 || y===0; break;
        case 'checker': on = ((x + Math.floor(y/2))%2===0) || y===0; break;
        case 'rings': { const d = Math.hypot(cx, (cy-(rows-1)/2)*1.15); on = d<1.2 || (d>2.1 && d<3.4) || y===0; break; }
        case 'invader': on = !((y===1 && Math.abs(cx)<1) || (y===3 && (Math.abs(cx)>2.5)) || (y>=rows-1 && Math.abs(cx)<1.6)); break;
        case 'zig': on = ((x + y) % 4) !== 3; break;
        case 'columns': on = Math.round(cx+3.5)%3 !== 1 || y<2; break;
        case 'heart': { const hx = cx/3.6, hy = 1.1 - y/(rows-1)*2.2; on = Math.pow(hx*hx+hy*hy-1,3) - hx*hx*hy*hy*hy <= 0.05 || y===0; break; }
        case 'cross': on = Math.abs(cx) < 1.3 || Math.abs(cy-(rows-1)/2) < 1.1 || y===0; break;
        case 'holes': on = r() > .18 || y===0; break;
        case 'waves': on = Math.sin(cx*1.2 + y*0.9) > -0.55 || y===0; break;
      }
      cell[y].push(on ? 1 : 0);
    }
  }
  /* quitar islas que no cuelgan del techo */
  { const seen = new Set(), st = []; cell[0].forEach((v,x)=>{ if (v){ seen.add('0,'+x); st.push([0,x]); } });
    while (st.length){ const [y,x] = st.pop(), o = y%2;
      for (const [a,b] of [[y,x-1],[y,x+1],[y-1,x-1+o],[y-1,x+o],[y+1,x-1+o],[y+1,x+o]]) if (cell[a] && cell[a][b] && !seen.has(a+','+b)){ seen.add(a+','+b); st.push([a,b]); } }
    cell.forEach((rw,y)=>rw.forEach((v,x)=>{ if (v && !seen.has(y+','+x)) rw[x] = 0; })); }
  /* reparto de colores en grupos (más fácil de leer y de encadenar) */
  const grid = cell.map(rw=>rw.map(()=>null));
  const nb = (y,x) => { const o = y%2; return [[y,x-1],[y,x+1],[y-1,x-1+o],[y-1,x+o]]; };
  const stripes = pat==='stripesH' || pat==='waves';
  for (let y=0;y<cell.length;y++) for (let x=0;x<cell[y].length;x++){
    if (!cell[y][x]) continue;
    let c;
    if (stripes) c = pal[Math.floor(y/ (pat==='waves'?2:1)) % pal.length];
    else if (pat==='columns' || pat==='rings') c = pal[Math.floor(Math.abs(x + (y%2?.5:0) - 3.5)) % pal.length];
    else {
      const prev = nb(y,x).filter(([a,b])=>a>=0 && grid[a] && grid[a][b]);
      if (prev.length && r() < .58 - n*0.002){ const p = prev[Math.floor(r()*prev.length)]; c = grid[p[0]][p[1]].c; }
      else c = pal[Math.floor(r()*pal.length)];
    }
    grid[y][x] = {c, t:'n'};
  }
  /* especiales */
  const filled = []; grid.forEach((rw,y)=>rw.forEach((v,x)=>{ if (v && y>0) filled.push([y,x]); }));
  const metal = n>=18 ? Math.min(8, Math.floor((n-12)/10)) : 0;
  const bombs = n>=8 ? Math.min(4, 1 + Math.floor((n-8)/22)) : 0;
  for (let k=0;k<metal && filled.length;k++){ const p = filled.splice(Math.floor(r()*filled.length),1)[0]; grid[p[0]][p[1]] = {c:-1, t:'m'}; }
  for (let k=0;k<bombs && filled.length;k++){ const p = filled.splice(Math.floor(r()*filled.length),1)[0]; grid[p[0]][p[1]] = {c:-1, t:'b'}; }
  let count = 0; grid.forEach(rw=>rw.forEach(v=>{ if (v) count++; }));
  const par = Math.ceil(count*0.42) + 3;
  return { n, grid, colors: pal, dropEvery, par, pat, seed: n*31337 };
}
function versusDef(seed){
  const r = RNG(seed), pal = [0,1,2,3,4,5].sort(()=>r()-.5).slice(0,5), grid = [];
  for (let y=0;y<5;y++){ grid.push([]); for (let x=0;x<(y%2?7:8);x++){
    const up = y>0 && r()<.5 ? grid[y-1][Math.min(x, grid[y-1].length-1)] : null;
    grid[y].push({c: up ? up.c : pal[Math.floor(r()*pal.length)], t:'n'}); } }
  return { n:0, grid, colors: pal, dropEvery: 9, par: 99, seed };
}
