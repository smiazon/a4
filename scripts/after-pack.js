// electron-builder afterPack: give the Mac app an ad-hoc signature.
// Packaging changes the bundle, so Electron's own signature no longer matches,
// and macOS would call a downloaded copy "damaged" with no way to open it. With
// a valid ad-hoc signature people can open it from Privacy & Security instead.
// A real Developer ID (if one is set up) still replaces this when electron-builder signs.
const { execFileSync } = require('child_process')
const path = require('path')

exports.default = async function afterPack({ electronPlatformName, appOutDir, packager }) {
  if (electronPlatformName !== 'darwin') return
  const app = path.join(appOutDir, `${packager.appInfo.productFilename}.app`)
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' })
}
