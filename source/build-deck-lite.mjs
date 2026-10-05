// Builds the lite deck, deck/lite/index.html (one self-contained file), from deck/src/slides-lite.html
// + deck.css + lite.css, checks every slide's layout, and exports deck/lite/african-ancestry-lite.pdf.
// It embeds deck/assets exactly as they are (the full deck's mockups); it does not re-run prep-assets.py.
// Usage: npm run deck:lite   (set CHROME_PATH to a headless shell to run inside a macOS sandbox)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as L from 'lucide-react';
import { chromium } from 'playwright';
import { MILESTONES } from '../deck/src/milestones.mjs';
import { growthChart } from './growth-chart.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const deck = path.join(root, 'deck');

const b64 = (f) => fs.readFileSync(f).toString('base64');
const mime = (f) => (f.endsWith('.svg') ? 'image/svg+xml' : f.endsWith('.png') ? 'image/png' : 'image/jpeg');
const asset = (name) => `data:${mime(name)};base64,${b64(path.join(deck, 'assets', name))}`;
const icon = (name, size) => renderToStaticMarkup(createElement(L[name], { size: Number(size), strokeWidth: 1.5, 'aria-hidden': 'true' }));

let src = fs.readFileSync(path.join(deck, 'src/slides-lite.html'), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
// Timeline: {{timeline}} is the overview; {{timeline:N}} is the same timeline with milestone N
// highlighted (pulsing node) and the others grayed out, shown before each milestone's slide
const fill = (n) => `calc((100% - 168px) * ${n - 1} / 4 + ${(n - 1) * 56 + 200}px)`;
const track = (active) => `<div class="tl"><div class="tl-track"><i style="width:${fill(active || 1)}"></i></div>${MILESTONES.map((m, k) => {
  const n = k + 1;
  const node = active ? (n < active ? ' on' : n === active ? ' pulse' : '') : n === 1 ? ' on' : '';
  return `<div class="tl-col${active && n !== active ? ' dim' : ''}"><span class="tl-node${node}"></span><p class="eyebrow" style="margin-top:34px">0${n}</p><p class="tl-name" style="margin-top:4px; height:92px">${m.name}</p><p class="small" style="margin-top:12px; height:96px">${m.change}</p><hr class="hair" style="margin:22px 0"><p class="outcome-label">Brings back</p><p class="outcome" style="margin-top:6px">${m.brings}</p></div>`;
}).join('')}</div>`;
src = src.replace(/\{\{timeline(?::(\d))?\}\}/g, (_, d) => track(d ? Number(d) : 0));
src = src.replace('{{chart:growth}}', growthChart());
src = src.replace(/\{\{icon:(\w+):(\d+)\}\}/g, (_, n, s) => icon(n, s));
src = src.replace(/src="asset:([^"]+)"/g, (_, f) => `src="${asset(f)}"`);
const sections = [...src.matchAll(/<section[\s\S]*?<\/section>/g)].map((m) => m[0]);
const total = sections.length;
const logo = asset('logo.svg');
const slides = sections.map((s, i) => {
  if (/data-bare/.test(s)) return s;
  const n = String(i + 1).padStart(2, '0');
  const chrome = `<div class="chrome-count"><span>${n} / ${String(total).padStart(2, '0')}</span><span class="track"><i style="width:${((i + 1) / total) * 100}%"></i></span></div>`;
  return s.replace(/(<section[^>]*>)/, `$1\n${chrome}`);
});

