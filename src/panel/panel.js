const $ = s => document.querySelector(s)
const $$ = s => [...document.querySelectorAll(s)]

let S = null

const SEASONS = [
  { id: 'winter', icon: '❄', title: 'Зима', sub: 'Снег и сугробы', desc: 'Снег падает поверх рабочего стола и копится сугробами на окнах.' },
  { id: 'spring', icon: '✿', title: 'Весна', sub: 'Сакура и первые цветы', desc: 'Лепестки сакуры кружатся и ложатся на окна.' },
  { id: 'summer', icon: '☀', title: 'Лето', sub: 'Луг, пух и светлячки', desc: 'Тёплый вечер: летит пух одуванчиков, внизу мерцают светлячки.' },
  { id: 'autumn', icon: '❀', title: 'Осень', sub: 'Листопад и дожди', desc: 'Жёлтые листья и мелкий дождь по стеклу.' }
]

const STATIONS = [
  { name: 'Лоу-фай для работы', sub: 'Спокойные биты без слов — Vaporwaves', url: 'https://ice1.somafm.com/vaporwaves-128-mp3' },
  { name: 'Groove Salad', sub: 'Эмбиент и даунтемпо', url: 'https://ice1.somafm.com/groovesalad-128-mp3' },
  { name: 'Drone Zone', sub: 'Космический эмбиент без ритма', url: 'https://ice1.somafm.com/dronezone-128-mp3' },
  { name: 'Fluid', sub: 'Инструментальный хип-хоп', url: 'https://ice1.somafm.com/fluid-128-mp3' },
  { name: 'Lush', sub: 'Мягкий вокал и электроника', url: 'https://ice1.somafm.com/lush-128-mp3' },
  { name: 'Christmas Lounge', sub: 'Новогодний лаунж', url: 'https://ice1.somafm.com/christmas-128-mp3' },
  { name: 'Deep Space One', sub: 'Глубокий космос', url: 'https://ice1.somafm.com/deepspaceone-128-mp3' },
  { name: 'Secret Agent', sub: 'Музыка для шпионских миссий', url: 'https://ice1.somafm.com/secretagent-128-mp3' },
  { name: 'Folk Forward', sub: 'Инди-фолк', url: 'https://ice1.somafm.com/folkfwd-128-mp3' }
]

const MODES = [
  { id: 'walk', title: 'Гуляет' },
  { id: 'sit', title: 'Сидит' },
  { id: 'sleep', title: 'Спит' }
]

// --- общие хелперы -------------------------------------------------------

function getPath(obj, path) {
  return path.split('.').reduce((o, k) => o && o[k], obj)
}

function patchFor(path, value) {
  const keys = path.split('.')
  const out = {}
  let cur = out
  keys.forEach((k, i) => {
    if (i === keys.length - 1) cur[k] = value
    else cur = cur[k] = {}
  })
  return out
}

async function save(patch) {
  S = await window.app.setSettings(patch)
  render()
}

// --- навигация -----------------------------------------------------------

$$('[data-page]').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('[data-page]').forEach(b => b.classList.toggle('active', b === btn))
    $$('.page').forEach(p => p.classList.toggle('active', p.id === btn.dataset.page))
  })
})

// --- переключатели и ползунки ---------------------------------------------

$$('[data-toggle]').forEach(el => {
  el.addEventListener('click', () => {
    const path = el.dataset.toggle
    if (path === 'weather.live' && !S.weather.live && S.weather.lat == null) {
      $('[data-page="weather"]').click()
      $('#city').focus()
      return
    }
    save(patchFor(path, !getPath(S, path)))
  })
})

$$('[data-range]').forEach(el => {
  el.addEventListener('input', () => save(patchFor(el.dataset.range, +el.value)))
})

$('#pause').addEventListener('click', () => save({ paused: !S.paused }))

// --- сезоны --------------------------------------------------------------

const seasonsBox = $('#seasons')
for (const s of SEASONS) {
  const b = document.createElement('button')
  b.className = 'season'
  b.dataset.season = s.id
  b.innerHTML = `<span class="ico">${s.icon}</span><b>${s.title}</b><small>${s.sub}</small>`
  b.addEventListener('click', () => save({ season: s.id }))
  seasonsBox.append(b)
}

// --- погода --------------------------------------------------------------

