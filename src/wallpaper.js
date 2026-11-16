// Ставит обои в систему и умеет вернуть те, что были.
// Windows — SystemParametersInfo через PowerShell, KDE — скрипт plasmashell по D-Bus, GNOME — gsettings.

const { execFile } = require('child_process')

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { windowsHide: true, timeout: 15000 }, (err, out) => (err ? reject(err) : resolve(out.trim())))
  })
}

function ps(script) {
  const encoded = Buffer.from(script, 'utf16le').toString('base64')
  return run('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded])
}

const psString = s => "'" + String(s).replace(/'/g, "''") + "'"

function desktop() {
  if (process.platform === 'win32') return 'windows'
  const de = (process.env.XDG_CURRENT_DESKTOP || '').toLowerCase()
  if (de.includes('kde')) return 'kde'
  if (de.includes('gnome') || de.includes('unity') || de.includes('budgie')) return 'gnome'
  return null
}

const supported = () => desktop() !== null

// --- Windows ---

const WIN_SET = path => `
Set-ItemProperty -Path 'HKCU:\\Control Panel\\Desktop' -Name WallpaperStyle -Value '10'
Set-ItemProperty -Path 'HKCU:\\Control Panel\\Desktop' -Name TileWallpaper -Value '0'
Add-Type -TypeDefinition 'using System.Runtime.InteropServices; public class WP { [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int SystemParametersInfo(int a, int b, string c, int d); }'
[WP]::SystemParametersInfo(20, 0, ${psString(path)}, 3) | Out-Null
`

async function winGet() {
  const out = await ps(`Get-ItemProperty -Path 'HKCU:\\Control Panel\\Desktop' | Select-Object WallPaper, WallpaperStyle, TileWallpaper | ConvertTo-Json -Compress`)
  const j = JSON.parse(out)
  return { kind: 'windows', path: j.WallPaper || '', style: j.WallpaperStyle || '10', tile: j.TileWallpaper || '0' }
}

async function winRestore(o) {
  await ps(`
Set-ItemProperty -Path 'HKCU:\\Control Panel\\Desktop' -Name WallpaperStyle -Value ${psString(o.style)}
Set-ItemProperty -Path 'HKCU:\\Control Panel\\Desktop' -Name TileWallpaper -Value ${psString(o.tile)}
Add-Type -TypeDefinition 'using System.Runtime.InteropServices; public class WP { [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int SystemParametersInfo(int a, int b, string c, int d); }'
[WP]::SystemParametersInfo(20, 0, ${psString(o.path)}, 3) | Out-Null
`)
}

// --- KDE Plasma ---

async function kdeScript(js) {
  for (const bin of ['qdbus6', 'qdbus']) {
    try {
      return await run(bin, ['org.kde.plasmashell', '/PlasmaShell', 'org.kde.PlasmaShell.evaluateScript', js])
    } catch (err) {
      if (err.code !== 'ENOENT') throw err
    }
  }
  throw new Error('qdbus не найден')
}

async function kdeGet() {
  const out = await kdeScript(`print(JSON.stringify(desktops().map(function (d) {
    d.currentConfigGroup = ['Wallpaper', 'org.kde.image', 'General']
    return { id: d.id, plugin: d.wallpaperPlugin, image: d.readConfig('Image', '') }
  })))`)
  return { kind: 'kde', desktops: JSON.parse(out) }
}

function kdeSet(file) {
  const url = JSON.stringify('file://' + file)
  return kdeScript(`desktops().forEach(function (d) {
    d.wallpaperPlugin = 'org.kde.image'
    d.currentConfigGroup = ['Wallpaper', 'org.kde.image', 'General']
    d.writeConfig('Image', ${url})
    d.writeConfig('FillMode', 2)
    d.reloadConfig()
  })`)
}

function kdeRestore(o) {
  return kdeScript(`var saved = ${JSON.stringify(o.desktops)}
  desktops().forEach(function (d) {
    var s = saved.filter(function (x) { return x.id === d.id })[0]
    if (!s) return
    d.currentConfigGroup = ['Wallpaper', 'org.kde.image', 'General']
    d.writeConfig('Image', s.image)
    d.wallpaperPlugin = s.plugin
    d.reloadConfig()
  })`)
}

// --- GNOME ---

const GKEY = 'org.gnome.desktop.background'

async function gnomeGet() {
  const [uri, dark, options] = await Promise.all([
    run('gsettings', ['get', GKEY, 'picture-uri']),
    run('gsettings', ['get', GKEY, 'picture-uri-dark']).catch(() => ''),
    run('gsettings', ['get', GKEY, 'picture-options'])
  ])
  const unquote = s => s.replace(/^'|'$/g, '')
  return { kind: 'gnome', uri: unquote(uri), dark: unquote(dark), options: unquote(options) }
}

async function gnomeSet(file) {
  await run('gsettings', ['set', GKEY, 'picture-options', 'zoom'])
  await run('gsettings', ['set', GKEY, 'picture-uri', 'file://' + file])
  await run('gsettings', ['set', GKEY, 'picture-uri-dark', 'file://' + file]).catch(() => {})
}

async function gnomeRestore(o) {
  await run('gsettings', ['set', GKEY, 'picture-options', o.options])
  await run('gsettings', ['set', GKEY, 'picture-uri', o.uri])
  if (o.dark) await run('gsettings', ['set', GKEY, 'picture-uri-dark', o.dark]).catch(() => {})
}

// --- общее ---

function get() {
  switch (desktop()) {
    case 'windows': return winGet()
    case 'kde': return kdeGet()
    case 'gnome': return gnomeGet()
    default: return Promise.resolve(null)
  }
}

function set(file) {
  switch (desktop()) {
    case 'windows': return ps(WIN_SET(file))
    case 'kde': return kdeSet(file)
    case 'gnome': return gnomeSet(file)
    default: return Promise.resolve()
  }
}

function restore(original) {
  if (!original) return Promise.resolve()
  switch (original.kind) {
    case 'windows': return winRestore(original)
    case 'kde': return kdeRestore(original)
    case 'gnome': return gnomeRestore(original)
    default: return Promise.resolve()
  }
}

module.exports = { supported, get, set, restore }
