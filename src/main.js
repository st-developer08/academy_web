const $ = (s, r = document) => r.querySelector(s), app = $('#app'), LET = ['а', 'б', 'в', 'г'];
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const sh = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const st = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
// Все темы подхватываются автоматически из src/tests/*.json
const tests = Object.values(import.meta.glob('./tests/*.json', { eager: true })).map(m => m.default).sort((a, b) => a.order - b.order);
const total = tests.reduce((s, t) => s + t.questions.length, 0);
const courseOf = t => (t.subtitle || '').split(' · ')[0].replace(/\s*\(.*\)/, '');
const MIX = { slug: 'mix', title: 'Итоговый тест', subtitle: 'Случайные вопросы из всех тем курса', mix: true };

// ---- тема ----
const root = document.documentElement;
root.dataset.theme = st.get('theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
const icon = () => { $('#theme').textContent = root.dataset.theme === 'dark' ? '☀' : '☾'; }; icon();
$('#theme').onclick = () => { root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark'; st.set('theme', root.dataset.theme); icon(); };

// ---- оценка: 5 — от 85%, 4 — 70–84%, 3 — 55–69%, 2 — ниже ----
const minFor = (n, p) => { for (let k = 0; k <= n; k++) if (k / n >= p - 1e-9) return k; return n; };
const gradeOf = (s, n) => { const p = s / n + 1e-9; return p >= .85 ? [5, 'отлично', '#16a34a'] : p >= .7 ? [4, 'хорошо', '#2563eb'] : p >= .55 ? [3, 'удовлетворительно', '#d97706'] : [2, 'неудовлетворительно', '#dc2626']; };
const rng = (a, b) => a === b ? `${a}` : `${a}–${b}`;

// ---- роутер (/slug, /slug.html, /mix) ----
let kb = null;
addEventListener('keydown', e => kb && kb(e));
addEventListener('popstate', route);
document.addEventListener('click', e => { const a = e.target.closest('a[data-link]'); if (a) { e.preventDefault(); history.pushState({}, '', a.getAttribute('href')); route(); } });
function route() {
  const slug = location.pathname.replace(/^\/|\/$|\.html$/g, '');
  const t = slug === 'mix' ? MIX : tests.find(x => x.slug === slug);
  kb = null; scrollTo(0, 0); t ? quiz(t) : home();
}

// ---- главная ----
let flt = 'Все', qv = '';
function card(t, i) {
  const n = t.questions.length, [, ...r] = (t.subtitle || '').split(' · ');
  return `<article class="card" style="--i:${i};--h:${courseOf(t).endsWith('2') ? 285 : 225}"><div class="ctop"><span class="num">${String(t.order).padStart(2, '0')}</span><span class="tag">${esc(courseOf(t))}</span></div>
    <h2>${esc(t.title)}</h2><p class="desc">${esc(r.join(' · '))}</p><div class="meta"><span>${n} вопросов</span><span>≈ ${Math.max(1, Math.round(n / 2))} мин</span></div>
    <div class="actions"><a class="btn pri" data-link href="/${t.slug}">Пройти тест →</a>${t.pdf ? `<a class="btn ghost" href="${t.pdf}" target="_blank" rel="noopener">Презентация</a>` : ''}</div></article>`;
}
function home() {
  document.title = 'Академическое письмо · тесты · ТГТУ';
  const cs = ['Все', ...new Set(tests.map(courseOf))];
  app.innerHTML = `<section class="hero wrap"><p class="eyebrow">ТГТУ · Ташкентский государственный технический университет</p>
    <h1>Академическое <span class="grad">письмо</span></h1><p class="lead">Тесты по каждой теме курса: ответ виден сразу, а в конце — оценка по 5-балльной шкале.</p>
    <div class="cta"><a class="btn pri big" data-link href="/mix">⚡ Итоговый тест</a><button class="btn ghost big" id="go2">Выбрать тему</button></div>
    <div class="stats"><div><b>${tests.length}</b>тем</div><div><b>${total}</b>вопросов</div><div><b>5</b>балльная шкала</div></div></section>
    <section class="wrap" id="list"><div class="tools"><div class="chips">${cs.map(c => `<button class="chip" data-c="${esc(c)}">${esc(c)}</button>`).join('')}</div>
    <input id="q" type="search" placeholder="Найти тему…" aria-label="Поиск темы" autocomplete="off" value="${esc(qv)}"></div><div class="grid" id="grid"></div></section>`;
  const draw = () => {
    document.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c.dataset.c === flt));
    const v = qv.trim().toLowerCase();
    const l = tests.filter(t => (flt === 'Все' || courseOf(t) === flt) && (t.title + ' ' + (t.subtitle || '')).toLowerCase().includes(v));
    $('#grid').innerHTML = l.map(card).join('') || '<p class="empty">Ничего не найдено</p>';
  };
  $('#list').onclick = e => { const c = e.target.closest('.chip'); if (c) { flt = c.dataset.c; draw(); } };
  $('#q').oninput = e => { qv = e.target.value; draw(); };
  $('#go2').onclick = () => $('#list').scrollIntoView({ behavior: 'smooth' });
  draw();
}