$('#city-form').addEventListener('submit', async e => {
  e.preventDefault()
  const name = $('#city').value.trim()
  if (!name) return
  $('#city-status').textContent = 'Ищу…'
  try {
    const found = await window.app.findCity(name)
    $('#city-status').textContent = found ? `${found.city} (${found.lat.toFixed(2)}, ${found.lon.toFixed(2)})` : 'Такой город не нашёлся'
    if (found) {
      S = await window.app.getSettings()
      render()
    }
  } catch {
    $('#city-status').textContent = 'Нет интернета?'
  }
})

function renderWeather(w) {
  const sign = t => (t > 0 ? '+' : '') + t + '°'
  if (!w) {
    $('#w-temp').textContent = '—'
    $('#w-text').textContent = S && S.weather.live ? 'Загружаю…' : 'Живая погода выключена'
    $('#live-sub').textContent = S && S.weather.city ? S.weather.city : 'Укажи город в разделе «Погода»'
    return
  }
  $('#w-temp').textContent = sign(w.temp)
  $('#w-text').textContent = `${w.city}: ${w.text}`
  $('#w-more').textContent = `Ветер ${w.wind} км/ч · обновлено в ${new Date(w.at).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}`
  $('#live-sub').textContent = `Данные: ${sign(w.temp)}, ${w.text}, ветер ${w.wind} км/ч`
}

window.app.onWeather(renderWeather)

// --- радио ---------------------------------------------------------------

const audio = $('#audio')
let playing = false
let current = null
let sleepAt = 0
let sleepMin = 0
let sleepTimer = null

function play(station) {
  current = station
  audio.src = station.url
  audio.volume = S.radio.volume
  audio.play().catch(() => {
    $('#radio-now').textContent = 'Не получилось подключиться к станции'
  })
  playing = true
  renderRadio()
}

function stop() {
  audio.pause()
  audio.removeAttribute('src')
  audio.load()
  playing = false
  renderRadio()
}

function step(dir) {
  const idx = (S.radio.station + dir + STATIONS.length) % STATIONS.length
  save({ radio: { station: idx } })
  play(STATIONS[idx])
}

const stationsBox = $('#stations')
STATIONS.forEach((st, i) => {
  const b = document.createElement('button')
  b.className = 'station'
  b.innerHTML = `<b>${st.name}</b><small>${st.sub}</small>`
  b.addEventListener('click', () => {
    if (playing && current === st) return stop()
    save({ radio: { station: i } })
    play(st)
  })
  stationsBox.append(b)
})

