// Настроение = сезон + погода + время суток. Из него получаются цвета панели,
// подсветка экрана, обои и звуки. Палитры специально приглушённые — чтобы не резало глаза.

const TIMES = {
  night: { sky: ['#0f1630', '#2a2f55'], hills: ['#2a3054', '#222744', '#1a1e37', '#13172b'], light: '#e9e6d6', label: 'ночь' },
  dawn:  { sky: ['#3a4170', '#d9a593'], hills: ['#7d6a8c', '#5f5175', '#463c5d', '#312a46'], light: '#ffd9b0', label: 'утро' },
  day:   { sky: ['#6f9cc9', '#cddfea'], hills: ['#93b3a9', '#749a8b', '#5a7f71', '#436456'], light: '#fff4dc', label: 'день' },
  dusk:  { sky: ['#2f3566', '#d6957c'], hills: ['#6b5a7e', '#504569', '#3b3453', '#2a253e'], light: '#ffc995', label: 'вечер' }
}

const SEASON_TINT = {
  winter: { hills: '#c9d5e3', amount: 0.55, accent: '#8fb6e3' },
  spring: { hills: '#a9c49d', amount: 0.3, accent: '#e2a6bf' },
  summer: { hills: '#7fae76', amount: 0.3, accent: '#9fcb8c' },
  autumn: { hills: '#b9824f', amount: 0.42, accent: '#e0a56c' }
}

const SKY_LABEL = {
  clear: 'ясно', cloudy: 'облачно', fog: 'туман', rain: 'дождь', snow: 'снег', storm: 'гроза'
}

const SEASON_LABEL = { winter: 'зима', spring: 'весна', summer: 'лето', autumn: 'осень' }

function hex(c) {
  const n = parseInt(c.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function toHex([r, g, b]) {
  return '#' + [r, g, b].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')
}

function mix(a, b, t) {
  const x = hex(a)
  const y = hex(b)
  return toHex(x.map((v, i) => v + (y[i] - v) * t))
}

function timeOfDay(date = new Date()) {
  const h = date.getHours() + date.getMinutes() / 60
  if (h >= 5 && h < 8) return 'dawn'
  if (h >= 8 && h < 17.5) return 'day'
  if (h >= 17.5 && h < 21) return 'dusk'
  return 'night'
}

function skyFor(season, weather) {
  if (weather && weather.sky) return weather.sky
  if (season === 'winter') return 'snow'
  if (season === 'autumn') return 'rain'
  return 'clear'
}

function compute(settings, weather, now = new Date()) {
  const season = settings.season
  const time = timeOfDay(now)
  const sky = skyFor(season, settings.weather.live ? weather : null)
  const base = TIMES[time]
  const tint = SEASON_TINT[season]

  // пасмурно — краски уходят в серый
  const grey = time === 'night' ? '#30343f' : time === 'day' ? '#8a929c' : '#6c6670'
  const dull = { clear: 0, cloudy: 0.35, fog: 0.55, rain: 0.5, snow: 0.3, storm: 0.65 }[sky]

  const skyTop = mix(base.sky[0], grey, dull)
  let skyBottom = mix(base.sky[1], grey, dull)
  if (sky === 'snow') skyBottom = mix(skyBottom, '#c8d2df', time === 'night' ? 0.15 : 0.35)

  const nightDim = time === 'night' ? 0.35 : 1
  const hills = base.hills.map(c => mix(mix(c, tint.hills, tint.amount * nightDim), grey, dull * 0.5))

  const accent = mix(tint.accent, grey, dull * 0.3)

  // тёмная тема всегда, но с оттенком неба
  const bg = mix(skyTop, '#0b0f1c', 0.72)
  const palette = {
    bg,
    bg2: mix(skyTop, '#0b0f1c', 0.62),
    card: mix(skyTop, '#141a2e', 0.6),
    card2: mix(skyTop, '#1b2240', 0.45),
    line: mix(skyTop, '#2a3352', 0.55),
    accent,
    accent2: mix(accent, '#ffffff', 0.3),
    glow: mix(accent, skyBottom, 0.5)
  }

  return {
    key: `${season}-${time}-${sky}`,
    season,
    time,
    sky,
    title: `${SEASON_LABEL[season]}, ${base.label}, ${SKY_LABEL[sky]}`,
    skyTop,
    skyBottom,
    hills,
    light: base.light,
    palette
  }
}

module.exports = { compute, timeOfDay }
