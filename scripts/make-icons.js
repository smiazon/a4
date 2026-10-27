// Draws A4's app icons with Chromium: `npx electron scripts/make-icons.js`
//   build/icon.png      the gradient orb on transparent (Windows, Linux)
//   build/icon-mac.png  the orb on a paper tile (macOS 26 puts bare circles in a gray tile)
//   build/icon.icns     the macOS icon set, made from icon-mac.png
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

// The orb: the AI button's magenta / cyan / violet water, with a soft light on top
const orb = (d) => `
  <div class="orb" style="width:${d}px;height:${d}px">
    <div class="blob" style="--x:22%;--y:28%;--c:#00e1ff;--s:62%"></div>
    <div class="blob" style="--x:78%;--y:22%;--c:#ff2bd6;--s:64%"></div>
    <div class="blob" style="--x:80%;--y:78%;--c:#ffa21f;--s:52%"></div>
    <div class="blob" style="--x:24%;--y:82%;--c:#7a1cff;--s:66%"></div>
    <div class="blob" style="--x:52%;--y:54%;--c:#ff0f7b;--s:34%"></div>
    <div class="light"></div>
  </div>`

const page = (body) => `<!doctype html><html><head><style>
  html, body { margin: 0; width: ${SIZE}px; height: ${SIZE}px; background: transparent; overflow: hidden; }
  body { display: grid; place-items: center; }
  .orb {
    position: relative; overflow: hidden; border-radius: 50%;
    background: #9b2cff;
    box-shadow: inset 0 -${SIZE * 0.04}px ${SIZE * 0.08}px rgba(40, 0, 80, 0.35);
  }
  .blob {
    position: absolute; left: var(--x); top: var(--y); width: var(--s); height: var(--s);
    transform: translate(-50%, -50%); border-radius: 50%;
    background: radial-gradient(circle, var(--c) 0%, color-mix(in srgb, var(--c) 60%, transparent) 45%, transparent 70%);
    filter: blur(${SIZE * 0.035}px);
  }
  .light {
    position: absolute; inset: 0; border-radius: 50%;
    background:
      radial-gradient(ellipse 46% 34% at 36% 24%, rgba(255, 255, 255, 0.55), rgba(255, 255, 255, 0) 70%),
      radial-gradient(circle at 50% 50%, transparent 62%, rgba(255, 255, 255, 0.18) 71%, transparent 72%);
  }
  .tile-shadow { filter: drop-shadow(0 ${SIZE * 0.012}px ${SIZE * 0.014}px rgba(60, 40, 20, 0.28)); }
  .tile {
    width: ${SIZE}px; height: ${SIZE}px; display: grid; place-items: center;
    clip-path: path('${squircle(SIZE, 100)}');
    background: radial-gradient(circle at 50% 30%, #fdfbf6, #efe7da 75%);
  }
  .tile .orb { box-shadow: inset 0 -${SIZE * 0.03}px ${SIZE * 0.06}px rgba(40, 0, 80, 0.3), 0 ${SIZE * 0.02}px ${SIZE * 0.05}px rgba(90, 40, 120, 0.25); }
</style></head><body>${body}</body></html>`

async function render(html) {
  const win = new BrowserWindow({
    show: false, width: SIZE, height: SIZE, transparent: true, frame: false, useContentSize: true,
    webPreferences: { offscreen: true },
  })
  let last = null
  win.webContents.on('paint', (event, dirty, image) => { last = image })
  win.webContents.setFrameRate(10)
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'a4-')), 'icon.html')
  fs.writeFileSync(file, html)
  await win.loadFile(file)
  await new Promise(r => setTimeout(r, 800))
  win.destroy()
  const { width } = last.getSize()
  return width === SIZE ? last : last.resize({ width: SIZE, height: SIZE, quality: 'best' })
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
  console.log('icons written to', OUT)
  app.quit()
})