$('#radio-play').addEventListener('click', () => (playing ? stop() : play(STATIONS[S.radio.station] || STATIONS[0])))
$('#radio-prev').addEventListener('click', () => step(-1))
$('#radio-next').addEventListener('click', () => step(1))
$('#volume').addEventListener('input', e => {
  audio.volume = +e.target.value
  save({ radio: { volume: +e.target.value } })
})
$('#custom-form').addEventListener('submit', e => {
  e.preventDefault()
  const url = $('#custom-url').value.trim()
  if (!/^https?:\/\//.test(url)) return
  save({ radio: { custom: url } })
  play({ name: 'Своя станция', sub: url, url })
})

const SLEEP = [0, 15, 30, 60, 90]
const sleepBox = $('#sleep')
SLEEP.forEach(min => {
  const b = document.createElement('button')
  b.className = 'chip'
  b.textContent = min ? (min < 60 ? `${min} мин` : `${min / 60} ч`.replace('1.5', '1,5')) : 'Нет'
  b.dataset.min = min
  b.addEventListener('click', () => {
    clearInterval(sleepTimer)
    sleepMin = min
    sleepAt = min ? Date.now() + min * 60000 : 0
    if (min) {
      sleepTimer = setInterval(() => {
        if (Date.now() >= sleepAt) {
          sleepAt = 0
          sleepMin = 0
          clearInterval(sleepTimer)
          stop()
        }
        renderRadio()
      }, 1000)
    }
    renderRadio()
  })
  sleepBox.append(b)
})

function renderRadio() {
  $('#radio-state').textContent = playing ? 'Играет' : 'Радио выключено'
  $('#radio-now').textContent = playing && current ? `${current.name} — ${current.sub}` : 'Выбери станцию — музыка будет играть без рекламы'
  $('#radio-play').textContent = playing ? 'Выключить' : 'Включить'
  $$('.station').forEach((b, i) => b.classList.toggle('active', playing && current === STATIONS[i]))

  const left = sleepAt ? Math.max(0, sleepAt - Date.now()) : 0
  $$('#sleep .chip').forEach(c => c.classList.toggle('active', +c.dataset.min === sleepMin))
  $('#sleep-left').textContent = left
    ? `Выключится через ${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')}`
    : 'Музыка выключится сама'
}

// --- питомец -------------------------------------------------------------

const modeBox = $('#pet-mode')
MODES.forEach(m => {
  const b = document.createElement('button')
  b.className = 'chip'
  b.dataset.mode = m.id
  b.textContent = m.title
  b.addEventListener('click', () => save({ pet: { mode: m.id, enabled: true } }))
  modeBox.append(b)
})

const kindsBox = $('#kinds')
for (const [id, k] of Object.entries(Pets.KINDS)) {
  const b = document.createElement('button')
  b.className = 'kind'
  b.dataset.kind = id
  b.textContent = k.title
  b.addEventListener('click', () => save({ pet: { kind: id, enabled: true } }))
  kindsBox.append(b)
}

$('#pet-random').addEventListener('click', () => {
  const ids = Object.keys(Pets.KINDS).filter(k => k !== S.pet.kind)
  save({ pet: { kind: ids[(Math.random() * ids.length) | 0], enabled: true } })
})

let nameTimer
$('#pet-name').addEventListener('input', e => {
  clearTimeout(nameTimer)
  nameTimer = setTimeout(() => save({ pet: { name: e.target.value.trim() } }), 300)
})

const petCanvas = $('#pet-preview')
const pctx = petCanvas.getContext('2d')

function drawPetPreview(t) {
  pctx.clearRect(0, 0, petCanvas.width, petCanvas.height)
  pctx.fillStyle = '#121933'
  pctx.fillRect(0, 150, petCanvas.width, 50)
  if (!S) return
  const frame = S.pet.mode === 'walk' ? (Math.floor(t * 3) % 2 ? 'walk1' : 'walk2') : S.pet.mode
  const img = Pets.petSprite(S.pet.kind, frame)
  pctx.imageSmoothingEnabled = false
  pctx.drawImage(img, petCanvas.width / 2 - img.width * 0.75, 150 - img.height * 1.5, img.width * 1.5, img.height * 1.5)
  if (S.pet.mode === 'sleep') {
    pctx.fillStyle = 'rgba(232, 238, 252, 0.8)'
    pctx.font = 'bold 16px Segoe UI'
    const k = (t * 0.8) % 1
    pctx.globalAlpha = 1 - k
    pctx.fillText('z', 215 + k * 10, 95 - k * 30)
    pctx.globalAlpha = 1
  }
}

// --- превью на главной ----------------------------------------------------

const prev = $('#preview')
const g = prev.getContext('2d')
const bits = []

function drawPreview(t, dt) {
  const r = prev.getBoundingClientRect()
  if (!r.width) return
  if (prev.width !== r.width * 2) {
    prev.width = r.width * 2
    prev.height = r.height * 2
  }
  const w = r.width
  const h = r.height
  g.setTransform(2, 0, 0, 2, 0, 0)
  g.clearRect(0, 0, w, h)

  // нарисованное окошко справа
  const wx = w - 300
  const wy = 70
  g.fillStyle = 'rgba(10, 14, 28, 0.85)'
  g.strokeStyle = 'rgba(255,255,255,0.08)'
  g.beginPath()
  g.roundRect(wx, wy, 250, h, 10)
  g.fill()
  g.stroke()
  g.fillStyle = 'rgba(255,255,255,0.25)'
  for (let i = 0; i < 3; i++) {
    g.beginPath()
    g.arc(wx + 16 + i * 12, wy + 14, 3, 0, Math.PI * 2)
    g.fill()
  }

  if (!S) return
  const season = S.season

  if (Math.random() < dt * (season === 'summer' ? 4 : 30) && bits.length < 160) {
    bits.push({ x: Math.random() * w, y: season === 'summer' ? Math.random() * h : -5, s: Math.random(), life: 0 })
  }

  let piled = 0
  for (let i = bits.length - 1; i >= 0; i--) {
    const b = bits[i]
    b.life += dt
    if (season === 'summer') {
      b.x += Math.sin(t + b.s * 9) * 10 * dt + 8 * dt
      b.y += Math.cos(t * 0.7 + b.s * 5) * 8 * dt
      const glow = (Math.sin(t * 2 + b.s * 20) + 1) / 2
      g.fillStyle = `rgba(255, 240, 140, ${glow * 0.9})`
      g.beginPath()
      g.arc(b.x, b.y, 1.6 + glow, 0, Math.PI * 2)
      g.fill()
      if (b.life > 8) bits.splice(i, 1)
      continue
    }

    b.x += Math.sin(t + b.s * 9) * 12 * dt
    b.y += (season === 'autumn' ? 50 : 25 + b.s * 20) * dt
    if (b.y > h + 5) { bits.splice(i, 1); continue }
    if (season === 'winter' && b.x > wx && b.x < wx + 250 && b.y > wy - 2 && b.y < wy + 2) piled++

    if (season === 'winter') {
      g.fillStyle = 'rgba(255,255,255,0.9)'
      g.beginPath()
      g.arc(b.x, b.y, 1 + b.s * 1.8, 0, Math.PI * 2)
      g.fill()
    } else if (season === 'spring') {
      g.fillStyle = '#ffc0d6'
      g.beginPath()
      g.ellipse(b.x, b.y, 3.5, 2.2, t + b.s * 6, 0, Math.PI * 2)
      g.fill()
    } else {
      g.fillStyle = ['#e2621b', '#f0a028', '#c8381e'][(b.s * 3) | 0]
      g.beginPath()
      g.ellipse(b.x, b.y, 4.5, 2.4, t * 2 + b.s * 6, 0, Math.PI * 2)
      g.fill()
    }
  }

  if (season === 'winter') {
    g.fillStyle = '#f4f8ff'
    g.beginPath()
    g.moveTo(wx + 2, wy + 1)
    for (let x = 0; x <= 246; x += 6) {
      const edge = Math.min(x, 246 - x)
      const hgt = Math.min(9, edge * 0.3) * (0.8 + 0.2 * Math.sin(x * 0.13))
      g.lineTo(wx + 2 + x, wy - hgt)
    }
    g.lineTo(wx + 248, wy + 1)
    g.fill()
  }
}

let lastT = performance.now()
function tick(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000)
  lastT = now
  if ($('#home').classList.contains('active')) drawPreview(now / 1000, dt)
  if ($('#pet').classList.contains('active')) drawPetPreview(now / 1000)
  requestAnimationFrame(tick)
}

