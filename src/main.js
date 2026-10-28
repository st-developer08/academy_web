const $ = (s, r = document) => r.querySelector(s);
const app = $('#app');
const LET = ['а', 'б', 'в', 'г'];
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const store = {
  get: k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// Все тесты берутся автоматически из src/tests/*.json
const tests = Object.values(import.meta.glob('./tests/*.json', { eager: true }))
  .map(m => m.default).sort((a, b) => a.order - b.order);

// ---------- тема ----------
const root = document.documentElement;
root.dataset.theme = store.get('theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
$('#theme').onclick = () => { const t = root.dataset.theme === 'dark' ? 'light' : 'dark'; root.dataset.theme = t; store.set('theme', t); };

// ---------- оценка ----------
const minFor = (n, p) => { for (let k = 0; k <= n; k++) if (k / n >= p - 1e-9) return k; return n; };
const gradeOf = (s, n) => { const p = s / n + 1e-9;
  return p >= .85 ? [5, 'отлично', '#2e7d32'] : p >= .70 ? [4, 'хорошо', '#1f5fa8'] : p >= .55 ? [3, 'удовлетворительно', '#c77700'] : [2, 'неудовлетворительно', '#b3261e']; };
const rng = (a, b) => a === b ? `${a}` : `${a}–${b}`;

// ---------- роутер (пути вида /slug, поддерживаются и /slug.html) ----------
let kb = null;
addEventListener('keydown', e => kb && kb(e));
addEventListener('popstate', route);
document.addEventListener('click', e => {
  const a = e.target.closest('a[data-link]');
  if (a) { e.preventDefault(); history.pushState({}, '', a.getAttribute('href')); route(); }
});
function route() {
  const slug = location.pathname.replace(/^\/|\/$|\.html$/g, '');
  const t = tests.find(x => x.slug === slug);
  kb = null; scrollTo(0, 0);
  t ? quiz(t) : home();
}

// ---------- главная ----------
function card(t, i) {
  const best = store.get('best:' + t.slug);
  return `<article class="card" style="--i:${i}">
    <div class="num"><small>тема</small>${esc(t.order)}</div>
    <div class="cbody"><h2>${esc(t.title)}</h2><p>${esc(t.subtitle || '')}</p>
      <div class="meta"><span class="chip">${t.questions.length} вопросов</span>${best ? `<span class="chip g${best.g}">Лучшая оценка: ${best.g}</span>` : ''}</div>
      <div class="actions"><a class="btn" data-link href="/${t.slug}">Пройти тест</a>${t.pdf ? `<a class="btn ghost" href="${t.pdf}" target="_blank" rel="noopener">Презентация</a>` : ''}</div>
    </div></article>`;
}
function home() {
  document.title = 'Тесты по академическому письму · ТГТУ';
  const total = tests.reduce((s, t) => s + t.questions.length, 0);
  app.innerHTML = `<section class="hero"><div class="wrap"><p class="eyebrow">ТГТУ · Ташкентский государственный технический университет</p><h1>Академическое <span class="hl">письмо</span></h1><p class="lead">Тесты для самопроверки после каждой темы: ответ виден сразу, а в конце — оценка по 5-балльной шкале.</p><div class="tags"><span>Тезис</span><span>Аргумент</span><span>Вывод</span></div><div class="stats"><div><b>${tests.length}</b><span>тем</span></div><div><b>${total}</b><span>вопросов</span></div><div><b>5</b><span>балльная шкала</span></div></div></div></section>
    <section class="wrap grid">${tests.map(card).join('')}</section>`;
}

// ---------- тест ----------
function quiz(t) {
  document.title = `Тест: ${t.title} · ТГТУ`;
  const n = t.questions.length;
  let qs = [], i = 0, score = 0, wrong = [], locked = true;
  const shell = inner => { app.innerHTML = `<div class="wrap narrow"><a class="back" data-link href="/">← Все тесты</a><div class="qcard">${inner}</div></div>`; };

  const start = () => {
    qs = t.questions.map(q => { const ix = shuffle([0, 1, 2, 3]); return { ...q, o: ix.map(k => q.o[k]), a: ix.indexOf(q.a) }; });
    i = 0; score = 0; wrong = []; show();
  };
  const intro = () => {
    shell(`<p class="eyebrow">Тема ${esc(t.order)}</p><h1>${esc(t.title)}</h1><p class="lead">${esc(t.subtitle || '')}</p>
      <ul class="rules"><li>${n} вопросов, на каждый одна попытка</li><li>Верно или нет — видно сразу, с пояснением</li><li>Быстрые клавиши: 1–4 для ответа, Enter — дальше</li></ul>
      <button class="btn big" id="go">Начать тест</button>`);
    $('#go').onclick = start;
    kb = e => { if (e.key === 'Enter') start(); };
  };
  const show = () => {
    locked = false; const q = qs[i];
    shell(`<div class="qtop"><span>Вопрос ${i + 1} из ${n}</span><span>Верных: ${score}</span></div>
      <div class="bar"><i style="width:${i / n * 100}%"></i></div>
      <h2 class="q">${esc(q.q)}</h2>
      <div class="opts">${q.o.map((o, k) => `<button class="opt" data-k="${k}"><span class="L">${LET[k]}</span><span>${esc(o)}</span></button>`).join('')}</div><div id="fb"></div>`);
    document.querySelectorAll('.opt').forEach(b => b.onclick = () => pick(+b.dataset.k));
    requestAnimationFrame(() => { $('.bar i').style.width = (i + 1) / n * 100 + '%'; });
    kb = e => { if (/^[1-4]$/.test(e.key)) pick(+e.key - 1); else if (e.key === 'Enter' && $('#nx')) next(); };
  };
  const pick = k => {
    if (locked || k >= 4) return; locked = true;
    const q = qs[i], ok = k === q.a;
    ok ? score++ : wrong.push({ q, k });
    document.querySelectorAll('.opt').forEach((b, x) => { b.disabled = true; b.classList.toggle('ok', x === q.a); b.classList.toggle('bad', x === k && !ok); });
    $('#fb').innerHTML = `<div class="fb ${ok ? 'ok' : 'bad'}"><b>${ok ? 'Верно!' : 'Неверно'}</b>${ok ? '' : `<div>Правильный ответ: <b>${LET[q.a]}) ${esc(q.o[q.a])}</b></div>`}<div>${esc(q.e)}</div><small>Повторить: слайд ${q.s} презентации</small></div>
      <button class="btn big" id="nx">${i < n - 1 ? 'Дальше' : 'Узнать оценку'}</button>`;
    $('#nx').onclick = next; $('#nx').focus({ preventScroll: true });
  };
  const next = () => { i++; i < n ? show() : result(); };
  const result = () => {
    const [g, word, col] = gradeOf(score, n), pct = Math.round(score / n * 100);
    const prev = store.get('best:' + t.slug); if (!prev || score > prev.s) store.set('best:' + t.slug, { s: score, g });
    const m5 = minFor(n, .85), m4 = minFor(n, .70), m3 = minFor(n, .55);
    const review = wrong.length ? `<details class="rev" open><summary>Разбор ошибок (${wrong.length})</summary>${wrong.map(({ q, k }) =>
      `<div class="item"><b>${esc(q.q)}</b><div class="no">Ваш ответ: ${esc(q.o[k])}</div><div class="yes">Верно: ${esc(q.o[q.a])}</div><small>${esc(q.e)} (слайд ${q.s})</small></div>`).join('')}</details>` : '<p class="perfect">Без единой ошибки!</p>';
    shell(`<div class="res"><div class="ring"><svg viewBox="0 0 120 120"><circle class="trk" cx="60" cy="60" r="54"/><circle class="val" cx="60" cy="60" r="54" style="stroke:${col}"/></svg><div class="gr" style="color:${col}">${g}</div></div>
      <h1>Оценка: ${g}</h1><p class="word" style="color:${col}">${word}</p>
      <p>Верных ответов <b>${score} из ${n}</b> · ${pct}%</p>${review}
      <p class="scale">Шкала: <b>5</b> — ${rng(m5, n)} верных (от 85%) · <b>4</b> — ${rng(m4, m5 - 1)} (70–84%) · <b>3</b> — ${rng(m3, m4 - 1)} (55–69%) · <b>2</b> — ${rng(0, m3 - 1)} (ниже 55%)</p>
      <div class="actions center"><button class="btn" id="re">Пройти заново</button><a class="btn ghost" data-link href="/">Все тесты</a></div></div>`);
    requestAnimationFrame(() => requestAnimationFrame(() => { $('.val').style.strokeDashoffset = 339.3 * (1 - score / n); }));
    $('#re').onclick = start; kb = null;
    if (g === 5) confetti();
  };
  intro();
}

// ---------- конфетти за «5» ----------
function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = document.createElement('canvas'); c.className = 'confetti'; document.body.append(c);
  const x = c.getContext('2d'); c.width = innerWidth; c.height = innerHeight;
  const cols = ['#1f3a68', '#b3261e', '#2e7d32', '#c77700', '#6a3fa0'], LET2 = 'АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЭЮЯ';
  const ps = Array.from({ length: 140 }, () => ({ x: Math.random() * c.width, y: -20 - Math.random() * c.height * .5, w: 6 + Math.random() * 6, h: 8 + Math.random() * 8,
    vx: (Math.random() - .5) * 4, vy: 2 + Math.random() * 4, r: Math.random() * 6, vr: (Math.random() - .5) * .3, c: cols[Math.random() * 5 | 0], ch: LET2[Math.random() * LET2.length | 0] }));
  let f = 0;
  (function tick() {
    x.clearRect(0, 0, c.width, c.height);
    for (const p of ps) { p.x += p.vx; p.y += p.vy; p.r += p.vr; x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.font = 'bold ' + p.w * 3 + 'px Georgia,serif'; x.fillText(p.ch, 0, 0); x.restore(); }
    ++f < 260 ? requestAnimationFrame(tick) : c.remove();
  })();
}

route();
