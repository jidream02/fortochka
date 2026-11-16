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
    custom: ''
  }
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
  saveTimer = setTimeout(() => {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify(data, null, 2))
  }, 400)
  return data
}

module.exports = { load, get, set }