// --- отрисовка состояния ---------------------------------------------------

function render() {
  const season = SEASONS.find(s => s.id === S.season) || SEASONS[0]
  $('#season-title').textContent = season.title
  $('#season-desc').textContent = season.desc
  $$('.season').forEach(b => b.classList.toggle('active', b.dataset.season === S.season))

  $$('[data-toggle]').forEach(el => {
    const on = !!getPath(S, el.dataset.toggle)
    el.classList.toggle('on', on)
    const badge = el.querySelector('.badge')
    if (badge) badge.textContent = on ? 'Вкл' : 'Выкл'
  })
  $$('[data-range]').forEach(el => {
    if (document.activeElement !== el) el.value = getPath(S, el.dataset.range)
  })

  $('#pause').textContent = S.paused ? 'Продолжить' : 'Пауза'
  $('#pause').classList.toggle('on', S.paused)

  if (S.weather.city && document.activeElement !== $('#city')) {
    $('#city').value = S.weather.city
    $('#city-status').textContent = S.weather.city
  }

  const kind = Pets.KINDS[S.pet.kind]
  $('#pet-sub').textContent = `${S.pet.name || kind.title} · ${MODES.find(m => m.id === S.pet.mode).title.toLowerCase()}`
  $$('#pet-mode .chip').forEach(b => b.classList.toggle('active', b.dataset.mode === S.pet.mode))
  $$('.kind').forEach(b => b.classList.toggle('active', b.dataset.kind === S.pet.kind))
  if (document.activeElement !== $('#pet-name')) $('#pet-name').value = S.pet.name

  if (document.activeElement !== $('#volume')) $('#volume').value = S.radio.volume
  if (!$('#custom-url').value) $('#custom-url').value = S.radio.custom
}

window.app.onSettings(s => {
  S = s
  render()
})

Promise.all([window.app.getSettings(), window.app.getWeather()]).then(([s, w]) => {
  S = s
  render()
  renderWeather(w)
  renderRadio()
  requestAnimationFrame(tick)
})
