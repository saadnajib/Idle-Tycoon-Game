// Procedurally draws the Ribbon app icon and splash as SVG, then rasterizes them with sharp
// (installed with @capacitor/assets). Output goes to assets/, the input folder for `npm run assets`.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const out = path.join(__dirname, '..', 'assets');
fs.mkdirSync(out, { recursive: true });

const NAVY_TOP = '#0d1541', NAVY_MID = '#1a1a52', NAVY_BOTTOM = '#07060d';

// A glowing, tapering, hue-cycling ribbon drawn as many short round-capped segments.
// (cx, cy, w) place the curve; w is its horizontal span in px.
function ribbon(cx, cy, w) {
  const N = 90, segs = [];
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const x = cx - w / 2 + t * w;
    const y = cy + Math.sin(t * Math.PI * 1.6 + 0.35) * w * 0.17 * (0.55 + 0.45 * t) - (t - 0.5) * w * 0.12;
    pts.push([x, y]);
  }
  for (let i = 0; i < N; i++) {
    const t = i / N;
    const width = w * (0.012 + 0.07 * Math.pow(t, 1.25));   // thin tail -> thick head
    const hue = (185 + t * 250) % 360;                       // cyan -> violet -> pink -> gold
    const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
    segs.push(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" ` +
      `stroke="hsl(${hue.toFixed(0)},100%,${(62 + 10 * t).toFixed(0)}%)" stroke-width="${width.toFixed(1)}" stroke-linecap="round"/>`);
  }
  const [hx, hy] = pts[N];
  const head = `<circle cx="${hx.toFixed(1)}" cy="${hy.toFixed(1)}" r="${(w * 0.05).toFixed(1)}" fill="#fff4d6"/>`;
  const body = segs.join('') + head;
  return `<g filter="url(#glow)" opacity=".85">${body}</g><g>${body}</g>`;
}

function defs(size, withBg) {
  return `<defs>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${(size * 0.022).toFixed(1)}"/></filter>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${NAVY_TOP}"/><stop offset=".55" stop-color="${NAVY_MID}"/><stop offset="1" stop-color="${NAVY_BOTTOM}"/>
    </linearGradient>
    <radialGradient id="halo" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#5a3cff" stop-opacity=".28"/><stop offset="1" stop-color="#5a3cff" stop-opacity="0"/></radialGradient>
  </defs>` + (withBg ? `<rect width="${size}" height="${size}" fill="url(#bg)"/>` : '');
}

const svg = (size, inner) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${inner}</svg>`;

const S = 1024, P = 2732;
const files = {
  // Full-bleed square icon (iOS masks the corners itself).
  'icon.svg': svg(S, defs(S, true) + `<circle cx="512" cy="512" r="470" fill="url(#halo)"/>` + ribbon(512, 520, 760)),
  // Android adaptive icon layers: the foreground keeps the curve inside the 66% safe zone.
  'icon-foreground.svg': svg(S, defs(S, false) + ribbon(512, 520, 560)),
  'icon-background.svg': svg(S, defs(S, true)),
  // Splash: dark field, small curve centered.
  'splash.svg': svg(P, defs(P, true) + `<circle cx="1366" cy="1366" r="520" fill="url(#halo)"/>` + ribbon(1366, 1366, 640)),
};

(async () => {
  for (const [name, text] of Object.entries(files)) {
    fs.writeFileSync(path.join(out, name), text);
    const png = name.replace('.svg', '.png');
    let img = sharp(Buffer.from(text));
    // App Store rejects icons with an alpha channel; only the adaptive foreground keeps transparency.
    if (name !== 'icon-foreground.svg') img = img.flatten({ background: NAVY_BOTTOM }).removeAlpha();
    await img.png().toFile(path.join(out, png));
    console.log('assets/' + png);
  }
  // @capacitor/assets input names
  fs.copyFileSync(path.join(out, 'icon.png'), path.join(out, 'icon-only.png'));
  fs.copyFileSync(path.join(out, 'splash.png'), path.join(out, 'splash-dark.png'));
  for (const f of ['icon-foreground.svg', 'icon-background.svg', 'splash.svg']) fs.unlinkSync(path.join(out, f));
  console.log('assets/icon-only.png, assets/splash-dark.png');
})();
