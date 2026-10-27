// Draws A4's app icons and installer art with Chromium: `npx electron scripts/make-art.js`
//   build/icon.png         the gradient orb on transparent (Windows, Linux)
//   build/icon-mac.png     the orb on a paper tile (macOS 26 puts bare circles in a gray tile)
//   build/icon.icns        the macOS icon set, made from icon-mac.png
//   build/background.png   the Mac installer window (+ @2x), behind "drag A4 to Applications"
const { app, BrowserWindow } = require('electron')
const { execFileSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const OUT = path.resolve(__dirname, '..', 'build')
const SIZE = 1024

// Apple's icon shape is close to a superellipse (n = 5): 824px tile on a 1024 canvas
function squircle(size, inset, n = 5) {
  const r = (size - inset * 2) / 2
  const c = size / 2
  const points = []
  for (let i = 0; i < 360; i++) {
    const t = (i / 360) * 2 * Math.PI
    const cos = Math.cos(t)
    const sin = Math.sin(t)
    const x = c + r * Math.sign(cos) * Math.abs(cos) ** (2 / n)
    const y = c + r * Math.sign(sin) * Math.abs(sin) ** (2 / n)
    points.push(`${x.toFixed(1)} ${y.toFixed(1)}`)
  }
  return `M ${points.join(' L ')} Z`
}

// The orb: the AI button's magenta / cyan / violet water, with a soft light on top.
// `blur` softens the colors into each other; small orbs need less of it.
const orb = (d, blur = SIZE * 0.035) => `
  <div class="orb" style="width:${d}px;height:${d}px;--blur:${blur}px">
    <div class="blob" style="--x:22%;--y:28%;--c:#00e1ff;--s:62%"></div>
    <div class="blob" style="--x:78%;--y:22%;--c:#ff2bd6;--s:64%"></div>
    <div class="blob" style="--x:80%;--y:78%;--c:#ffa21f;--s:52%"></div>
    <div class="blob" style="--x:24%;--y:82%;--c:#7a1cff;--s:66%"></div>
    <div class="blob" style="--x:52%;--y:54%;--c:#ff0f7b;--s:34%"></div>
    <div class="light"></div>
  </div>`

const ORB_STYLES = `
  .orb {
    position: relative; overflow: hidden; border-radius: 50%;
    background: #9b2cff;
    box-shadow: inset 0 -${SIZE * 0.04}px ${SIZE * 0.08}px rgba(40, 0, 80, 0.35);
  }
  .blob {
    position: absolute; left: var(--x); top: var(--y); width: var(--s); height: var(--s);
    transform: translate(-50%, -50%); border-radius: 50%;
    background: radial-gradient(circle, var(--c) 0%, color-mix(in srgb, var(--c) 60%, transparent) 45%, transparent 70%);
    filter: blur(var(--blur));
  }
  .light {
    position: absolute; inset: 0; border-radius: 50%;
    background:
      radial-gradient(ellipse 46% 34% at 36% 24%, rgba(255, 255, 255, 0.55), rgba(255, 255, 255, 0) 70%),
      radial-gradient(circle at 50% 50%, transparent 62%, rgba(255, 255, 255, 0.18) 71%, transparent 72%);
  }
`

const page = (body) => `<!doctype html><html><head><style>
  html, body { margin: 0; width: ${SIZE}px; height: ${SIZE}px; background: transparent; overflow: hidden; }
  body { display: grid; place-items: center; }
  ${ORB_STYLES}
  .tile-shadow { filter: drop-shadow(0 ${SIZE * 0.012}px ${SIZE * 0.014}px rgba(60, 40, 20, 0.28)); }
  .tile {
    width: ${SIZE}px; height: ${SIZE}px; display: grid; place-items: center;
    clip-path: path('${squircle(SIZE, 100)}');
    background: radial-gradient(circle at 50% 30%, #fdfbf6, #efe7da 75%);
  }
  .tile .orb { box-shadow: inset 0 -${SIZE * 0.03}px ${SIZE * 0.06}px rgba(40, 0, 80, 0.3), 0 ${SIZE * 0.02}px ${SIZE * 0.05}px rgba(90, 40, 120, 0.25); }
</style></head><body>${body}</body></html>`

// The Mac installer window, 540 × 380 (drawn at `scale`). The icon centres match
// build.dmg.contents in package.json: A4 at x 150, Applications at x 390, both at y 196.
const installer = (scale) => `<!doctype html><html><head>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500&family=Crimson+Text:ital@1&display=block" rel="stylesheet">
<style>
  html, body { margin: 0; overflow: hidden; }
  ${ORB_STYLES}
  .dmg {
    position: relative; width: 540px; height: 380px; zoom: ${scale};
    background: radial-gradient(circle at 50% 30%, #fdfbf6, #efe7da 90%);
    color: #2b2620;
  }
  .brand { position: absolute; top: 40px; left: 0; right: 0; display: flex; align-items: center; justify-content: center; gap: 10px; }
  .brand .orb { box-shadow: inset 0 -2px 4px rgba(40, 0, 80, 0.3); }
  .word { font-family: 'Cormorant Garamond', serif; font-weight: 500; font-size: 32px; letter-spacing: 0.04em; line-height: 1; }
  svg { position: absolute; inset: 0; }
  .hint {
    position: absolute; top: 296px; left: 0; right: 0; margin: 0; text-align: center;
    font-family: 'Crimson Text', serif; font-style: italic; font-size: 15px; color: #6f665a;
  }
</style></head><body><div class="dmg">
  <div class="brand">${orb(24, 1.6)}<span class="word">A4</span></div>
  <svg width="540" height="380" viewBox="0 0 540 380" fill="none">
    <defs><linearGradient id="sweep" x1="214" x2="326" y1="0" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#4285F4" /><stop offset="0.35" stop-color="#9B72CB" />
      <stop offset="0.7" stop-color="#D96570" /><stop offset="1" stop-color="#F2A60C" />
    </linearGradient></defs>
    <path d="M214 196H325M317 189L325 196L317 203" stroke="url(#sweep)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
  <p class="hint">Drag A4 into Applications to install</p>
</div></body></html>`

async function render(html, width = SIZE, height = SIZE) {
  const win = new BrowserWindow({
    show: false, width, height, transparent: true, frame: false, useContentSize: true,
    webPreferences: { offscreen: true },
  })
  let last = null
  win.webContents.on('paint', (event, dirty, image) => { last = image })
  win.webContents.setFrameRate(10)
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'a4-')), 'icon.html')
  fs.writeFileSync(file, html)
  await win.loadFile(file)
  await win.webContents.executeJavaScript('document.fonts.ready.then(() => true)')
  await new Promise(r => setTimeout(r, 800))
  win.destroy()
  return last.getSize().width === width ? last : last.resize({ width, height, quality: 'best' })
}

