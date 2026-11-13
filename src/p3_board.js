
/* ════════════════════════════════════════════════════════════
   MOTOR DEL TABLERO (unidades lógicas: 320 x 530)
   ════════════════════════════════════════════════════════════ */
const R = 20, D = 40, RH = D*Math.sqrt(3)/2, BW = 320, BH = 530, DEATH = 11;
const SX = 160, SY = 472, SPEED = 1080, CH_MAX = 36;
const ANG_MIN = -Math.PI + .13, ANG_MAX = -.13;
const LINE_Y = R + (DEATH-1)*RH + R + 1;
const POWERS = {
  bomb:    {i:'💣', n:'BOMBA',    d:'Explota todo lo que hay alrededor al chocar'},
  rainbow: {i:'🌈', n:'ARCOÍRIS', d:'Se convierte en el color de la burbuja que toca'},
  laser:   {i:'⚡', n:'RAYO',     d:'Atraviesa y destruye todo hasta el techo'}
};

class Board {
  constructor(def, o){
    o = o || {};
    this.def = def; this.local = o.local !== false; this.vs = !!o.vs; this.name = o.name || ''; this.color = o.color || '#2bf0ff';
    this.rng = RNG(def.seed || 1);
    this.grid = def.grid.map(rw=>rw.map(v=>v ? {c:v.c, t:v.t} : null));
    this.ceil = 0; this.shots = 0; this.sinceDrop = 0; this.ang = -Math.PI/2; this.ball = null; this.trail = [];
    this.pops = []; this.fall = []; this.parts = []; this.texts = []; this.rings = []; this.spawns = [];
    this.shake = 0; this.flash = 0; this.score = 0; this.combo = 0; this.maxCombo = 0; this.charge = 0;
    this.powers = {bomb:0, rainbow:0, laser:0}; this.armed = null;
    this.state = 'play'; this.t = 0; this.idle = 0; this.garbage = 0; this.endT = 0; this.danger = 0;
    this.hurry = this.vs ? 7 : (def.n >= 30 ? 12 : 16);
    this.guideBounces = this.vs ? 1 : (def.n <= 12 ? 3 : def.n <= 40 ? 2 : 1);
    this.cur = this.pick(); this.next = this.pick();
    this.onEnd = null; this.onAttack = null; this.onChange = null; this.onPower = null;
  }
  /* ── rejilla ── */
  w(y){ return y%2 ? 7 : 8; }
  get(y,x){ return (this.grid[y] && this.grid[y][x]) || null; }
  set(y,x,v){ while (this.grid.length <= y) this.grid.push(new Array(this.w(this.grid.length)).fill(null)); this.grid[y][x] = v; }
  ok(y,x){ return y>=0 && x>=0 && x<this.w(y); }
  pos(y,x){ return {x: R + x*D + (y%2 ? R : 0), y: R + (y+this.ceil)*RH}; }
  nb(y,x){ const o = y%2; return [[y,x-1],[y,x+1],[y-1,x-1+o],[y-1,x+o],[y+1,x-1+o],[y+1,x+o]].filter(([a,b])=>this.ok(a,b)); }
  each(fn){ for (let y=0;y<this.grid.length;y++) for (let x=0;x<this.grid[y].length;x++) if (this.grid[y][x]) fn(this.grid[y][x], y, x); }
  count(){ let n=0; this.each(()=>n++); return n; }
  present(){ const s = new Set(); this.each(v=>{ if (v.t==='n') s.add(v.c); }); return [...s]; }
  pick(){ const p = this.present(), src = p.length ? p : this.def.colors; return {c: src[Math.floor(this.rng()*src.length)], t:'n'}; }
  lowest(){ let m = -1; this.each((v,y)=>{ if (y+this.ceil > m) m = y+this.ceil; }); return m; }

  /* ── controles ── */
  aimAt(px, py){
    let a = Math.atan2(py - SY, px - SX);
    if (py > SY - 4) a = px < SX ? ANG_MIN : ANG_MAX;
    this.ang = clamp(a, ANG_MIN, ANG_MAX);
  }
  aimBy(d){ this.ang = clamp(this.ang + d, ANG_MIN, ANG_MAX); }
  ready(){ return this.state==='play' && !this.ball; }
  fire(){
    if (!this.ready()) return false;
    const b = {c: this.cur.c, t: this.armed || 'n'};
    if (this.armed){ this.powers[this.armed]--; this.armed = null; this.onPower && this.onPower(); }
    this.ball = {x: SX, y: SY, vx: Math.cos(this.ang)*SPEED, vy: Math.sin(this.ang)*SPEED, b, hits: 0};
    this.trail = [];
    this.cur = this.next; this.next = this.pick(); this.idle = 0;
    if (!this.present().includes(this.cur.c) && this.present().length) this.cur = this.pick();
    SFX.shoot(); this.recoil = 1;
    if (b.t==='laser') SFX.laser();
    this.changed();
    return true;
  }
  swap(){ if (!this.ready()) return; const t = this.cur; this.cur = this.next; this.next = t; SFX.click(); this.swapT = 1; this.changed(); }
  arm(k){ if (!this.ready() || !this.powers[k]) return; this.armed = this.armed===k ? null : k; SFX.click(); this.onPower && this.onPower(); }
  changed(){ this.onChange && this.onChange(); }