const fontDir = path.join(root, 'node_modules/@fontsource/inter-tight/files');
const fonts = [300, 400, 500].map((w) => `@font-face{font-family:'Inter Tight';font-weight:${w};font-display:block;src:url(data:font/woff2;base64,${b64(path.join(fontDir, `inter-tight-latin-${w}-normal.woff2`))}) format('woff2')}`).join('\n');
const css = fs.readFileSync(path.join(deck, 'src/deck.css'), 'utf8') + '\n' + fs.readFileSync(path.join(deck, 'src/lite.css'), 'utf8');
const chev = (d) => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>African Ancestry · The next chapter (lite)</title>
<style>
${fonts}
*{box-sizing:border-box}
html,body{margin:0;height:100%;background:#F1EEE9;overflow:hidden;-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums}
#stage{position:fixed;left:0;top:0;width:var(--W,1920px);height:1080px;transform-origin:0 0}
#stage>section{position:absolute;left:0;top:0;width:100%;height:1080px;overflow:hidden;visibility:hidden;opacity:0;transition:opacity 280ms ease,visibility 0s linear 280ms}
#stage>section.is-current{visibility:visible;opacity:1;transition:opacity 280ms ease}
section aside{display:none}
${css}
.controls{position:fixed;right:22px;bottom:22px;z-index:10;display:flex;gap:2px;align-items:center;padding:6px;border-radius:999px;background:rgba(47,44,42,.9);color:#F4F1EC;font:400 15px/1 'Inter Tight',Arial,sans-serif;transition:opacity .3s}
.controls.idle{opacity:0}
.controls button{width:44px;height:44px;border-radius:999px;border:0;background:transparent;color:inherit;cursor:pointer;display:grid;place-items:center;font:inherit}
.controls button:hover,.controls button[aria-pressed=true]{background:rgba(255,255,255,.14)}
.controls .count{padding:0 10px;min-width:64px;text-align:center}
.notes{position:fixed;left:0;right:0;bottom:0;z-index:9;max-height:40vh;overflow:auto;background:#F8F6F2;color:#2B2826;padding:24px 32px 96px;border-radius:24px 24px 0 0;box-shadow:0 -12px 40px rgba(60,45,30,.18);transform:translateY(104%);transition:transform .38s cubic-bezier(.32,.72,0,1);font:300 20px/30px 'Inter Tight',Arial,sans-serif}
.notes.open{transform:none}
.notes .label{font-size:15px;line-height:20px;font-weight:400;color:#7B756E;margin-bottom:8px}
.notes p{max-width:1100px;margin:0}
@media print{
  @page{size:1920px 1080px;margin:0}
  html,body{height:auto;overflow:visible;background:#F1EEE9}
  #stage{position:static;transform:none!important;width:1920px!important;height:auto}
  #stage>section{position:relative;visibility:visible;opacity:1;break-after:page;page-break-after:always}
  .controls,.notes{display:none}
}
</style>
</head>
<body>
<div id="stage">
${slides.join('\n')}
</div>
<nav class="controls" aria-label="Slides">
  <button id="prev" aria-label="Previous slide">${chev('m15 18-6-6 6-6')}</button>
  <span class="count" id="count" aria-live="polite"></span>
  <button id="next" aria-label="Next slide">${chev('m9 18 6-6-6-6')}</button>
  <button id="notes-btn" aria-label="Speaker notes (N)" aria-pressed="false" title="Speaker notes (N)">N</button>
  <button id="full" aria-label="Full screen (F)" title="Full screen (F)">F</button>
</nav>
<div class="notes" id="notes" role="region" aria-label="Speaker notes"><div class="label" id="notes-label"></div><p id="notes-body"></p></div>
<script>
(() => {
  const slides = [...document.querySelectorAll('#stage > section')];
  const stage = document.getElementById('stage');
  const notes = document.getElementById('notes');
  const notesBtn = document.getElementById('notes-btn');
  const controls = document.querySelector('.controls');
  let i = Math.min(slides.length - 1, Math.max(0, (parseInt(location.hash.slice(1), 10) || 1) - 1));
  // Fluid width: on windows wider than 16:9 the canvas grows (up to 2400) so slides fill the screen
  const fit = () => {
    const W = Math.round(Math.max(1920, Math.min(2400, 1080 * innerWidth / innerHeight)));
    stage.style.setProperty('--W', W + 'px');
    const s = Math.min(innerWidth / W, innerHeight / 1080);
    stage.style.transform = 'translate(' + (innerWidth - W * s) / 2 + 'px,' + (innerHeight - 1080 * s) / 2 + 'px) scale(' + s + ')';
  };
  // Builds: a slide with data-steps reveals its [data-step] items one click at a time, and any
  // chart with data-states tweens to the matching state. Leaving backwards lands on the full build.
  const stepsOf = (s) => +(s.dataset.steps || 0);
  let step = 0;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const chartTo = (svg, k, animate) => {
    const d = svg._d || (svg._d = JSON.parse(svg.dataset.states));
    const to = d.states[k], from = svg._cur || d.states[d.states.length - 1];
    const polys = svg.querySelectorAll('[data-layer]'), tops = svg.querySelectorAll('[data-top]'), labs = svg.querySelectorAll('[data-label]');
    const line = (row) => row.map((y, n) => d.x[n] + ',' + y.toFixed(1));
    const draw = (t) => {
      const mix = (a, b) => a + (b - a) * t;
      const st = from.stacks.map((row, L) => row.map((y, n) => mix(y, to.stacks[L][n])));
      st.forEach((row, L) => {
        const bot = L ? st[L - 1] : d.x.map(() => d.base);
        polys[L].setAttribute('points', line(row).concat(line(bot).reverse()).join(' '));
        tops[L].setAttribute('points', line(row).join(' '));
      });
      const lb = from.labels.map((a, j) => ({ y: mix(a.y, to.labels[j].y), o: mix(a.o, to.labels[j].o) }));
      labs.forEach((el, j) => { el.setAttribute('y', lb[j].y.toFixed(1)); el.setAttribute('opacity', lb[j].o.toFixed(2)); });
      svg._cur = t === 1 ? to : { stacks: st, labels: lb };
    };
    cancelAnimationFrame(svg._raf);
    if (!animate || still) return draw(1);
    const t0 = performance.now();
    const tick = (now) => { const p = Math.min(1, (now - t0) / 1100); draw(p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2); if (p < 1) svg._raf = requestAnimationFrame(tick); };
    svg._raf = requestAnimationFrame(tick);
  };
  const build = (s, k, animate) => {
    s.querySelectorAll('[data-step]').forEach((el) => el.classList.toggle('on', +el.dataset.step <= k));
    s.querySelectorAll('svg[data-states]').forEach((svg) => chartTo(svg, k, animate));
  };
  const show = (n, atEnd) => {
    i = Math.min(slides.length - 1, Math.max(0, n));
    step = atEnd ? stepsOf(slides[i]) : 0;
    if (stepsOf(slides[i])) build(slides[i], step, false);
    slides.forEach((s, k) => s.classList.toggle('is-current', k === i));
    document.getElementById('count').textContent = (i + 1) + ' / ' + slides.length;
    const t = slides[i].querySelector('h1,h2');
    document.getElementById('notes-label').textContent = 'Notes, slide ' + (i + 1) + (t ? ': ' + t.textContent.replace(/\\s+/g, ' ').trim() : '');
    document.getElementById('notes-body').textContent = (slides[i].querySelector('aside') || {}).textContent || '';
    history.replaceState(null, '', '#' + (i + 1));
  };
  const next = () => { if (step < stepsOf(slides[i])) build(slides[i], ++step, true); else show(i + 1); };
  const prev = () => { if (step > 0) build(slides[i], --step, true); else show(i - 1, true); };
  addEventListener('beforeprint', () => slides.forEach((s) => stepsOf(s) && build(s, stepsOf(s), false)));
  addEventListener('afterprint', () => stepsOf(slides[i]) && build(slides[i], step, false));
  const toggleNotes = () => notesBtn.setAttribute('aria-pressed', notes.classList.toggle('open'));
  document.getElementById('prev').onclick = prev;
  document.getElementById('next').onclick = next;
  notesBtn.onclick = toggleNotes;
  document.getElementById('full').onclick = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen());
  addEventListener('keydown', (e) => {
    if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); next(); }
    else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); prev(); }
    else if (e.key === 'Home') show(0); else if (e.key === 'End') show(slides.length - 1);
    else if (e.key === 'n' || e.key === 'N') toggleNotes();
    else if (e.key === 'f' || e.key === 'F') document.getElementById('full').click();
  });
  addEventListener('hashchange', () => { const n = parseInt(location.hash.slice(1), 10); if (n && n - 1 !== i) show(n - 1); });
  stage.addEventListener('click', (e) => (e.clientX > innerWidth / 3 ? next() : prev()));
  let t; const wake = () => { controls.classList.remove('idle'); clearTimeout(t); t = setTimeout(() => controls.classList.add('idle'), 2500); };
  addEventListener('mousemove', wake); addEventListener('resize', fit);
  fit(); show(i); wake();
})();
</script>
</body>
</html>
`;
const outDir = path.join(deck, 'lite');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, 'index.html');
fs.writeFileSync(out, html);
console.log(`wrote deck/lite/index.html (${(html.length / 1e6).toFixed(1)} MB, ${slides.length} slides)`);

// Layout check: nothing past the 1920x1080 canvas or below y 980, no text under 24px, notes on every slide
const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH, args: ['--single-process', '--no-zygote'] } : { channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(pathToFileURL(out).href);
await page.evaluate(() => document.fonts.ready);
const report = await page.evaluate(() => [...document.querySelectorAll('#stage > section')].map((s) => {
  s.classList.add('is-current');
  const r0 = s.getBoundingClientRect();
  const bad = [];
  let small = 0;
  for (const el of s.querySelectorAll('h1,h2,h3,p,span,div,img')) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const bottom = r.bottom - r0.top, right = r.right - r0.left;
    if ((r.top - r0.top > 1 || r.height < 1079) && (bottom > 1016 || right > 1860 || r.left - r0.left < 60)) bad.push(`${el.tagName} ${Math.round(r.left - r0.left)},${Math.round(r.top - r0.top)}-${Math.round(right)},${Math.round(bottom)} "${(el.textContent || el.alt || '').trim().slice(0, 30)}"`);
    if (/^(P|H1|H2|H3)$/.test(el.tagName) && el.textContent.trim() && parseFloat(getComputedStyle(el).fontSize) < 24) small++;
    if (el.matches('.cause-t, .cause-s, .one') && el.scrollWidth > el.clientWidth + 1) bad.push(`one-line text too wide "${el.textContent.trim().slice(0, 30)}"`);
    if (/^(P|H1|H2|H3)$/.test(el.tagName) && el.style.height && el.scrollHeight > el.clientHeight + 2) bad.push(`${el.tagName} text overflows its box "${el.textContent.trim().slice(0, 30)}"`);
  }
  s.classList.remove('is-current');
  return { id: s.id, bad: [...new Set(bad)].slice(0, 5), small, notes: !!(s.querySelector('aside') || {}).textContent };
}));
let problems = 0;
for (const r of report) {
  const msg = [r.bad.length ? r.bad.join(' | ') : '', r.small ? `${r.small} text under 24px` : '', r.notes ? '' : 'no notes'].filter(Boolean).join('; ');
  if (msg) problems++;
  console.log(`${r.id.padEnd(10)} ${msg || 'ok'}`);
}
await page.emulateMedia({ media: 'print' });
await page.pdf({ path: path.join(outDir, 'african-ancestry-lite.pdf'), width: '1920px', height: '1080px', printBackground: true, preferCSSPageSize: true });
console.log(`wrote deck/lite/african-ancestry-lite.pdf${problems ? `; ${problems} slide(s) need a look` : ''}`);
await browser.close();
