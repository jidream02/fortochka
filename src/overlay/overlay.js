const canvas = document.getElementById('c')
const ctx = canvas.getContext('2d')
const { Surface, visibleSegments } = Drifts
const { SEASONS, RATE, spawn, drawParticle, rand } = Particles

let W = window.innerWidth
let H = window.innerHeight
let floorY = H - 48
let settings = null
let weather = null
let windows = []

const flakes = []
const fx = []
const surfaces = new Map()
const pet = new Pet()
let spawnAcc = 0
let gust = 0
let mouseCaught = false
let lastMouse = null

function resize() {
  const dpr = window.devicePixelRatio || 1
  W = window.innerWidth
  H = window.innerHeight
  canvas.width = W * dpr
  canvas.height = H * dpr
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  rebuildSurfaces()
}

function rebuildSurfaces() {
  const seen = new Set(['floor'])

  const floor = surfaces.get('floor')
  if (!floor || !floor.sameRect(0, W, floorY)) {
    surfaces.set('floor', new Surface('floor', 0, W, floorY, 16))
  }

  windows.forEach((win, i) => {
    if (win.y < 4 || win.y > floorY - 20) return
    const x1 = Math.max(0, win.x)
    const x2 = Math.min(W, win.x + win.w)
    if (x2 - x1 < 40) return
    seen.add(win.id)

    let s = surfaces.get(win.id)
    if (s && !s.sameRect(x1, x2, win.y)) {
      shed(s)
      s = null
    }
    if (!s) {
      s = new Surface(win.id, x1, x2, win.y)
      surfaces.set(win.id, s)
    }
    s.segs = visibleSegments({ x: x1, y: win.y, w: x2 - x1 }, windows.slice(0, i))
  })

  for (const [id, s] of surfaces) {
    if (!seen.has(id)) {
      shed(s)
      surfaces.delete(id)
    }
  }
}

// окно сдвинули — снег с него осыпается
function shed(s) {
  let budget = 220
  for (let i = 0; i < s.cols.length && budget > 0; i += 2) {
    const h = s.cols[i]
    if (h < 1) continue
    const x = s.x1 + i * Drifts.COL
    if (!s.visibleAt(x)) continue
    const n = Math.min(4, Math.ceil(h / 5))
    for (let k = 0; k < n; k++) {
      const p = spawn('snow', W)
      p.x = x + rand(-2, 2)
      p.y = s.y - rand(0, h)
      p.vy = rand(40, 120)
      p.vx = rand(-20, 20)
      flakes.push(p)
      budget--
    }
  }
  for (const it of s.items) {
    it.landed = null
    it.vy = 30
    flakes.push(it)
  }
}

function groundAt(x) {
  const f = surfaces.get('floor')
  return f ? f.top(x) + 3 : floorY
}

function wind() {
  if (settings.weather.live && weather) {
    return weather.windSide * Math.min(1, weather.wind / 35)
  }
  return settings.effects.wind
}

function activeKinds() {
  const season = SEASONS[settings.season] || SEASONS.winter
  let kinds = season.fall
  if (settings.weather.live && weather) {
    if (weather.precip === 'snow') kinds = ['snow']
    else if (weather.precip === 'rain') kinds = settings.season === 'autumn' ? ['leaf', 'rain', 'rain', 'rain'] : ['rain']
  }
  return kinds
}

function canPile() {
  if (!settings.effects.drifts) return false
  if (settings.weather.live && weather && weather.temp > 3) return false
  return activeKinds().includes('snow')
}

function landOn(p, prevY) {
  for (const s of surfaces.values()) {
    if (p.front && s.id !== 'floor') continue
    if (p.x < s.x1 || p.x >= s.x2) continue
    const top = s.top(p.x)
    if (prevY > top || p.y < top) continue
    if (!s.visibleAt(p.x)) continue
    return { s, top }
  }
  return null
}

// лишний снег у края соскальзывает вниз, посередине — просто уплотняется
function slideOff(p, s) {
  for (const [a, b] of s.segs) {
    if (p.x < a || p.x >= b) continue
    if (p.x - a < 30) { p.x = a - 2; p.vy *= 0.5; return }
    if (b - p.x < 30) { p.x = b + 2; p.vy *= 0.5; return }
  }
  p.dead = true
}

