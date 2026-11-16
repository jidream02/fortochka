const { app, BrowserWindow, Tray, Menu, ipcMain, screen, nativeImage, shell } = require('electron')
const path = require('path')
const store = require('./store')
const weather = require('./weather')
const { watchWindows } = require('./windows')

let overlay = null
let panel = null
let tray = null
let stopWatching = () => {}
let lastWeather = null
let weatherTimer = null
let quitting = false

if (!app.requestSingleInstanceLock()) {
  app.quit()
}

app.on('second-instance', () => showPanel())

function send(channel, payload) {
  for (const win of [overlay, panel]) {
    if (win && !win.isDestroyed()) win.webContents.send(channel, payload)
  }
}

function displayInfo() {
  const d = screen.getPrimaryDisplay()
  return {
    width: d.bounds.width,
    height: d.bounds.height,
    // верх панели задач относительно экрана — туда садится питомец и падает снег
    floor: d.workArea.y + d.workArea.height - d.bounds.y,
    scale: d.scaleFactor
  }
}

function createOverlay() {
  const d = screen.getPrimaryDisplay()
  overlay = new BrowserWindow({
    x: d.bounds.x,
    y: d.bounds.y,
    width: d.bounds.width,
    height: d.bounds.height,
    transparent: true,
    frame: false,
    resizable: false,
    movable: false,
    focusable: false,
    skipTaskbar: true,
    hasShadow: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      backgroundThrottling: false
    }
  })
  overlay.setAlwaysOnTop(true, 'screen-saver')
  overlay.setIgnoreMouseEvents(true, { forward: true })
  overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  overlay.loadFile(path.join(__dirname, 'overlay', 'index.html'))

  overlay.webContents.on('did-finish-load', () => {
    overlay.webContents.send('display', displayInfo())
    if (lastWeather) overlay.webContents.send('weather', lastWeather)
  })

  stopWatching()
  stopWatching = watchWindows(d.scaleFactor, list => {
    const ox = d.bounds.x
    const oy = d.bounds.y
    send('windows', list.map(w => ({ ...w, x: w.x - ox, y: w.y - oy })))
  })
}

function createPanel() {
  panel = new BrowserWindow({
    width: 980,
    height: 660,
    minWidth: 820,
    minHeight: 560,
    show: false,
    title: 'Форточка',
    backgroundColor: '#141a2b',
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  })
  panel.loadFile(path.join(__dirname, 'panel', 'index.html'))
  panel.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  panel.once('ready-to-show', () => {
    if (!process.argv.includes('--hidden')) panel.show()
  })
  // закрытие = спрятать, иначе радио выключится
  panel.on('close', e => {
    if (quitting) return
    e.preventDefault()
    panel.hide()
  })
}

function showPanel() {
  if (!panel) return
  panel.show()
  panel.focus()
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, '..', 'assets', 'icon.png')).resize({ width: 16, height: 16 })
  tray = new Tray(icon)
  tray.setToolTip('Форточка')
  tray.on('click', showPanel)
  refreshTray()
}

function refreshTray() {
  if (!tray) return
  const s = store.get()
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Открыть', click: showPanel },
    {
      label: s.paused ? 'Включить эффекты' : 'Пауза',
      click: () => applySettings({ paused: !s.paused })
    },
    { type: 'separator' },
    { label: 'Выход', click: () => { quitting = true; app.quit() } }
  ]))
}

function applySettings(patch) {
  const before = store.get().weather
  const s = store.set(patch)
  if (patch.autostart !== undefined) {
    app.setLoginItemSettings({ openAtLogin: s.autostart, args: ['--hidden'] })
  }
  if (patch.weather && (patch.weather.live !== before.live || patch.weather.lat !== before.lat)) {
    scheduleWeather()
  }
  send('settings', s)
  refreshTray()
  return s
}

async function updateWeather() {
  const { live, lat, lon } = store.get().weather
  if (!live || lat == null) {
    lastWeather = null
    send('weather', null)
    return
  }
  try {
    lastWeather = { ...(await weather.current(lat, lon)), city: store.get().weather.city }
    send('weather', lastWeather)
  } catch (err) {
    console.error('weather:', err.message)
  }
}

function scheduleWeather() {
  clearInterval(weatherTimer)
  updateWeather()
  weatherTimer = setInterval(updateWeather, 15 * 60 * 1000)
}

ipcMain.handle('settings:get', () => store.get())
ipcMain.handle('settings:set', (_e, patch) => applySettings(patch))
ipcMain.handle('weather:get', () => lastWeather)
ipcMain.handle('weather:city', async (_e, name) => {
  const found = await weather.findCity(name)
  if (!found) return null
  applySettings({ weather: { ...found, live: true } })
  return found
})
ipcMain.on('overlay:mouse', (_e, catchMouse) => {
  if (!overlay) return
  overlay.setIgnoreMouseEvents(!catchMouse, { forward: true })
})

app.whenReady().then(() => {
  store.load()
  createOverlay()
  createPanel()
  createTray()
  scheduleWeather()

  const rebuild = () => {
    if (overlay) overlay.destroy()
    createOverlay()
  }
  screen.on('display-metrics-changed', rebuild)
  screen.on('display-added', rebuild)
  screen.on('display-removed', rebuild)
})

app.on('before-quit', () => {
  quitting = true
  stopWatching()
})

app.on('window-all-closed', e => e.preventDefault())