  /* ── bucle ── */
  update(dt){
    this.t += dt;
    this.shake = Math.max(0, this.shake - dt*3); this.flash = Math.max(0, this.flash - dt*2.5);
    if (this.recoil) this.recoil = Math.max(0, this.recoil - dt*5);
    if (this.swapT) this.swapT = Math.max(0, this.swapT - dt*4);
    if (this.local && this.state==='play'){
      if (this.ball) this.moveBall(dt);
      else {
        this.idle += dt;
        if (this.idle > this.hurry){ this.fire(); }
        else if (this.idle > this.hurry - 4 && Math.floor(this.idle*2) !== Math.floor((this.idle-dt)*2)) SFX.warn();
      }
    }
    const low = this.lowest(); this.danger = clamp((low - (DEATH-3))/3, 0, 1);
    this.fx(dt);
    if ((this.state==='won' || this.state==='lost') && this.endT > 0){ this.endT -= dt; if (this.endT <= 0 && this.onEnd) this.onEnd(this.state); }
  }
  fx(dt){
    for (const p of this.pops){ p.d -= dt; if (p.d <= 0 && !p.done){ p.done = true; this.burst(p.x, p.y, p.col, 14, 260); this.rings.push({x:p.x, y:p.y, r:R*.6, life:.35, max:.35, c:p.col, w:3}); SFX.pop(p.i); } }
    this.pops = this.pops.filter(p=>!p.done || p.d > -.01);
    for (const f of this.fall){
      f.vy += 1500*dt; f.x += f.vx*dt; f.y += f.vy*dt; f.rot += f.vr*dt;
      if (f.x < R || f.x > BW-R){ f.vx *= -.6; f.x = clamp(f.x, R, BW-R); }
      if (f.y > BH - 20 && !f.boom){ f.boom = true; this.burst(f.x, BH-24, f.col, 10, 220, -1); this.texts.push({x:f.x, y:BH-40, s:'+'+f.pts, c:'#ffd23f', life:.9, max:.9, size:15}); }
    }
    this.fall = this.fall.filter(f=>!f.boom);
    for (const p of this.parts){ p.vy += (p.g||0)*dt; p.x += p.vx*dt; p.y += p.vy*dt; p.vx *= (1-dt*2); p.vy *= (1-dt*1.2); p.life -= dt; }
    this.parts = this.parts.filter(p=>p.life > 0);
    for (const r of this.rings){ r.life -= dt; r.r += dt*(r.sp||170); }
    this.rings = this.rings.filter(r=>r.life > 0);
    for (const t of this.texts){ t.life -= dt; t.y -= dt*40; }
    this.texts = this.texts.filter(t=>t.life > 0);
    for (const s of this.spawns) s.t = Math.min(1, s.t + dt*4);
    this.spawns = this.spawns.filter(s=>s.t < 1);
  }
  burst(x, y, col, n, sp, up){
    for (let i=0;i<n;i++){ const a = Math.random()*Math.PI*2, v = sp*(.3+Math.random()*.9);
      this.parts.push({x, y, vx:Math.cos(a)*v, vy:Math.sin(a)*v + (up?-sp*.5:0), g:500, life:.4+Math.random()*.5, max:.9, c: Math.random()<.3 ? '#fff' : col, s: 1.5+Math.random()*3}); }
  }
  colOf(v){ return v.t==='m' ? '#9aa6b8' : v.t==='b' ? '#ff3355' : COL[v.c].c; }