function update(dt, t) {
  const eff = settings.effects
  const w = wind()
  gust += (rand(-1, 1) * 0.6 - gust * 0.5) * dt
  const windVx = (w + gust * 0.3) * 90

  if (eff.weather && !settings.paused) {
    const kinds = activeKinds()
    const rate = kinds.reduce((sum, k) => sum + RATE[k], 0) / kinds.length
    const perSec = (20 + eff.density * 140) * rate * (W / 1920)
    spawnAcc += perSec * dt
    while (spawnAcc > 1) {
      spawnAcc--
      if (flakes.length >= 900) continue
      // виды выбираются пропорционально их частоте
      let r = Math.random() * rate * kinds.length
      let kind = kinds[0]
      for (const k of kinds) { r -= RATE[k]; if (r <= 0) { kind = k; break } }
      flakes.push(spawn(kind, W, { size: eff.size, speed: eff.speed, H, floor: floorY }))
    }

    const ambient = SEASONS[settings.season]?.ambient
    const want = ambient ? Math.round(10 + eff.density * 30) : 0
    let have = flakes.filter(p => p.kind === 'firefly').length
    while (have < want) { flakes.push(spawn('firefly', W, { H, floor: floorY, size: eff.size })); have++ }
  }

  const pile = canPile()

  for (let i = flakes.length - 1; i >= 0; i--) {
    const p = flakes[i]
    p.life += dt

    if (p.landed) {
      p.fade = Math.max(0, 1 - Math.max(0, p.life - p.landedAt - 18) / 4)
      if (p.fade <= 0) {
        p.landed.items.splice(p.landed.items.indexOf(p), 1)
        flakes.splice(i, 1)
      }
      continue
    }

    const prevY = p.y
    switch (p.kind) {
      case 'firefly':
        p.vx += rand(-40, 40) * dt
        p.vy += rand(-40, 40) * dt
        p.vx *= 0.98
        p.vy *= 0.98
        p.x += p.vx * dt
        p.y += p.vy * dt
        if (p.y > floorY - 4) p.vy = -Math.abs(p.vy)
        if (p.y < H * 0.35) p.vy = Math.abs(p.vy)
        if (!SEASONS[settings.season]?.ambient || !eff.weather) p.dead = true
        break
      case 'fluff':
        p.x += (p.vx + windVx * 0.5) * dt
        p.y += (p.vy + Math.sin(t * 1.3 + p.seed) * p.sway) * dt
        p.rot += dt * 0.4
        if (p.life > 30) p.dead = true
        break
      case 'rain':
        p.vx = windVx * 2
        p.x += p.vx * dt
        p.y += p.vy * dt
        break
      default:
        p.x += (windVx * (p.kind === 'snow' ? 1 : 1.4) + Math.sin(t * 1.5 + p.seed) * (p.sway || 0)) * dt
        p.y += p.vy * dt
        if (p.rot !== undefined) p.rot += p.spin * dt
    }

    if (p.kind === 'snow' || p.kind === 'petal' || p.kind === 'leaf' || p.kind === 'rain') {
      const hit = landOn(p, prevY)
      if (hit) {
        if (p.kind === 'snow') {
          if (!pile || !hit.s.add(p.x, p.r * 0.9)) p.dead = true
          else slideOff(p, hit.s)
        } else if (p.kind === 'rain') {
          for (let k = 0; k < 2; k++) {
            fx.push(spawn('splash', 0, { x: p.x, y: hit.top - 1, vx: rand(-40, 40), vy: rand(-90, -40) }))
          }
          p.dead = true
        } else if (hit.s.items.length < 60) {
          p.y = hit.top - 1
          p.landed = hit.s
          p.landedAt = p.life
          hit.s.items.push(p)
        } else {
          p.dead = true
        }
      }
    }

    if (p.dead || p.y > H + 30 || p.x < -80 || p.x > W + 80) {
      flakes.splice(i, 1)
    }
  }

  for (let i = fx.length - 1; i >= 0; i--) {
    const p = fx[i]
    p.life += dt
    p.x += p.vx * dt
    p.y += p.vy * dt
    if (p.kind === 'splash') p.vy += 500 * dt
    const ttl = p.kind === 'zzz' ? 2.5 : p.kind === 'heart' ? 1.4 : 0.35
    if (p.life > ttl) fx.splice(i, 1)
  }

  // таяние: не зима — сугробы постепенно уходят
  const meltRate = pile ? 0 : settings.paused ? 50 : 0.8
  if (meltRate) for (const s of surfaces.values()) s.melt(meltRate * dt)

  if (settings.pet.enabled && !settings.paused) pet.update(dt, W, groundAt, fx)
}

function draw(t) {
  ctx.clearRect(0, 0, W, H)
  if (!settings) return

  for (const s of surfaces.values()) s.draw(ctx)
  for (const p of flakes) drawParticle(ctx, p, t)
  if (settings.pet.enabled && !settings.paused) pet.draw(ctx)
  for (const p of fx) drawParticle(ctx, p, t)
}

let last = performance.now()
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000)
  last = now
  if (settings) {
    update(dt, now / 1000)
    draw(now / 1000)
  }
  requestAnimationFrame(loop)
}

// мышь: окно пропускает клики насквозь, пока курсор не над питомцем
window.addEventListener('mousemove', e => {
  if (!settings || !settings.pet.enabled || settings.paused) return
  const over = pet.contains(e.clientX, e.clientY)
  if (over !== mouseCaught) {
    mouseCaught = over
    pet.hover = over
    window.app.catchMouse(over)
  }
  if (over && lastMouse) {
    const d = Math.hypot(e.clientX - lastMouse.x, e.clientY - lastMouse.y)
    pet.strokeDist = (pet.strokeDist || 0) + d
    if (pet.strokeDist > 45) {
      pet.strokeDist = 0
      pet.stroke(fx)
    }
  }
  lastMouse = { x: e.clientX, y: e.clientY }
})

window.addEventListener('mouseleave', () => {
  if (mouseCaught) {
    mouseCaught = false
    pet.hover = false
    window.app.catchMouse(false)
  }
})

window.addEventListener('mousedown', () => {
  if (mouseCaught) {
    pet.hop()
    pet.stroke(fx)
  }
})

window.addEventListener('resize', resize)

function applySettings(s) {
  settings = s
  pet.configure(s.pet)
  if (s.paused) {
    flakes.length = 0
    for (const surf of surfaces.values()) surf.items.length = 0
  }
  if (!s.effects.weather) {
    for (let i = flakes.length - 1; i >= 0; i--) if (!flakes[i].landed) flakes.splice(i, 1)
  }
}

window.app.onSettings(applySettings)
window.app.onWeather(w => { weather = w })
window.app.onWindows(list => {
  windows = list
  rebuildSurfaces()
})
window.app.onDisplay(d => {
  floorY = d.floor
  resize()
})

window.app.getSettings().then(s => {
  applySettings(s)
  pet.x = rand(100, W - 200)
  pet.y = floorY - pet.h
  resize()
  requestAnimationFrame(loop)
})
window.app.getWeather().then(w => { weather = w })
