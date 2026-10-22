const STAGE = { w: 1600, h: 900 };
const CX = STAGE.w / 2, CY = STAGE.h / 2;
const ZOOM = 1.8;
const PUSH_MARGIN = 14;
const SVG_NS = 'http://www.w3.org/2000/svg';
const DATA_DIRS = ['data/', 'template/'];

const stage = document.getElementById('stage');

function fit() {
  const s = Math.min(innerWidth / STAGE.w, innerHeight / STAGE.h);
  stage.style.transform = `translate(-50%, -50%) scale(${s})`;
}
addEventListener('resize', fit);
fit();

// Average photo color, pushed toward a saturated tone so dark portraits still glow.
function glowFrom(img) {
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0, 16, 16);
  const d = ctx.getImageData(0, 0, 16, 16).data;
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) {
    const spread = Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]);
    const w = 1 + spread / 32; // favor colorful pixels over gray backdrops
    r += d[i] * w; g += d[i + 1] * w; b += d[i + 2] * w; n += w;
  }
  const [h, s, l] = rgbToHsl(r / n, g / n, b / n);
  return `hsla(${h}, ${Math.max(s, 55)}%, ${Math.min(Math.max(l, 42), 58)}%, .6)`;
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > .5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}

function el(tag, cls, attrs = {}) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
  return e;
}

// User data wins; the bundled template keeps a fresh clone working.
async function loadData() {
  for (const dir of DATA_DIRS) {
    const res = await fetch(dir + 'people.json');
    if (res.ok) {
      if (dir === 'template/') console.info('Showing template/. Copy it to data/ and edit data/people.json.');
      return { dir, data: await res.json() };
    }
  }
  throw new Error('No people.json found in data/ or template/');
}

function buildFrame(img, tagline, name) {
  const frame = el('span', 'frame');
  frame.append(el('span', 'glow'), img);
  const label = el('span', 'label');
  label.append(name);
  if (tagline) { const s = el('small'); s.textContent = tagline; label.appendChild(s); }
  return [frame, label];
}

async function main() {
  const { dir, data } = await loadData();
  const title = data.title.replace('{name}', data.name);
  document.title = title;
  document.getElementById('title').textContent = title;
  document.getElementById('subtitle').textContent = data.subtitle || '';

  const chip = document.getElementById('chip');
  if (data.chip) {
    chip.hidden = false;
    chip.href = data.chip.href;
    chip.querySelector('span').textContent = data.chip.label;
  }
  const repo = document.getElementById('repo');
  if (data.repo) {
    repo.hidden = false;
    repo.href = data.repo.href;
    repo.querySelector('span').textContent = data.repo.label;
  }
  const src = document.getElementById('sources');
  if (data.sourcesLink) {
    src.hidden = false;
    src.textContent = data.sourcesLink.label;
    src.href = dir + data.sourcesLink.href;
  }

  const ratio = data.ellipseRatio;
  const svg = document.getElementById('rings');
  data.rings.forEach(r => {
    const e = document.createElementNS(SVG_NS, 'ellipse');
    e.setAttribute('cx', CX); e.setAttribute('cy', CY);
    e.setAttribute('rx', r.radiusY * ratio); e.setAttribute('ry', r.radiusY);
    svg.appendChild(e);
  });

  // Center: the owner.
  const meImg = el('img', 'photo', { src: dir + data.photo, alt: data.name });
  const me = el('div', 'me');
  const [meFrame, meLabel] = buildFrame(meImg, '', data.name);
  me.append(meFrame, meLabel);
  me.style.cssText = `--w:150px;--h:150px;left:${CX}px;top:${CY}px`;
  stage.appendChild(me);

  const nodes = [];
  data.rings.forEach((ring, ringIdx) => {
    const items = data.items.filter(i => i.ring === ringIdx + 1);
    const cover = ring.shape === 'cover';
    items.forEach((item, idx) => {
      const w = cover ? ring.size * .72 : ring.size, h = ring.size;
      const node = el('div', 'node' + (cover ? ' cover' : ''));
      node.style.setProperty('--i', nodes.length);
      const shift = el('div', 'shift');
      const a = el('a', '', { href: item.links[0] || '#', 'aria-label': item.name });
      a.style.cssText = `--w:${w}px;--h:${h}px`;
      if (item.links[0]) { a.target = '_blank'; a.rel = 'noopener'; } else { a.addEventListener('click', e => e.preventDefault()); }
      const img = el('img', 'photo', { src: dir + item.photo, alt: '' });
      const [frame, label] = buildFrame(img, item.tagline, item.name);
      a.append(frame, label);
      shift.appendChild(a);
      node.appendChild(shift);
      stage.appendChild(node);

      const setGlow = () => a.style.setProperty('--glow', item.glow || glowFrom(img));
      img.complete ? setGlow() : img.addEventListener('load', setGlow);

      nodes.push({ node, shift, a, ring, radius: Math.max(w, h) / 2, angle: ring.phase + (360 / items.length) * idx, x: 0, y: 0 });
    });
  });

  // Keep zoomed items from covering neighbours: push them radially away while one is active.
  function spread(active) {
    nodes.forEach(n => {
      let px = 0, py = 0;
      if (active && n !== active) {
        const dx = n.x - active.x, dy = n.y - active.y;
        const dist = Math.hypot(dx, dy) || 1;
        const need = active.radius * ZOOM + n.radius + PUSH_MARGIN + 18; // 18 = label height
        if (dist < need) { px = (dx / dist) * (need - dist); py = (dy / dist) * (need - dist); }
      }
      n.shift.style.setProperty('--px', px + 'px');
      n.shift.style.setProperty('--py', py + 'px');
    });
  }

  let active = null;
  nodes.forEach(n => {
    const on = () => { active = n; n.node.classList.add('is-active'); spread(n); };
    const off = () => { active = null; n.node.classList.remove('is-active'); spread(null); };
    n.a.addEventListener('pointerenter', on); n.a.addEventListener('pointerleave', off);
    n.a.addEventListener('focus', on); n.a.addEventListener('blur', off);
  });

  const spin = data.rotation?.enabled && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  let last = performance.now();
  function frame(now) {
    const dt = Math.min((now - last) / 1000, .1);
    last = now;
    nodes.forEach(n => {
      if (spin && !active) n.angle += n.ring.degPerSecond * dt;
      const rad = n.angle * Math.PI / 180;
      n.x = CX + Math.cos(rad) * n.ring.radiusY * ratio;
      n.y = CY + Math.sin(rad) * n.ring.radiusY;
      n.node.style.transform = `translate3d(${n.x}px, ${n.y}px, 0)`;
    });
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
main();
