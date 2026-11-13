/*******************************************************
 *  ORBITAL POP · Futurmovil  (v1.0)
 *  API JSON para la web de GitHub Pages (puntofibra.github.io/orbitalpop)
 *  - Cuentas: correo + contraseña (recuperable) o Google
 *  - Progreso de los 100 niveles (estrellas y puntos) guardado en la nube
 *  - Ranking por estrellas y puntos
 *  - Salas a dobles: solo emparejamiento (la partida va directa entre móviles por WebRTC)
 *  - Panel admin oculto (10 toques al título) con la llave NFC
 *  Implementar > Aplicación web > Ejecutar como: Yo · Acceso: Cualquier usuario
 *******************************************************/

var APP_NAME = 'ORBITAL POP';
var SHEET_ID = '1aS_GnwBsvVXC1PtaO9yFGhAjnGekGqIAIwVGyX-ko98';
var PUBLIC_BASE_URL = 'https://puntofibra.github.io/orbitalpop/';
var ADMIN_EMAIL = 'futurmovil.com@gmail.com';
var GOOGLE_CLIENT_ID = '454055120059-nuhaop4r62urc3u036cc3grpqo71ulg7.apps.googleusercontent.com';
var TZ = 'Europe/Madrid';
var NIVELES = 100;

var AJUSTES_DEF = {
  banner: '',
  mant: false,
  mantMsg: 'La nave está en revisión. Vuelve en un rato.',
  imgVer: 1
};

/* ═════════════════ ENTRADA ═════════════════ */

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.accion) return responder_(manejar_(p), p.callback);
  return HtmlService.createHtmlOutput('<meta http-equiv="refresh" content="0;url=' + PUBLIC_BASE_URL + '">ORBITAL POP');
}
function doPost(e) {
  var p = {};
  try { p = JSON.parse((e.postData && e.postData.contents) || '{}'); } catch (err) { }
  return responder_(manejar_(p));
}
function responder_(out, cb) {
  var j = JSON.stringify(out);
  if (cb && /^[\w.]+$/.test(cb)) return ContentService.createTextOutput(cb + '(' + j + ')').setMimeType(ContentService.MimeType.JAVASCRIPT);
  return ContentService.createTextOutput(j).setMimeType(ContentService.MimeType.JSON);
}

function manejar_(p) {
  try {
    var a = String(p.accion || ''), r;
    switch (a) {
      case 'config':      r = { cfg: cfgPub_() }; break;
      case 'registro':    r = registrar_(p); break;
      case 'entrar':      r = entrar_(p); break;
      case 'google':      r = google_(p); break;
      case 'yo':          r = yo_(p); break;
      case 'salir':       r = salir_(p); break;
      case 'recuperar':   r = recuperar_(p); break;
      case 'restablecer': r = restablecer_(p); break;
      case 'nivel':       r = nivel_(p); break;
      case 'sync':        r = sync_(p); break;
      case 'versus':      r = versus_(p); break;
      case 'ranking':     r = { ranking: rankings_() }; break;
      case 'salaCrear':   r = salaCrear_(p); break;
      case 'salaVer':     r = salaVer_(p); break;
      case 'salaUnir':    r = salaUnir_(p); break;
      case 'admLlave':    r = adminLlave_(p); break;
      case 'adm':         r = admin_(p); break;
      default: throw new Error('Acción desconocida');
    }
    r = r || {};
    if (r.ok === undefined) r.ok = true;
    return r;
  } catch (e) {
    return { ok: false, error: String(e && e.message || e).replace(/^Error:\s*/, '') };
  }
}

/* ═════════════════ AJUSTES ═════════════════ */

function cfg_() {
  var c = {}; try { c = JSON.parse(PropertiesService.getScriptProperties().getProperty('cfg') || '{}'); } catch (e) { }
  return Object.assign({}, AJUSTES_DEF, c);
}
function guardaCfg_(c) { PropertiesService.getScriptProperties().setProperty('cfg', JSON.stringify(c)); }
function cfgPub_() { var c = cfg_(); return { banner: c.banner, mant: c.mant, mantMsg: c.mantMsg, imgVer: c.imgVer }; }

