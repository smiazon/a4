// Starts the unpackaged app (`npm run electron` / `npm run electron:dev`).
//
// On macOS Electron is opened through LaunchServices (`open`) so it is its own
// "responsible" app for privacy checks. Started straight from a terminal,
// editor or agent, macOS checks *that* app's Info.plist instead, and kills
// Electron the moment a page touches Bluetooth or the camera (passkey sign-in
// on Gmail or Outlook does). Extra arguments are passed on to Electron.
const { spawn, spawnSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')
const electron = require('electron')

const root = path.resolve(__dirname, '..')
const args = [root, ...process.argv.slice(2)]

if (process.platform !== 'darwin') {
  const child = spawn(electron, args, { stdio: 'inherit' })
  child.on('exit', (code) => process.exit(code ?? 0))
} else {
  const bundle = path.resolve(electron, '../../..') // …/Electron.app/Contents/MacOS/Electron
  const log = path.join(os.tmpdir(), `a4-electron-${process.pid}.log`)
  fs.writeFileSync(log, '')

  // `open` doesn't connect stdio, so main-process output goes to a file we follow
  const tail = spawn('tail', ['-f', log], { stdio: 'inherit' })
  const app = spawn('open', ['-W', '-n', '-a', bundle, '--stdout', log, '--stderr', log, '--args', ...args], { stdio: 'inherit' })

  const finish = (code) => {
    tail.kill()
    fs.rmSync(log, { force: true })
    process.exit(code ?? 0)
  }
  app.on('exit', finish)

  // Ctrl+C: quit this app's Electron (not other Electron apps)
  const escaped = `${electron} ${root}`.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      spawnSync('pkill', ['-TERM', '-f', `^${escaped}`])
      finish(0)
    })
  }
}