  moveBall(dt){
    const b = this.ball, steps = Math.max(1, Math.ceil(SPEED*dt/5)), h = dt/steps;
    for (let s=0;s<steps;s++){
      b.x += b.vx*h; b.y += b.vy*h;
      if (b.x < R){ b.x = 2*R - b.x; b.vx = -b.vx; SFX.bounce(); this.burst(R-6, b.y, '#2bf0ff', 4, 120); }
      else if (b.x > BW-R){ b.x = 2*(BW-R) - b.x; b.vx = -b.vx; SFX.bounce(); this.burst(BW-R+6, b.y, '#2bf0ff', 4, 120); }
      if (s%2===0){ this.trail.push({x:b.x, y:b.y}); if (this.trail.length > 14) this.trail.shift(); }
      const top = this.ceil*RH;
      if (b.b.t==='laser'){
        let hit = 0;
        this.each((v,y,x)=>{ const p = this.pos(y,x); if (Math.hypot(p.x-b.x, p.y-b.y) < D*.9){ this.grid[y][x] = null; this.pops.push({x:p.x, y:p.y, col:this.colOf(v), d:0, i:Math.min(12,b.hits)}); b.hits++; hit++; } });
        if (hit){ this.shake = Math.max(this.shake, .25); }
        if (b.y < top - R){ this.ball = null; this.afterShot(b.hits, null); return; }
        continue;
      }
      if (b.y - R <= top + .5){ this.stick(b, null); return; }
      let hit = null, hd = D*.84;
      this.each((v,y,x)=>{ const p = this.pos(y,x), d = Math.hypot(p.x-b.x, p.y-b.y); if (d < hd){ hd = d; hit = {y,x,v}; } });
      if (hit){ this.stick(b, hit); return; }
    }
  }
  cellAt(px, py){
    let y = Math.max(0, Math.round((py - R)/RH - this.ceil));
    let x = Math.round((px - R - (y%2 ? R : 0))/D);
    x = clamp(x, 0, this.w(y)-1);
    return [y, x];
  }
  stick(b, hit){
    const cands = [];
    const add = (y,x)=>{ if (this.ok(y,x) && !this.get(y,x) && !cands.some(c=>c[0]===y&&c[1]===x)) cands.push([y,x]); };
    if (hit) this.nb(hit.y, hit.x).forEach(([y,x])=>add(y,x));
    const pc = this.cellAt(b.x, b.y); add(pc[0], pc[1]);
    if (!hit) for (let x=0;x<8;x++) add(0, x);
    let best = null, bd = 1e9;
    for (const [y,x] of cands){ const p = this.pos(y,x), d = Math.hypot(p.x-b.x, p.y-b.y); if (d < bd){ bd = d; best = [y,x]; } }
    this.ball = null;
    if (!best){ this.afterShot(0, null); return; }
    const [y, x] = best, p = this.pos(y,x);
    let c = b.b.c;
    if (b.b.t==='rainbow'){
      const ns = this.nb(y,x).map(([a,bb])=>this.get(a,bb)).filter(v=>v && v.t==='n');
      if (hit && hit.v.t==='n') c = hit.v.c; else if (ns.length) c = ns[0].c;
      this.burst(p.x, p.y, '#fff', 20, 260);
    }
    this.set(y, x, {c, t:'n'});
    SFX.stick(); this.shake = Math.max(this.shake, .12);
    this.burst(p.x, p.y - R*.5, '#ffffff', 5, 90);
    this.resolve(y, x, b.b.t);
  }
  explode(cx, cy, rad, out){
    this.each((v,y,x)=>{ const p = this.pos(y,x); if (Math.hypot(p.x-cx, p.y-cy) <= rad && !out.some(o=>o[0]===y&&o[1]===x)) out.push([y,x,v]); });
  }
  resolve(y, x, kind){
    let popped = [];
    const p0 = this.pos(y,x);
    if (kind==='bomb'){
      this.explode(p0.x, p0.y, D*2.15, popped);
      SFX.boom(); this.shake = .8; this.flash = .6;
      this.rings.push({x:p0.x, y:p0.y, r:10, life:.5, max:.5, c:'#ffc53b', w:8, sp:380});
      this.burst(p0.x, p0.y, '#ffc53b', 40, 420);
    } else {
      const col = this.get(y,x).c, seen = new Set([y+','+x]), st = [[y,x]], grp = [];
      while (st.length){ const [a,b] = st.pop(), v = this.get(a,b); grp.push([a,b,v]);
        for (const [c2,d2] of this.nb(a,b)){ const k = c2+','+d2, w = this.get(c2,d2); if (!seen.has(k) && w && w.t==='n' && w.c===col){ seen.add(k); st.push([c2,d2]); } } }
      if (grp.length >= 3) popped = grp;
    }
    /* bombas de la rejilla que tocan algo que explota: reacción en cadena */
    for (let i=0;i<popped.length;i++){
      const [a,b] = popped[i];
      for (const [c2,d2] of this.nb(a,b)){ const w = this.get(c2,d2);
        if (w && w.t==='b' && !popped.some(o=>o[0]===c2&&o[1]===d2)){
          popped.push([c2,d2,w]); const q = this.pos(c2,d2); this.explode(q.x, q.y, D*1.25, popped);
          SFX.boom(); this.shake = .7; this.flash = .4; this.rings.push({x:q.x, y:q.y, r:10, life:.45, max:.45, c:'#ff3355', w:7, sp:300}); this.burst(q.x, q.y, '#ff3355', 30, 380);
        } }
    }
    popped.forEach(([a,b,v], i)=>{ this.grid[a][b] = null; const q = this.pos(a,b); this.pops.push({x:q.x, y:q.y, col:this.colOf(v), key: v.t==='m'?'metal':v.t==='b'?'bomba':v.c, d:i*.035, i}); });
    this.afterShot(popped.length, p0);
  }
  floating(){
    const seen = new Set(), st = [];
    if (this.grid[0]) this.grid[0].forEach((v,x)=>{ if (v){ seen.add('0,'+x); st.push([0,x]); } });
    while (st.length){ const [a,b] = st.pop(); for (const [c,d] of this.nb(a,b)){ const k = c+','+d; if (!seen.has(k) && this.get(c,d)){ seen.add(k); st.push([c,d]); } } }
    const out = []; this.each((v,y,x)=>{ if (!seen.has(y+','+x)) out.push([y,x,v]); }); return out;
  }
  afterShot(np, at){
    const fl = this.floating();
    let pts = 0;
    if (np){ this.combo++; this.maxCombo = Math.max(this.maxCombo, this.combo); pts += np*10*(1 + (this.combo-1)*.5); }
    else this.combo = 0;
    if (fl.length){
      const each = Math.min(1280, 10*Math.pow(2, Math.min(fl.length, 7)));
      fl.forEach(([y,x,v])=>{ this.grid[y][x] = null; const q = this.pos(y,x);
        this.fall.push({x:q.x, y:q.y, vx:rnd(-90,90), vy:rnd(-260,-60), rot:0, vr:rnd(-6,6), key: v.t==='m'?'metal':v.t==='b'?'bomba':v.c, col:this.colOf(v), pts:each}); });
      pts += each*fl.length; SFX.drop(fl.length);
    }
    pts = Math.round(pts); this.score += pts;
    if (at && (np || fl.length)){
      const tag = this.combo >= 2 ? '  COMBO x'+this.combo : '';
      this.texts.push({x:at.x, y:at.y, s:'+'+pts+tag, c: this.combo>=2 ? '#ff2bd6' : '#fff', life:1.1, max:1.1, size: this.combo>=2 ? 20 : 17});
    }
    if (np + fl.length >= 8){ this.texts.push({x:BW/2, y:BH*.42, s: np+fl.length >= 14 ? '¡SUPERNOVA!' : '¡BRUTAL!', c:'#ffd23f', life:1.4, max:1.4, size:34, big:true}); this.flash = Math.max(this.flash,.35); }
    /* carga de poderes */
    this.charge += np + fl.length*2;
    while (this.charge >= CH_MAX){ this.charge -= CH_MAX; const ks = Object.keys(POWERS), k = ks[Math.floor(Math.random()*ks.length)]; this.powers[k]++;
      SFX.power(); this.texts.push({x:BW/2, y:BH*.55, s: POWERS[k].i+' '+POWERS[k].n+' LISTO', c:'#ffc53b', life:1.5, max:1.5, size:22, big:true}); this.onPower && this.onPower(); }
    /* ataque a dobles */
    if (this.vs){ const atk = fl.length + Math.max(0, np-3); if (atk > 0 && this.onAttack) this.onAttack(Math.min(12, atk)); }
    this.shots++; this.sinceDrop++;
    if (this.garbage > 0){ this.addGarbage(this.garbage); this.garbage = 0; }
    if (this.count() === 0){
      if (this.vs){ this.refill(); }
      else { this.state = 'won'; this.endT = 1.1; SFX.win(); this.flash = 1; this.changed(); return; }
    }
    if (this.sinceDrop >= this.def.dropEvery){ this.sinceDrop = 0; this.ceil++; SFX.ceil(); this.shake = .6; this.texts.push({x:BW/2, y:this.ceil*RH+30, s:'▼ EL TECHO BAJA ▼', c:'#ff3355', life:1, max:1, size:16}); }
    if (this.lowest() >= DEATH) this.lose();
    this.changed();
  }
  lose(){
    if (this.state !== 'play') return;
    this.state = 'lost'; this.endT = 1.6; SFX.lose(); this.shake = 1; this.ball = null;
    /* todo se vuelve gris y cae */
    this.each((v,y,x)=>{ const q = this.pos(y,x); this.fall.push({x:q.x, y:q.y, vx:rnd(-120,120), vy:rnd(-300,0), rot:0, vr:rnd(-8,8), key:'metal', col:'#666', pts:0, dead:true}); });
    this.grid = [];
    this.changed();
  }
  refill(){
    const r = this.rng, pal = this.def.colors;
    for (let y=0;y<4;y++) for (let x=0;x<this.w(y);x++){ this.set(y,x,{c:pal[Math.floor(r()*pal.length)], t:'n'}); this.spawns.push({y,x,t:0}); }
    this.texts.push({x:BW/2, y:BH*.4, s:'¡TABLERO LIMPIO!', c:'#2dff8a', life:1.4, max:1.4, size:28, big:true});
  }
  addGarbage(n){
    const pal = this.present().length ? this.present() : this.def.colors;
    for (let k=0;k<n;k++){
      const cand = [];
      const H = Math.max(this.grid.length, 1);
      for (let y=0;y<=H && y+this.ceil<=DEATH;y++) for (let x=0;x<this.w(y);x++){
        if (this.get(y,x)) continue;
        if (y===0 || this.nb(y,x).some(([a,b])=>this.get(a,b))) cand.push([y,x]);
      }
      if (!cand.length) break;
      cand.sort((a,b)=>b[0]-a[0]);
      const top = cand.slice(0, Math.max(1, Math.ceil(cand.length/3))), [y,x] = top[Math.floor(Math.random()*top.length)];
      this.set(y, x, {c: pal[Math.floor(Math.random()*pal.length)], t:'n'}); this.spawns.push({y,x,t:0});
    }
    SFX.hurt(); this.shake = .5;
    this.texts.push({x:BW/2, y:BH*.5, s:'¡ATAQUE! +'+n, c:'#ff3355', life:1.1, max:1.1, size:22, big:true});
  }
  stars(){ const s = this.shots; return s <= this.def.par ? 3 : s <= Math.round(this.def.par*1.5) ? 2 : 1; }