// Each render closes its window; don't let that quit the app between renders
app.on('window-all-closed', () => {})

app.whenReady().then(async () => {
  fs.mkdirSync(OUT, { recursive: true })
  fs.writeFileSync(path.join(OUT, 'icon.png'), (await render(page(orb(SIZE * 0.94)))).toPNG())
  const mac = path.join(OUT, 'icon-mac.png')
  fs.writeFileSync(mac, (await render(page(`<div class="tile-shadow"><div class="tile">${orb(SIZE * 0.56)}</div></div>`))).toPNG())

  if (process.platform === 'darwin') {
    const set = fs.mkdtempSync(path.join(os.tmpdir(), 'a4-')) + '/icon.iconset'
    fs.mkdirSync(set)
    for (const s of [16, 32, 128, 256, 512]) {
      execFileSync('sips', ['-z', String(s), String(s), mac, '--out', `${set}/icon_${s}x${s}.png`], { stdio: 'ignore' })
      execFileSync('sips', ['-z', String(s * 2), String(s * 2), mac, '--out', `${set}/icon_${s}x${s}@2x.png`], { stdio: 'ignore' })
    }
    execFileSync('iconutil', ['-c', 'icns', set, '-o', path.join(OUT, 'icon.icns')])
  }

  // dmg-builder picks these up and combines them into one Retina-ready image
  fs.writeFileSync(path.join(OUT, 'background.png'), (await render(installer(1), 540, 380)).toPNG())
  fs.writeFileSync(path.join(OUT, 'background@2x.png'), (await render(installer(2), 1080, 760)).toPNG())
  console.log('art written to', OUT)
  app.quit()
})