// ---- тест ----
function quiz(t) {
  document.title = `${t.title} · тест`;
  let qs = [], i = 0, sc = 0, wr = [], lock = true, t0 = 0, n = 0;
  const all = () => t.mix ? sh(tests.flatMap(x => x.questions.map(q => ({ ...q, src: x.title })))).slice(0, 15) : t.questions;
  const shell = h => { app.innerHTML = h; };
  const toast = m => { const e = $('#toast'); e.textContent = m; e.hidden = false; setTimeout(() => e.hidden = true, 2600); };
  const start = list => {
    qs = list.map(q => { const ix = sh([0, 1, 2, 3]); return { ...q, o: ix.map(k => q.o[k]), a: ix.indexOf(q.a) }; });
    n = qs.length; i = 0; sc = 0; wr = []; t0 = Date.now(); show();
  };
  const intro = () => {
    shell(`<div class="qwrap"><a class="back" data-link href="/">← Все темы</a><div class="panel"><p class="eyebrow">${t.mix ? 'Итоговый тест' : 'Тема ' + esc(t.order)}</p><h1>${esc(t.title)}</h1><p class="lead">${esc(t.subtitle || '')}</p>
      <ul class="rules"><li>${t.mix ? 15 : t.questions.length} вопросов, на каждый одна попытка</li><li>Верно или нет — видно сразу, с пояснением</li><li>Клавиши: 1–4 — ответ, Enter — дальше</li></ul><button class="btn pri big" id="go">Начать тест</button></div></div>`);
    $('#go').onclick = () => start(all()); kb = e => { if (e.key === 'Enter') start(all()); };
  };
  const show = () => {
    lock = false; const q = qs[i];
    shell(`<div class="qwrap"><div class="qbar"><a class="x" data-link href="/" aria-label="Выйти">✕</a><div class="prog"><i style="width:${i / n * 100}%"></i></div><span>${i + 1}/${n}</span></div>
      <h2 class="q">${esc(q.q)}</h2><div class="opts">${q.o.map((o, k) => `<button class="opt" data-k="${k}"><span class="L">${LET[k]}</span><span>${esc(o)}</span></button>`).join('')}</div></div><div id="fb" class="sheet" hidden aria-live="polite"></div>`);
    document.querySelectorAll('.opt').forEach(b => b.onclick = () => pick(+b.dataset.k));
    kb = e => { if (/^[1-4]$/.test(e.key)) pick(+e.key - 1); else if (e.key === 'Enter' && $('#nx')) next(); };
  };
  const pick = k => {
    if (lock || k > 3) return; lock = true;
    const q = qs[i], ok = k === q.a; ok ? sc++ : wr.push({ q, k });
    document.querySelectorAll('.opt').forEach((b, x) => { b.disabled = true; b.classList.toggle('ok', x === q.a); b.classList.toggle('bad', x === k && !ok); });
    $('.prog i').style.width = (i + 1) / n * 100 + '%';
    const f = $('#fb'); f.className = 'sheet ' + (ok ? 'ok' : 'bad'); f.hidden = false;
    f.innerHTML = `<div class="sin"><div><b>${ok ? 'Верно!' : 'Неверно'}</b>${ok ? '' : `<p>Правильный ответ: <b>${LET[q.a]}) ${esc(q.o[q.a])}</b></p>`}<p>${esc(q.e)}</p><small>Повторить: ${q.src ? `«${esc(q.src)}», ` : ''}слайд ${q.s}</small></div>
      <button class="btn pri big" id="nx">${i < n - 1 ? 'Дальше' : 'Узнать оценку'}</button></div>`;
    $('#nx').onclick = next; $('#nx').focus({ preventScroll: true });
  };
  const next = () => { i++; i < n ? show() : result(); };
  const result = () => {
    const [g, w, c] = gradeOf(sc, n), p = Math.round(sc / n * 100), s = Math.round((Date.now() - t0) / 1000), tm = `${s / 60 | 0}:${String(s % 60).padStart(2, '0')}`;
    const m5 = minFor(n, .85), m4 = minFor(n, .7), m3 = minFor(n, .55), bad = wr.map(x => x.q);
    shell(`<div class="qwrap"><div class="panel res"><div class="ring"><svg viewBox="0 0 120 120"><circle class="trk" cx="60" cy="60" r="54"/><circle class="val" cx="60" cy="60" r="54" style="stroke:${c}"/></svg><div class="gr" style="color:${c}">${g}</div></div>
      <h1>Оценка: ${g}</h1><p class="word" style="color:${c}">${w}</p>
      <div class="kpi"><div><b>${sc}/${n}</b>верно</div><div><b>${p}%</b>точность</div><div><b>${tm}</b>время</div></div>
      ${wr.length ? `<details class="rev" open><summary>Разбор ошибок (${wr.length})</summary>${wr.map(({ q, k }) => `<div class="item"><b>${esc(q.q)}</b><div class="no">Ваш ответ: ${esc(q.o[k])}</div><div class="yes">Верно: ${esc(q.o[q.a])}</div><small>${esc(q.e)}</small></div>`).join('')}</details>` : '<p class="perfect">Без единой ошибки!</p>'}
      <input id="nm" placeholder="Ваше имя — добавится к результату для преподавателя" autocomplete="name">
      <div class="actions center">${wr.length ? `<button class="btn pri" id="er">Повторить ошибки (${wr.length})</button>` : ''}<button class="btn ghost" id="cp">Скопировать результат</button><button class="btn ghost" id="pr">Печать</button><button class="btn ghost" id="re">Заново</button><a class="btn ghost" data-link href="/">Все темы</a></div>
      <p class="scale">Шкала: <b>5</b> — ${rng(m5, n)} верных (от 85%) · <b>4</b> — ${rng(m4, m5 - 1)} (70–84%) · <b>3</b> — ${rng(m3, m4 - 1)} (55–69%) · <b>2</b> — ${rng(0, m3 - 1)} (ниже 55%)</p></div></div><div id="toast" hidden></div>`);
    requestAnimationFrame(() => requestAnimationFrame(() => { $('.val').style.strokeDashoffset = 339.3 * (1 - sc / n); }));
    $('#re').onclick = () => start(all()); $('#pr').onclick = () => print();
    if (bad.length) $('#er').onclick = () => start(bad);
    $('#cp').onclick = async () => {
      const nm = $('#nm').value.trim(), tx = `${nm ? nm + ' — ' : ''}«${t.title}»: ${sc} из ${n} (${p}%), оценка ${g}, время ${tm}`;
      try { await navigator.clipboard.writeText(tx); } catch { const a = document.createElement('textarea'); a.value = tx; document.body.append(a); a.select(); document.execCommand('copy'); a.remove(); }
      toast('Скопировано — можно отправить преподавателю');
    };
    kb = null; if (g === 5) confetti();
  };
  intro();
}

// ---- конфетти за «5» ----
function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = document.createElement('canvas'); c.className = 'confetti'; document.body.append(c);
  const x = c.getContext('2d'); c.width = innerWidth; c.height = innerHeight;
  const cols = ['#4f46e5', '#7c3aed', '#06b6d4', '#16a34a', '#f59e0b', '#ef4444'], L = 'АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЭЮЯ';
  const ps = Array.from({ length: 130 }, () => ({ x: Math.random() * c.width, y: -20 - Math.random() * c.height * .5, s: 14 + Math.random() * 14, vx: (Math.random() - .5) * 4, vy: 2 + Math.random() * 4, r: Math.random() * 6, vr: (Math.random() - .5) * .3, c: cols[Math.random() * 6 | 0], ch: L[Math.random() * L.length | 0] }));
  let f = 0;
  (function tick() {
    x.clearRect(0, 0, c.width, c.height);
    for (const p of ps) { p.x += p.vx; p.y += p.vy; p.r += p.vr; x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.font = `800 ${p.s}px Manrope,sans-serif`; x.fillText(p.ch, 0, 0); x.restore(); }
    ++f < 260 ? requestAnimationFrame(tick) : c.remove();
  })();
}
route();