  /* ── estado compacto para el otro móvil ── */
  toStr(){ return this.grid.map(rw=>rw.map(v=>!v?'.':v.t==='m'?'m':v.t==='b'?'b':String(v.c)).join('')).join('|'); }
  snap(){ const b = this.ball; return {g:this.toStr(), cl:this.ceil, a:+this.ang.toFixed(3), cu:this.cur.c, nx:this.next.c, b: b ? [Math.round(b.x), Math.round(b.y), b.b.c, b.b.t] : 0, sc:this.score, sd:this.sinceDrop, st:this.state}; }
  apply(m){
    const old = this.grid;
    this.grid = String(m.g||'').split('|').filter((s,i)=>s.length || i===0).map(s=>s.split('').map(ch=>ch==='.'?null:ch==='m'?{c:-1,t:'m'}:ch==='b'?{c:-1,t:'b'}:{c:Number(ch), t:'n'}));
    if (this.ceil !== m.cl && m.cl > this.ceil) this.shake = .5;
    this.ceil = m.cl; this.ang = m.a; this.cur = {c:m.cu, t:'n'}; this.next = {c:m.nx, t:'n'}; this.score = m.sc; this.sinceDrop = m.sd;
    for (let y=0;y<old.length;y++) for (let x=0;x<old[y].length;x++){
      const v = old[y][x]; if (v && !this.get(y,x)){ const q = this.pos(y,x); this.burst(q.x, q.y, this.colOf(v), 8, 200); }
    }
    if (m.b){ if (!this.ball) this.trail = []; this.ball = {x:m.b[0], y:m.b[1], b:{c:m.b[2], t:m.b[3]}}; this.trail.push({x:m.b[0], y:m.b[1]}); if (this.trail.length > 10) this.trail.shift(); }
    else this.ball = null;
  }

