const { contextBridge, ipcRenderer } = require('electron')

function listen(channel) {
  return cb => {
    const handler = (_e, data) => cb(data)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  }
}

contextBridge.exposeInMainWorld('app', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: patch => ipcRenderer.invoke('settings:set', patch),
  getWeather: () => ipcRenderer.invoke('weather:get'),
  getMood: () => ipcRenderer.invoke('mood:get'),
  wallpaperSupported: () => ipcRenderer.invoke('wallpaper:supported'),
  applyWallpaper: (dataUrl, key) => ipcRenderer.invoke('wallpaper:apply', dataUrl, key),
  findCity: name => ipcRenderer.invoke('weather:city', name),
  quit: () => ipcRenderer.send('app:quit'),
  catchMouse: on => ipcRenderer.send('overlay:mouse', on),
  onSettings: listen('settings'),
  onWeather: listen('weather'),
  onWindows: listen('windows'),
  onDisplay: listen('display'),
  onMood: listen('mood')
})
