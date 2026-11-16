const fs = require('fs')
const path = require('path')
const { app } = require('electron')

const defaults = {
  season: 'winter',
  paused: false,
  autostart: false,
  keepInTray: false,
  effects: {
    weather: true,
    drifts: true,
    density: 0.5,
    size: 1,
    wind: 0,
    speed: 1
  },
  weather: {
    live: false,
    city: '',
    lat: null,
    lon: null
  },
  pet: {
    enabled: true,
    kind: 'fox',
    mode: 'walk',
    name: 'Рыжик'
  },
  radio: {
    station: 0,
    volume: 0.6,
    custom: '',
    vibe: false
  },
  mood: {
    theme: true,
    glow: 0.35,
    wallpaper: false
  },
  ambient: {
    enabled: false,
    auto: true,
    volume: 0.5,
    layers: { rain: 0, wind: 0, fire: 0, crickets: 0 }
  },
  // обои, которые стояли до нас — чтобы вернуть при выключении
  wallpaperOriginal: null
}

let file
let data
let saveTimer

function merge(base, extra) {
  const out = { ...base }
  for (const key of Object.keys(extra || {})) {
    const val = extra[key]
    if (val && typeof val === 'object' && !Array.isArray(val) && base[key] && typeof base[key] === 'object') {
      out[key] = merge(base[key], val)
    } else {
      out[key] = val
    }
  }
  return out
}

function load() {
  file = path.join(app.getPath('userData'), 'settings.json')
  try {
    data = merge(defaults, JSON.parse(fs.readFileSync(file, 'utf8')))
  } catch {
    data = merge(defaults, {})
  }
  return data
}

function get() {
  return data
}

function set(patch) {
  data = merge(data, patch)
  clearTimeout(saveTimer)
  saveTimer = setTimeout(flush, 400)
  return data
}

function flush() {
  clearTimeout(saveTimer)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(data, null, 2))
}

module.exports = { load, get, set, flush }