  /* ════════ DIBUJO ════════ */
  draw(g, k){   /* g ya está trasladado y escalado a unidades lógicas; k = píxeles reales por unidad */
    const sh = this.shake, ox = sh ? (Math.random()-.5)*sh*12 : 0, oy = sh ? (Math.random()-.5)*sh*12 : 0;
    g.save(); g.translate(ox, oy);
    this.drawFrame(g);
    g.save(); g.beginPath(); g.rect(0, 0, BW, BH); g.clip();
    this.drawCeil(g);
    this.drawLine(g);
    if (this.local && this.ready()) this.drawGuide(g);
    this.drawGrid(g, k);
    this.drawShooter(g, k);
    this.drawBall(g, k);
    this.drawFx(g, k);
    g.restore();
    if (this.flash){ g.fillStyle = `rgba(255,255,255,${this.flash*.35})`; g.fillRect(0,0,BW,BH); }
    g.restore();
  }
  spr(g, k, key, x, y, scale, rot, alpha){
    const s = Spr.get(key, D*k*(scale||1)), w = s.width/k;
    if (alpha != null) g.globalAlpha = alpha;
    if (rot){ g.save(); g.translate(x,y); g.rotate(rot); g.drawImage(s, -w/2, -w/2, w, w); g.restore(); }
    else g.drawImage(s, x - w/2, y - w/2, w, w);
    if (alpha != null) g.globalAlpha = 1;
  }
  drawFrame(g){
    g.save();
    g.fillStyle = 'rgba(4,7,20,.82)'; rr(g, -6, -6, BW+12, BH+12, 18); g.fill();
    if (IMG.fondo){ g.save(); rr(g, 0, 0, BW, BH, 12); g.clip(); g.globalAlpha = .55; g.drawImage(IMG.fondo, 0, 0, BW, BH); g.restore(); }
    /* rejilla hexagonal tenue */
    g.save(); rr(g, 0, 0, BW, BH, 12); g.clip();
    g.strokeStyle = 'rgba(120,200,255,.05)'; g.lineWidth = 1;
    for (let y=0;y<DEATH+1;y++) for (let x=0;x<this.w(y);x++){ const p = this.pos(y,x); g.beginPath(); for (let i=0;i<6;i++){ const a = Math.PI/6 + i*Math.PI/3; g.lineTo(p.x+Math.cos(a)*R*1.12, p.y+Math.sin(a)*R*1.12); } g.closePath(); g.stroke(); }
    const vg = g.createLinearGradient(0, LINE_Y, 0, BH); vg.addColorStop(0,'rgba(43,240,255,.0)'); vg.addColorStop(1,'rgba(43,240,255,.08)');
    g.fillStyle = vg; g.fillRect(0, LINE_Y, BW, BH-LINE_Y);
    g.restore();
    /* marco de neón */
    const c = this.color;
    g.shadowColor = c; g.shadowBlur = 18; g.strokeStyle = c; g.lineWidth = 3; rr(g, -4, -4, BW+8, BH+8, 16); g.stroke();
    g.shadowBlur = 0; g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 1; rr(g, -1, -1, BW+2, BH+2, 13); g.stroke();
    /* remaches */
    g.fillStyle = c; [[-4,40],[BW+4,40],[-4,BH-40],[BW+4,BH-40],[-4,BH/2],[BW+4,BH/2]].forEach(([x,y])=>{ g.beginPath(); g.arc(x,y,3,0,7); g.fill(); });
    g.restore();
  }
  drawCeil(g){
    const h = this.ceil*RH, warn = this.local && this.state==='play' && this.def.dropEvery - this.sinceDrop <= 2;
    const jit = warn ? Math.sin(this.t*40)*1.2 : 0;
    g.save(); g.translate(jit, 0);
    if (h > 0){
      const gr = g.createLinearGradient(0,0,0,h); gr.addColorStop(0,'#0b1022'); gr.addColorStop(1,'#1b2440');
      g.fillStyle = gr; g.fillRect(0, 0, BW, h);
      g.strokeStyle = 'rgba(120,200,255,.12)'; for (let y=8;y<h;y+=10){ g.beginPath(); g.moveTo(0,y); g.lineTo(BW,y); g.stroke(); }
    }
    /* borde inferior de peligro */
    g.save(); g.beginPath(); g.rect(0, h-6, BW, 6); g.clip();
    for (let x=-12;x<BW+12;x+=12){ g.fillStyle = (Math.floor(x/12)%2) ? '#ffc53b' : '#111'; g.beginPath(); g.moveTo(x, h-6); g.lineTo(x+6, h-6); g.lineTo(x, h); g.lineTo(x-6, h); g.fill(); }
    g.restore();
    g.shadowColor = warn ? '#ff3355' : this.color; g.shadowBlur = 12; g.fillStyle = warn ? '#ff3355' : this.color; g.fillRect(0, h-1.5, BW, 2);
    g.restore();
  }
  drawLine(g){
    const a = .35 + this.danger*.5 + Math.sin(this.t*(4+this.danger*8))*.15*(.3+this.danger);
    g.save(); g.setLineDash([10, 8]); g.lineDashOffset = -this.t*30;
    g.shadowColor = '#ff3355'; g.shadowBlur = 10 + this.danger*14; g.strokeStyle = `rgba(255,51,85,${a})`; g.lineWidth = 2 + this.danger*2;
    g.beginPath(); g.moveTo(0, LINE_Y); g.lineTo(BW, LINE_Y); g.stroke(); g.restore();
  }
  pathFrom(maxB){
    let x = SX, y = SY, vx = Math.cos(this.ang), vy = Math.sin(this.ang), b = 0; const pts = [[x,y]];
    const top = this.ceil*RH, laser = this.armed==='laser';
    for (let i=0;i<900;i++){
      x += vx*4; y += vy*4;
      if (x < R){ x = 2*R-x; vx = -vx; b++; pts.push([x,y]); if (b > maxB) break; }
      else if (x > BW-R){ x = 2*(BW-R)-x; vx = -vx; b++; pts.push([x,y]); if (b > maxB) break; }
      if (y - R <= top) { pts.push([x,y]); break; }
      if (!laser){ let hit = false; this.each((v,yy,xx)=>{ if (!hit){ const p = this.pos(yy,xx); if (Math.hypot(p.x-x, p.y-y) < D*.84) hit = true; } }); if (hit){ pts.push([x,y]); break; } }
      if (i%6===0) pts.push([x,y]);
    }
    return pts;
  }
  drawGuide(g){
    const pts = this.pathFrom(this.armed==='laser' ? 3 : this.guideBounces);
    const col = this.armed==='laser' ? '#ffc53b' : this.armed==='bomb' ? '#ff3355' : COL[this.cur.c].c;
    g.save();
    if (this.armed==='laser'){
      g.shadowColor = col; g.shadowBlur = 16; g.strokeStyle = col; g.globalAlpha = .55 + Math.sin(this.t*20)*.2; g.lineWidth = 4;
      g.beginPath(); pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y)); g.stroke();
    } else {
      let dist = 0, last = pts[0], off = (this.t*60)%14;
      g.fillStyle = col; g.shadowColor = col; g.shadowBlur = 8;
      for (let i=1;i<pts.length;i++){
        const [x,y] = pts[i], seg = Math.hypot(x-last[0], y-last[1]);
        for (let d = (14 - (dist+off)%14); d < seg; d += 14){ const t = d/seg, px = last[0]+(x-last[0])*t, py = last[1]+(y-last[1])*t;
          const fade = 1 - Math.min(1, (dist+d)/700); g.globalAlpha = .25 + fade*.6; g.beginPath(); g.arc(px, py, 2.6, 0, 7); g.fill(); }
        dist += seg; last = pts[i];
      }
      const e = pts[pts.length-1]; g.globalAlpha = .5; g.strokeStyle = col; g.lineWidth = 1.5; g.beginPath(); g.arc(e[0], e[1], R*.9, 0, 7); g.stroke();
    }
    g.restore();
  }
  drawGrid(g, k){
    const warn = this.local && this.state==='play' && this.def.dropEvery - this.sinceDrop <= 1;
    for (let y=0;y<this.grid.length;y++) for (let x=0;x<this.grid[y].length;x++){
      const v = this.grid[y][x]; if (!v) continue;
      const p = this.pos(y,x), sp = this.spawns.find(s=>s.y===y&&s.x===x);
      let sc = sp ? .3 + .7*easeOutBack(sp.t) : 1;
      let jx = warn ? Math.sin(this.t*35 + x + y*2)*1.3 : 0;
      if (v.t==='b') sc *= 1 + Math.sin(this.t*7 + x)*.05;
      this.spr(g, k, v.t==='m' ? 'metal' : v.t==='b' ? 'bomba' : v.c, p.x + jx, p.y, sc);
    }
  }
  drawShooter(g, k){
    const a = this.ang + Math.PI/2, rec = (this.recoil||0)*6;
    /* base */
    g.save(); g.translate(SX, SY);
    const glow = this.armed ? '#ffc53b' : this.color;
    g.shadowColor = glow; g.shadowBlur = 20;
    const bg = g.createRadialGradient(0, 8, 4, 0, 8, 46); bg.addColorStop(0,'#24305a'); bg.addColorStop(1,'#080b18');
    g.fillStyle = bg; g.beginPath(); g.ellipse(0, 26, 58, 22, 0, Math.PI, 0); g.lineTo(58, 60); g.lineTo(-58, 60); g.closePath(); g.fill();
    g.shadowBlur = 0; g.strokeStyle = glow; g.lineWidth = 2; g.beginPath(); g.ellipse(0, 26, 58, 22, 0, Math.PI, 0); g.stroke();
    /* cañón */
    g.save(); g.rotate(a); g.translate(0, rec);
    if (IMG.lanzador){ const h = 96, w = h*IMG.lanzador.width/IMG.lanzador.height; g.drawImage(IMG.lanzador, -w/2, -h*.78, w, h); }
    else {
      const cg = g.createLinearGradient(-12,0,12,0); cg.addColorStop(0,'#1a2240'); cg.addColorStop(.5,'#6c7fb8'); cg.addColorStop(1,'#1a2240');
      g.fillStyle = cg; g.beginPath(); g.moveTo(-11,-6); g.lineTo(-8,-54); g.lineTo(8,-54); g.lineTo(11,-6); g.closePath(); g.fill();
      g.strokeStyle = glow; g.lineWidth = 2; g.shadowColor = glow; g.shadowBlur = 12; g.stroke();
      g.fillStyle = glow; g.fillRect(-9,-56,18,4);
      for (let i=0;i<3;i++){ g.globalAlpha = .4 + .6*((Math.sin(this.t*6 - i)+1)/2); g.fillRect(-6, -18 - i*11, 12, 3); } g.globalAlpha = 1;
    }
    g.restore();
    /* aro y burbuja actual */
    g.shadowColor = glow; g.shadowBlur = 16; g.strokeStyle = glow; g.lineWidth = 3;
    g.beginPath(); g.arc(0, 0, R+6, 0, 7); g.stroke(); g.shadowBlur = 0;
    if (this.idle > this.hurry - 4 && this.state==='play' && !this.ball && this.local){
      const f = clamp((this.hurry - this.idle)/4, 0, 1);
      g.strokeStyle = '#ff3355'; g.lineWidth = 4; g.beginPath(); g.arc(0, 0, R+11, -Math.PI/2, -Math.PI/2 + f*Math.PI*2); g.stroke();
    }
    g.restore();
    if (this.state==='play' && !(this.ball && this.ball.b && false)){
      const sw = this.swapT || 0;
      const key = this.armed==='bomb' ? 'bomba' : this.armed==='rainbow' ? 'rainbow' : this.cur.c;
      this.spr(g, k, key, SX, SY, 1 - sw*.4);
      if (this.armed==='laser'){ g.save(); g.shadowColor='#ffc53b'; g.shadowBlur=20; g.strokeStyle='#ffc53b'; g.lineWidth=3; g.beginPath(); g.arc(SX,SY,R*.75+Math.sin(this.t*20)*2,0,7); g.stroke(); g.restore(); }
      /* siguiente */
      const nx = SX - 78, ny = SY + 30;
      g.save(); g.fillStyle = 'rgba(0,0,0,.35)'; g.strokeStyle = 'rgba(120,200,255,.35)'; g.lineWidth = 1; g.beginPath(); g.arc(nx, ny, R*.85, 0, 7); g.fill(); g.stroke();
      g.fillStyle = '#8ea3c4'; g.font = '700 8px Orbitron'; g.textAlign = 'center'; g.fillText('SIGUIENTE', nx, ny + R + 6); g.restore();
      this.spr(g, k, this.next.c, nx, ny, .65 + sw*.2);
    }
    /* robot */
    const rx = SX + 92, ry = SY + 18, bob = Math.sin(this.t*2.4)*3;
    if (IMG.robot){ const h = 92, w = h*IMG.robot.width/IMG.robot.height; g.drawImage(IMG.robot, rx - w/2, ry - h*.62 + bob, w, h); }
    else drawRobot(g, rx, ry + bob, this.color, this.t, this.state, this.combo);
  }
  drawBall(g, k){
    const b = this.ball; if (!b) return;
    const col = b.b.t==='laser' ? '#ffc53b' : b.b.t==='bomb' ? '#ff3355' : b.b.t==='rainbow' ? '#ffffff' : COL[b.b.c].c;
    g.save(); g.globalCompositeOperation = 'lighter';
    this.trail.forEach((p,i)=>{ const f = (i+1)/this.trail.length; g.globalAlpha = f*.35; g.fillStyle = col; g.beginPath(); g.arc(p.x, p.y, R*f*.9, 0, 7); g.fill(); });
    g.restore();
    if (b.b.t==='laser'){ g.save(); g.shadowColor = col; g.shadowBlur = 30; g.fillStyle = '#fff'; g.beginPath(); g.arc(b.x, b.y, R*.7, 0, 7); g.fill(); g.restore(); return; }
    this.spr(g, k, b.b.t==='bomb' ? 'bomba' : b.b.t==='rainbow' ? 'rainbow' : b.b.c, b.x, b.y, 1, b.b.t==='bomb' ? this.t*8 : 0);
  }
  drawFx(g, k){
    for (const p of this.pops) if (!p.done){ this.spr(g, k, p.key, p.x, p.y, 1 + (p.d < .05 ? .2 : 0)); }
    for (const f of this.fall) this.spr(g, k, f.dead ? 'metal' : f.key, f.x, f.y, 1, f.rot, f.dead ? .7 : 1);
    g.save(); g.globalCompositeOperation = 'lighter';
    for (const r of this.rings){ g.globalAlpha = r.life/r.max; g.strokeStyle = r.c; g.lineWidth = r.w*(r.life/r.max)+.5; g.beginPath(); g.arc(r.x, r.y, r.r, 0, 7); g.stroke(); }
    for (const p of this.parts){ g.globalAlpha = Math.min(1, p.life/p.max*1.6); g.fillStyle = p.c; g.beginPath(); g.arc(p.x, p.y, p.s, 0, 7); g.fill(); }
    g.restore();
    for (const t of this.texts){
      const a = Math.min(1, t.life/t.max*2), sc = t.big ? 1 + (1 - Math.min(1, (t.max - t.life)*5))*.6 : 1;
      g.save(); g.globalAlpha = a; g.translate(t.x, t.y); g.scale(sc, sc);
      g.font = `900 ${t.size}px Orbitron`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,.75)'; g.strokeText(t.s, 0, 0);
      g.shadowColor = t.c; g.shadowBlur = 14; g.fillStyle = t.c; g.fillText(t.s, 0, 0); g.restore();
    }
  }
}
function rr(g, x, y, w, h, r){ g.beginPath(); g.moveTo(x+r, y); g.arcTo(x+w, y, x+w, y+h, r); g.arcTo(x+w, y+h, x, y+h, r); g.arcTo(x, y+h, x, y, r); g.arcTo(x, y, x+w, y, r); g.closePath(); }
function easeOutBack(t){ const c1 = 1.70158, c3 = c1 + 1; return 1 + c3*Math.pow(t-1,3) + c1*Math.pow(t-1,2); }
/* robot provisional (luego se cambia por img/robot.png) */
function drawRobot(g, x, y, c, t, state, combo){
  g.save(); g.translate(x, y);
  const happy = state==='won' || combo >= 2, sad = state==='lost';
  /* antena */
  g.strokeStyle = '#8ea3c4'; g.lineWidth = 2; g.beginPath(); g.moveTo(0,-40); g.lineTo(0,-50); g.stroke();
  g.fillStyle = c; g.shadowColor = c; g.shadowBlur = 12; g.beginPath(); g.arc(0,-52,3.5+Math.sin(t*6)*1,0,7); g.fill(); g.shadowBlur = 0;
  /* cabeza */
  const hg = g.createLinearGradient(-20,-40,20,-6); hg.addColorStop(0,'#dfe8ff'); hg.addColorStop(1,'#6d7ca6');
  g.fillStyle = hg; rr(g, -20, -40, 40, 32, 10); g.fill();
  g.fillStyle = '#060a18'; rr(g, -15, -34, 30, 18, 7); g.fill();
  g.fillStyle = c; g.shadowColor = c; g.shadowBlur = 10;
  if (happy){ g.lineWidth = 2.5; g.strokeStyle = c; g.beginPath(); g.arc(-7,-24,4,Math.PI,0); g.stroke(); g.beginPath(); g.arc(7,-24,4,Math.PI,0); g.stroke(); }
  else if (sad){ g.fillRect(-11,-25,8,2.5); g.fillRect(3,-25,8,2.5); }
  else { const bl = (t%3.2) < .12 ? .2 : 1; g.beginPath(); g.ellipse(-7,-25,3.2,4*bl,0,0,7); g.fill(); g.beginPath(); g.ellipse(7,-25,3.2,4*bl,0,0,7); g.fill(); }
  g.shadowBlur = 0;
  /* cuerpo */
  const bg = g.createLinearGradient(-16,-6,16,24); bg.addColorStop(0,'#c9d5f5'); bg.addColorStop(1,'#4d5a80');
  g.fillStyle = bg; rr(g, -16, -6, 32, 28, 8); g.fill();
  g.fillStyle = '#060a18'; g.beginPath(); g.arc(0, 7, 6, 0, 7); g.fill();
  g.fillStyle = c; g.shadowColor = c; g.shadowBlur = 10; g.beginPath(); g.arc(0, 7, 3+Math.sin(t*4), 0, 7); g.fill(); g.shadowBlur = 0;
  /* brazos */
  g.strokeStyle = '#9fb0d8'; g.lineWidth = 5; g.lineCap = 'round';
  const wave = happy ? Math.sin(t*12)*0.6 : 0;
  g.beginPath(); g.moveTo(-16,0); g.lineTo(-26, 12 - wave*14); g.stroke();
  g.beginPath(); g.moveTo(16,0); g.lineTo(26, happy ? -14 + wave*8 : 12); g.stroke();
  g.restore();
}