/* ═════════════════ UTILIDADES ═════════════════ */

function ss_() { return SpreadsheetApp.openById(SHEET_ID); }
function hoja_(nombre, cab) {
  var ss = ss_(), sh = ss.getSheetByName(nombre);
  if (!sh) {
    sh = ss.insertSheet(nombre);
    sh.appendRow(cab); sh.getRange(1, 1, 1, cab.length).setFontWeight('bold').setBackground('#0b1328').setFontColor('#2bf0ff');
    sh.setFrozenRows(1);
  }
  return sh;
}
function hoy_(d) { return Utilities.formatDate(d || new Date(), TZ, 'yyyy-MM-dd'); }
function sha_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('');
}
function limpiaEmail_(e) { return String(e || '').trim().toLowerCase(); }
function emailOk_(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
function freno_(clave, max, seg) {
  var c = CacheService.getScriptCache(), k = 'fr_' + clave, n = Number(c.get(k) || 0);
  if (n >= max) throw new Error('Demasiados intentos. Espera unos minutos.');
  c.put(k, String(n + 1), seg);
}
function lockU_(fn) { var l = LockService.getScriptLock(); l.waitLock(15000); try { return fn(); } finally { l.releaseLock(); } }

/* ═════════════════ USUARIOS ═════════════════ */

var U = { Id: 0, Email: 1, Nombre: 2, Hash: 3, Sal: 4, Google: 5, Creado: 6, Ultimo: 7, Partidas: 8, Bloqueado: 9, Tokens: 10,
          Progreso: 11, Estrellas: 12, Puntos: 13, Nivel: 14, Victorias: 15, Derrotas: 16 };
var U_CAB = ['Id', 'Email', 'Nombre', 'Hash', 'Sal', 'Google', 'Creado', 'Último acceso', 'Partidas', 'Bloqueado', 'Sesiones',
             'Progreso (JSON)', 'Estrellas', 'Puntos', 'Nivel máx', 'Victorias dobles', 'Derrotas dobles'];

function usuarios_() {
  var sh = hoja_('Usuarios', U_CAB), n = sh.getLastRow();
  if (sh.getLastColumn() < U_CAB.length) sh.getRange(1, 1, 1, U_CAB.length).setValues([U_CAB]);
  var rows = n > 1 ? sh.getRange(2, 1, n - 1, U_CAB.length).getValues() : [];
  return { sh: sh, rows: rows };
}
function guardaFila_(sh, i, row) { sh.getRange(i + 2, 1, 1, row.length).setValues([row]); }
function buscar_(rows, col, v) { for (var i = 0; i < rows.length; i++) if (String(rows[i][col]).toLowerCase() === String(v).toLowerCase()) return i; return -1; }
function nuevaFila_(email, nombre, hash, sal, google) {
  return ['U' + Date.now().toString(36), email, nombre, hash, sal, google, new Date(), new Date(), 0, '', '[]', '{}', 0, 0, 0, 0, 0];
}
function nombreLibre_(rows, nombre, salvo) {
  for (var i = 0; i < rows.length; i++) if (i !== salvo && String(rows[i][U.Nombre]).toLowerCase() === nombre.toLowerCase()) return false;
  return true;
}
function prog_(row) { var o = {}; try { o = JSON.parse(row[U.Progreso] || '{}') || {}; } catch (e) { } return o; }
/* progreso: { "1":[estrellas, puntos], "2":[...], ... } */
function recalcula_(row, pg) {
  var est = 0, pts = 0, max = 0;
  Object.keys(pg).forEach(function (k) {
    var n = Number(k); if (!(n >= 1 && n <= NIVELES)) { delete pg[k]; return; }
    est += Number(pg[k][0]) || 0; pts += Number(pg[k][1]) || 0; if (n > max) max = n;
  });
  row[U.Progreso] = JSON.stringify(pg); row[U.Estrellas] = est; row[U.Puntos] = pts; row[U.Nivel] = max;
}

function nuevaSesion_(sh, i, row) {
  var t = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().slice(0, 8);
  var list = []; try { list = JSON.parse(row[U.Tokens] || '[]'); } catch (e) { }
  list.push(t); if (list.length > 6) list = list.slice(-6);
  row[U.Tokens] = JSON.stringify(list);
  row[U.Ultimo] = new Date();
  guardaFila_(sh, i, row);
  CacheService.getScriptCache().put('ses_' + t, row[U.Email], 21600);
  return { ses: t, user: pubUser_(row) };
}
function pubUser_(row) {
  return { email: row[U.Email], nombre: row[U.Nombre], partidas: Number(row[U.Partidas] || 0), admin: row[U.Email] === ADMIN_EMAIL,
           estrellas: Number(row[U.Estrellas] || 0), puntos: Number(row[U.Puntos] || 0), nivel: Number(row[U.Nivel] || 0),
           victorias: Number(row[U.Victorias] || 0), derrotas: Number(row[U.Derrotas] || 0), progreso: prog_(row) };
}

function sesion_(t) {
  t = String(t || '');
  if (t.length < 20) throw new Error('SESION');
  var email = CacheService.getScriptCache().get('ses_' + t);
  var f = usuarios_(), i = -1;
  if (email) i = buscar_(f.rows, U.Email, email);
  if (i < 0) {
    for (var k = 0; k < f.rows.length; k++) { if (String(f.rows[k][U.Tokens] || '').indexOf(t) >= 0) { i = k; break; } }
    if (i < 0) throw new Error('SESION');
    CacheService.getScriptCache().put('ses_' + t, f.rows[i][U.Email], 21600);
  }
  if (f.rows[i][U.Bloqueado]) throw new Error('Tu cuenta está bloqueada');
  return { i: i, f: f, row: f.rows[i], email: f.rows[i][U.Email] };
}
function yo_(p) { return { user: pubUser_(sesion_(p.ses).row) }; }

function registrar_(p) {
  var email = limpiaEmail_(p.email), nombre = String(p.nombre || '').replace(/[<>"]/g, '').trim().slice(0, 16), pass = String(p.pass || '');
  if (!emailOk_(email)) throw new Error('Correo no válido');
  if (nombre.length < 2) throw new Error('Elige un nombre de jugador');
  if (pass.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres');
  freno_('reg', 30, 3600);
  return lockU_(function () {
    var f = usuarios_();
    if (buscar_(f.rows, U.Email, email) >= 0) throw new Error('Ya hay una cuenta con ese correo. Entra o recupera tu contraseña.');
    if (!nombreLibre_(f.rows, nombre, -1)) throw new Error('Ese nombre de jugador ya existe. Prueba con otro.');
    var sal = Utilities.getUuid();
    var row = nuevaFila_(email, nombre, sha_(sal + pass), sal, '');
    f.sh.appendRow(row);
    return nuevaSesion_(f.sh, f.rows.length, row);
  });
}
function entrar_(p) {
  var email = limpiaEmail_(p.email), pass = String(p.pass || '');
  freno_('in_' + email, 10, 900);
  return lockU_(function () {
    var f = usuarios_(), i = buscar_(f.rows, U.Email, email);
    if (i < 0) throw new Error('No hay ninguna cuenta con ese correo');
    var row = f.rows[i];
    if (!row[U.Hash]) throw new Error('Esta cuenta se creó con Google: usa el botón de Google o recupera la contraseña');
    if (sha_(row[U.Sal] + pass) !== row[U.Hash]) throw new Error('Contraseña incorrecta');
    if (row[U.Bloqueado]) throw new Error('Tu cuenta está bloqueada');
    return nuevaSesion_(f.sh, i, row);
  });
}
function google_(p) {
  var r = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(p.credential || ''), { muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) throw new Error('No se pudo verificar tu cuenta de Google');
  var info = JSON.parse(r.getContentText());
  if (info.aud !== GOOGLE_CLIENT_ID || String(info.email_verified) !== 'true') throw new Error('Cuenta de Google no válida');
  var email = limpiaEmail_(info.email);
  return lockU_(function () {
    var f = usuarios_(), i = buscar_(f.rows, U.Email, email);
    if (i >= 0) {
      if (f.rows[i][U.Bloqueado]) throw new Error('Tu cuenta está bloqueada');
      f.rows[i][U.Google] = info.sub; return nuevaSesion_(f.sh, i, f.rows[i]);
    }
    var base = String(info.given_name || info.name || email.split('@')[0]).replace(/[<>"]/g, '').slice(0, 13), nombre = base, n = 2;
    while (!nombreLibre_(f.rows, nombre, -1)) nombre = base + (n++);
    var row = nuevaFila_(email, nombre, '', '', info.sub);
    f.sh.appendRow(row);
    return nuevaSesion_(f.sh, f.rows.length, row);
  });
}
function salir_(p) {
  CacheService.getScriptCache().remove('ses_' + p.ses);
  try {
    lockU_(function () {
      var f = usuarios_();
      for (var i = 0; i < f.rows.length; i++) {
        var s = String(f.rows[i][U.Tokens] || '');
        if (s.indexOf(p.ses) >= 0) {
          var l = JSON.parse(s).filter(function (x) { return x !== p.ses; });
          f.sh.getRange(i + 2, U.Tokens + 1).setValue(JSON.stringify(l)); break;
        }
      }
    });
  } catch (e) { }
  return {};
}
function recuperar_(p) {
  var email = limpiaEmail_(p.email);
  freno_('rec_' + email, 4, 1800);
  var f = usuarios_();
  if (buscar_(f.rows, U.Email, email) < 0) throw new Error('No hay ninguna cuenta con ese correo');
  var code = String(100000 + Math.floor(Math.random() * 900000));
  CacheService.getScriptCache().put('rec_' + email, code, 900);
  MailApp.sendEmail({
    to: email, name: APP_NAME, subject: 'Tu código para ORBITAL POP: ' + code,
    htmlBody: '<div style="font-family:Arial;background:#05060f;color:#e9f4ff;padding:30px;border-radius:16px;text-align:center">' +
      '<h1 style="color:#2bf0ff;letter-spacing:4px">ORBITAL POP</h1><p>Tu código para cambiar la contraseña es:</p>' +
      '<div style="font-size:38px;font-weight:bold;letter-spacing:10px;color:#ff2bd6">' + code + '</div>' +
      '<p style="color:#8aa0bf">Caduca en 15 minutos. Si no lo has pedido tú, ignora este correo.</p></div>'
  });
  return {};
}
function restablecer_(p) {
  var email = limpiaEmail_(p.email), pass = String(p.pass || '');
  freno_('res_' + email, 8, 1800);
  var code = CacheService.getScriptCache().get('rec_' + email);
  if (!code || code !== String(p.codigo || '').trim()) throw new Error('Código incorrecto o caducado');
  if (pass.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres');
  return lockU_(function () {
    var f = usuarios_(), i = buscar_(f.rows, U.Email, email);
    if (i < 0) throw new Error('Cuenta no encontrada');
    var sal = Utilities.getUuid();
    f.rows[i][U.Sal] = sal; f.rows[i][U.Hash] = sha_(sal + pass);
    CacheService.getScriptCache().remove('rec_' + email);
    return nuevaSesion_(f.sh, i, f.rows[i]);
  });
}

/* ═════════════════ PROGRESO DE NIVELES ═════════════════ */

var P_CAB = ['Fecha', 'Día', 'Email', 'Jugador', 'Nivel', 'Estrellas', 'Puntos', 'Disparos', 'Segundos', 'Id'];
function partidasSh_() { return hoja_('Partidas', P_CAB); }

function nivel_(p) {
  var s = sesion_(p.ses);
  var lv = Math.round(Number(p.nivel) || 0), est = Math.max(1, Math.min(3, Math.round(Number(p.estrellas) || 0)));
  var pts = Math.max(0, Math.round(Number(p.puntos) || 0)), disp = Math.max(0, Math.round(Number(p.disparos) || 0));
  var seg = Math.max(0, Math.round(Number(p.seg) || 0)), id = String(p.id || '').slice(0, 40);
  if (!(lv >= 1 && lv <= NIVELES)) throw new Error('Nivel no válido');
  if (pts > 2000000) throw new Error('Puntuación no válida');
  if (seg < 2) throw new Error('Partida demasiado corta');
  freno_('niv_' + s.email, 60, 600);
  return lockU_(function () {
    var c = CacheService.getScriptCache();
    var f = usuarios_(), i = buscar_(f.rows, U.Email, s.email), row = f.rows[i];
    if (id && c.get('pid_' + id)) return { repetida: true, user: pubUser_(row) };
    var pg = prog_(row), max = Number(row[U.Nivel] || 0);
    if (lv > max + 1) throw new Error('Ese nivel aún está bloqueado');
    var antes = pg[lv] || [0, 0], mejora = est > antes[0] || pts > antes[1];
    pg[lv] = [Math.max(antes[0], est), Math.max(antes[1], pts)];
    recalcula_(row, pg);
    row[U.Partidas] = Number(row[U.Partidas] || 0) + 1;
    guardaFila_(f.sh, i, row);
    partidasSh_().appendRow([new Date(), "'" + hoy_(), s.email, row[U.Nombre], lv, est, pts, disp, seg, id]);
    if (id) c.put('pid_' + id, '1', 21600);
    c.remove('rk_cache');
    return { user: pubUser_(row), mejora: mejora };
  });
}
/* al entrar, sube el progreso que tenía guardado en el móvil sin cuenta */
function sync_(p) {
  var s = sesion_(p.ses), loc = p.progreso || {};
  return lockU_(function () {
    var f = usuarios_(), i = buscar_(f.rows, U.Email, s.email), row = f.rows[i], pg = prog_(row), cambia = false;
    var max = Number(row[U.Nivel] || 0);
    var ks = Object.keys(loc).map(Number).filter(function (n) { return n >= 1 && n <= NIVELES; }).sort(function (a, b) { return a - b; });
    ks.forEach(function (n) {
      var v = loc[n]; if (!v) return;
      var e = Math.max(0, Math.min(3, Math.round(Number(v[0]) || 0))), pt = Math.max(0, Math.min(200000, Math.round(Number(v[1]) || 0)));
      if (!e) return;
      var a = pg[n] || [0, 0];
      if (e > a[0] || pt > a[1]) { pg[n] = [Math.max(a[0], e), Math.max(a[1], pt)]; cambia = true; }
    });
    if (cambia) { recalcula_(row, pg); guardaFila_(f.sh, i, row); CacheService.getScriptCache().remove('rk_cache'); }
    return { user: pubUser_(row) };
  });
}
function versus_(p) {
  var s = sesion_(p.ses), gana = !!p.gana, id = String(p.id || '').slice(0, 40);
  freno_('vs_' + s.email, 30, 600);
  return lockU_(function () {
    var c = CacheService.getScriptCache();
    if (id && c.get('vs_' + id)) return {};
    var f = usuarios_(), i = buscar_(f.rows, U.Email, s.email), row = f.rows[i];
    if (gana) row[U.Victorias] = Number(row[U.Victorias] || 0) + 1; else row[U.Derrotas] = Number(row[U.Derrotas] || 0) + 1;
    guardaFila_(f.sh, i, row);
    if (id) c.put('vs_' + id, '1', 21600);
    c.remove('rk_cache');
    return { user: pubUser_(row) };
  });
}

function rankings_() {
  var c = CacheService.getScriptCache(), raw = c.get('rk_cache');
  if (raw) { try { return JSON.parse(raw); } catch (e) { } }
  var f = usuarios_();
  var vivos = f.rows.filter(function (r) { return !r[U.Bloqueado]; });
  var est = vivos.filter(function (r) { return Number(r[U.Estrellas]) > 0; })
    .map(function (r) { return { n: String(r[U.Nombre]), e: Number(r[U.Estrellas]), p: Number(r[U.Puntos]), l: Number(r[U.Nivel]) }; })
    .sort(function (a, b) { return b.e - a.e || b.p - a.p; });
  var pts = est.slice().sort(function (a, b) { return b.p - a.p; });
  var vs = vivos.filter(function (r) { return Number(r[U.Victorias]) > 0; })
    .map(function (r) { return { n: String(r[U.Nombre]), v: Number(r[U.Victorias]), d: Number(r[U.Derrotas]) }; })
    .sort(function (a, b) { return b.v - a.v || a.d - b.d; });
  var out = { estrellas: est.slice(0, 50), puntos: pts.slice(0, 50), dobles: vs.slice(0, 50) };
  try { c.put('rk_cache', JSON.stringify(out), 60); } catch (e) { }
  return out;
}

/* ═════════════════ SALAS A DOBLES (solo emparejamiento) ═════════════════ */

function salaCrear_(p) {
  freno_('sala', 60, 600);
  var sdp = String(p.sdp || ''); if (sdp.length < 50 || sdp.length > 60000) throw new Error('Datos de conexión no válidos');
  var c = CacheService.getScriptCache(), abc = 'ABDEFGHJKLMNPQRSTUVWXYZ', code = '';
  for (var t = 0; t < 20; t++) { code = ''; for (var i = 0; i < 4; i++) code += abc[Math.floor(Math.random() * abc.length)]; if (!c.get('sala_' + code)) break; }
  c.put('sala_' + code, JSON.stringify({ o: sdp, hn: String(p.nombre || 'Jugador 1').replace(/[<>"]/g, '').slice(0, 16), a: '', gn: '' }), 900);
  return { code: code };
}
function sala_(code) {
  var raw = CacheService.getScriptCache().get('sala_' + String(code || '').toUpperCase().replace(/[^A-Z]/g, ''));
  if (!raw) throw new Error('Esa sala no existe o ha caducado');
  return JSON.parse(raw);
}
function salaVer_(p) {
  var s = sala_(p.code);
  if (p.rol === 'host') return { a: s.a, gn: s.gn };
  if (s.a) throw new Error('Esa sala ya está completa');
  return { o: s.o, hn: s.hn };
}
function salaUnir_(p) {
  freno_('salaU', 60, 600);
  var code = String(p.code || '').toUpperCase().replace(/[^A-Z]/g, ''), sdp = String(p.sdp || '');
  if (sdp.length < 50 || sdp.length > 60000) throw new Error('Datos de conexión no válidos');
  return lockU_(function () {
    var s = sala_(code);
    if (s.a) throw new Error('Esa sala ya está completa');
    s.a = sdp; s.gn = String(p.nombre || 'Jugador 2').replace(/[<>"]/g, '').slice(0, 16);
    CacheService.getScriptCache().put('sala_' + code, JSON.stringify(s), 900);
    return {};
  });
}

/* ═════════════════ PANEL ADMIN (solo llave NFC) ═════════════════ */

function tokenAdmin_() {
  var t = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().slice(0, 8);
  CacheService.getScriptCache().put('adm_' + t, '1', 14400);
  return t;
}
function esAdminTk_(t) { return !!t && CacheService.getScriptCache().get('adm_' + t) === '1'; }
function llaves_() { try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('llaves') || '[]'); } catch (e) { return []; } }
function adminLlave_(p) {
  freno_('admllave', 10, 600);
  var llave = String(p.llave || '').toLowerCase().replace(/[^0-9a-f]/g, '');
  if (llave.length < 6) throw new Error('Llave no válida');
  var list = llaves_(), h = sha_('orbitalpop|' + llave), nueva = false;
  if (!list.length) {
    var esAdm = false; try { esAdm = sesion_(p.ses).email === ADMIN_EMAIL; } catch (e) { }
    if (!esAdm) throw new Error('Para registrar tu primera llave, inicia sesión antes con ' + ADMIN_EMAIL);
    list.push(h); PropertiesService.getScriptProperties().setProperty('llaves', JSON.stringify(list)); nueva = true;
  } else if (list.indexOf(h) < 0) throw new Error('Esta llave no está autorizada');
  return { adm: tokenAdmin_(), nueva: nueva };
}

function admin_(p) {
  if (!esAdminTk_(p.adm)) throw new Error('ADMIN');
  var op = String(p.op || ''), d = p.d || {}, c = cfg_();
  if (op === 'resumen') {
    var f = usuarios_(), hoy = hoy_(), sh = partidasSh_(), n = sh.getLastRow();
    var ult = n > 1 ? sh.getRange(Math.max(2, n - 29), 1, Math.min(30, n - 1), 9).getValues().reverse() : [];
    var hoyN = 0;
    if (n > 1) sh.getRange(Math.max(2, n - 3000), 2, Math.min(3000, n - 1), 1).getValues().forEach(function (r) { if ((r[0] instanceof Date ? hoy_(r[0]) : String(r[0])) === hoy) hoyN++; });
    return {
      ajustes: c, partidasTotal: Math.max(0, n - 1), partidasHoy: hoyN,
      ultimas: ult.map(function (r) { return { f: r[0], j: r[3], l: r[4], e: r[5], p: r[6] }; }),
      usuarios: f.rows.map(function (r) { return { email: r[U.Email], nombre: r[U.Nombre], estrellas: Number(r[U.Estrellas] || 0), puntos: Number(r[U.Puntos] || 0), nivel: Number(r[U.Nivel] || 0), v: Number(r[U.Victorias] || 0), google: !!r[U.Google], bloq: !!r[U.Bloqueado], ultimo: r[U.Ultimo] }; })
        .sort(function (a, b) { return b.estrellas - a.estrellas; }),
      llaves: llaves_().length
    };
  }
  if (op === 'ajustes') {
    c.banner = String(d.banner || '').slice(0, 200);
    c.mant = !!d.mant;
    c.mantMsg = String(d.mantMsg || '').slice(0, 200) || AJUSTES_DEF.mantMsg;
    guardaCfg_(c); return { ajustes: c };
  }
  if (op === 'imgVer') { c.imgVer = Number(c.imgVer || 1) + 1; guardaCfg_(c); return { imgVer: c.imgVer }; }
  if (op === 'bloquear' || op === 'reset' || op === 'todo') {
    return lockU_(function () {
      var f = usuarios_(), i = buscar_(f.rows, U.Email, limpiaEmail_(d.email));
      if (i < 0) throw new Error('Usuario no encontrado');
      var row = f.rows[i];
      if (op === 'bloquear') {
        if (row[U.Email] === ADMIN_EMAIL) throw new Error('No puedes bloquear al admin');
        row[U.Bloqueado] = d.bloq ? 'SI' : ''; if (d.bloq) row[U.Tokens] = '[]';
      } else if (op === 'reset') {
        recalcula_(row, {});
      } else {
        var pg = prog_(row); for (var k = 1; k <= NIVELES; k++) if (!pg[k]) pg[k] = [1, 0];
        recalcula_(row, pg);
      }
      guardaFila_(f.sh, i, row);
      CacheService.getScriptCache().remove('rk_cache');
      return {};
    });
  }
  if (op === 'llavesBorrar') { PropertiesService.getScriptProperties().deleteProperty('llaves'); return {}; }
  throw new Error('Operación desconocida');
}

/* Ejecutar una vez desde el editor para crear las hojas y dar permisos */
function setupInicial() {
  usuarios_(); partidasSh_();
  Logger.log('Hojas listas en: ' + ss_().getUrl());
}
