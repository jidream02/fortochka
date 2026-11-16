// Рисует обои под настроение: небо, солнце/луна, облака, холмы, деревья и домик.
// Случайность с зерном от даты — в течение дня картинка одна и та же, меняются только краски.

;(() => {
  function rng(seed) {
    return () => {
      seed |= 0
      seed = (seed + 0x6d2b79f5) | 0
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }

  function rgba(hex, a) {
    const n = parseInt(hex.slice(1), 16)
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
  }

  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16)
    const f = v => Math.round(Math.max(0, Math.min(255, v * k)))
    return `rgb(${f((n >> 16) & 255)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`
  }

  function ridge(rand, W, base, amp) {
    const p = [rand() * 10, rand() * 10, rand() * 10]
    const f = [1.3 + rand(), 3 + rand() * 2, 7 + rand() * 4]
    return x => {
      const u = x / W
      return base - amp * (Math.sin(u * f[0] + p[0]) * 0.6 + Math.sin(u * f[1] + p[1]) * 0.3 + Math.sin(u * f[2] + p[2]) * 0.1)
    }
  }

  function paint(canvas, mood, seed) {
    const W = canvas.width
    const H = canvas.height
    const g = canvas.getContext('2d')
    const rand = rng(seed)
    const s = W / 1920
    const night = mood.time === 'night'
    const dim = { clear: 1, cloudy: 0.55, fog: 0.35, rain: 0.3, snow: 0.45, storm: 0.2 }[mood.sky]

    // небо
    const sky = g.createLinearGradient(0, 0, 0, H * 0.75)
    sky.addColorStop(0, mood.skyTop)
    sky.addColorStop(1, mood.skyBottom)
    g.fillStyle = sky
    g.fillRect(0, 0, W, H)

    // звёзды
    if (night && dim > 0.4) {
      for (let i = 0; i < 260; i++) {
        const x = rand() * W
        const y = rand() * H * 0.6
        g.fillStyle = `rgba(255, 250, 235, ${(0.15 + rand() * 0.5) * dim})`
        g.beginPath()
        g.arc(x, y, (0.5 + rand() * 1.2) * s, 0, Math.PI * 2)
        g.fill()
      }
    }

    // солнце или луна
    const pos = {
      dawn: [0.2, 0.55], day: [0.68, 0.2], dusk: [0.8, 0.52], night: [0.76, 0.2]
    }[mood.time]
    const lx = pos[0] * W
    const ly = pos[1] * H
    const lr = (night ? 46 : 60) * s
    const halo = g.createRadialGradient(lx, ly, lr * 0.5, lx, ly, lr * 6)
    halo.addColorStop(0, rgba(mood.light, 0.35 * dim))
    halo.addColorStop(1, rgba(mood.light, 0))
    g.fillStyle = halo
    g.fillRect(0, 0, W, H)
    // диск рисуем на отдельном холсте: у луны вырезаем серп, чтобы сквозь него было видно небо
    const disc = document.createElement('canvas')
    disc.width = disc.height = Math.ceil(lr * 2 + 4)
    const d = disc.getContext('2d')
    const c = disc.width / 2
    d.fillStyle = rgba(mood.light, 0.25 + 0.7 * dim)
    d.beginPath()
    d.arc(c, c, lr, 0, Math.PI * 2)
    d.fill()
    if (night) {
      d.globalCompositeOperation = 'destination-out'
      d.beginPath()
      d.arc(c + lr * 0.45, c - lr * 0.2, lr * 0.9, 0, Math.PI * 2)
      d.fill()
    }
    g.drawImage(disc, lx - c, ly - c)

    // облака
    const clouds = { clear: 3, cloudy: 9, fog: 6, rain: 12, snow: 10, storm: 14 }[mood.sky]
    const cloudCol = night ? '#6e7590' : '#f4f1ec'
    for (let i = 0; i < clouds; i++) {
      const cx = rand() * W
      const cy = (0.08 + rand() * 0.35) * H
      const cw = (160 + rand() * 260) * s
      g.fillStyle = rgba(cloudCol, (0.08 + rand() * 0.12) * (mood.sky === 'clear' ? 0.7 : 1.3))
      for (let k = 0; k < 7; k++) {
        g.beginPath()
        g.ellipse(cx + (rand() - 0.5) * cw, cy + (rand() - 0.5) * cw * 0.15, cw * (0.25 + rand() * 0.25), cw * (0.1 + rand() * 0.08), 0, 0, Math.PI * 2)
        g.fill()
      }
    }

    // холмы: дальние светлее (воздушная перспектива), ближние темнее
    const layers = mood.hills.map((col, i) => ({
      col,
      y: ridge(rand, W, H * (0.58 + i * 0.1), H * (0.07 - i * 0.008))
    }))

    let house = null
    layers.forEach((layer, i) => {
      g.fillStyle = layer.col
      g.beginPath()
      g.moveTo(0, H)
      for (let x = 0; x <= W; x += 8 * s) g.lineTo(x, layer.y(x))
      g.lineTo(W, H)
      g.closePath()
      g.fill()

      // зимой — снежная кромка по гребню
      if (mood.season === 'winter') {
        g.strokeStyle = rgba('#f2f6fb', night ? 0.18 : 0.45)
        g.lineWidth = 3 * s
        g.beginPath()
        for (let x = 0; x <= W; x += 8 * s) g.lineTo(x, layer.y(x) + 1.5 * s)
        g.stroke()
      }

      // деревья на двух ближних слоях
      if (i >= 2) {
        const count = i === 2 ? 26 : 14
        for (let k = 0; k < count; k++) {
          const x = rand() * W
          const y = layer.y(x) + 4 * s
          const h = (i === 2 ? 40 : 70) * s * (0.7 + rand() * 0.6)
          tree(g, x, y, h, mood, shade(layer.col, 0.82), rand)
        }
      }

      // домик на третьем слое
      if (i === 2) {
        const hx = W * (0.25 + rand() * 0.15)
        house = { x: hx, y: layer.y(hx), col: shade(layer.col, 0.7) }
      }
    })

    if (house) drawHouse(g, house, mood, s)

    // туман у подножия
    if (mood.sky === 'fog' || mood.sky === 'rain' || mood.sky === 'snow') {
      const fog = g.createLinearGradient(0, H * 0.5, 0, H)
      const a = mood.sky === 'fog' ? 0.35 : 0.15
      fog.addColorStop(0, rgba(mood.skyBottom, 0))
      fog.addColorStop(0.5, rgba(mood.skyBottom, a))
      fog.addColorStop(1, rgba(mood.skyBottom, a * 0.5))
      g.fillStyle = fog
      g.fillRect(0, 0, W, H)
    }

    // лёгкое затемнение по краям — меньше бликов от иконок
    const vig = g.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, W * 0.75)
    vig.addColorStop(0, 'rgba(0,0,0,0)')
    vig.addColorStop(1, 'rgba(0,0,0,0.28)')
    g.fillStyle = vig
    g.fillRect(0, 0, W, H)
  }

  function tree(g, x, y, h, mood, col, rand) {
    g.fillStyle = col
    if (mood.season === 'winter' || (mood.season === 'autumn' && rand() < 0.5)) {
      // ёлка
      g.beginPath()
      g.moveTo(x, y - h)
      g.lineTo(x + h * 0.32, y)
      g.lineTo(x - h * 0.32, y)
      g.closePath()
      g.fill()
      if (mood.season === 'winter') {
        g.fillStyle = 'rgba(242, 246, 251, 0.35)'
        g.beginPath()
        g.moveTo(x, y - h)
        g.lineTo(x + h * 0.12, y - h * 0.62)
        g.lineTo(x - h * 0.12, y - h * 0.62)
        g.closePath()
        g.fill()
      }
      return
    }
    // лиственное дерево
    g.fillRect(x - h * 0.04, y - h * 0.4, h * 0.08, h * 0.4)
    const leaf = {
      spring: ['rgba(232, 176, 198, 0.55)', 'rgba(170, 200, 150, 0.4)'],
      summer: ['rgba(110, 150, 100, 0.45)', 'rgba(90, 130, 85, 0.45)'],
      autumn: ['rgba(214, 140, 80, 0.5)', 'rgba(190, 110, 70, 0.45)']
    }[mood.season] || ['rgba(0,0,0,0.2)']
    g.fillStyle = col
    g.beginPath()
    g.arc(x, y - h * 0.6, h * 0.32, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = leaf[(rand() * leaf.length) | 0]
    g.beginPath()
    g.arc(x, y - h * 0.6, h * 0.32, 0, Math.PI * 2)
    g.fill()
  }

  function drawHouse(g, house, mood, s) {
    const w = 46 * s
    const h = 30 * s
    const x = house.x - w / 2
    const y = house.y - h + 6 * s
    g.fillStyle = house.col
    g.fillRect(x, y, w, h)
    g.beginPath()
    g.moveTo(x - 6 * s, y)
    g.lineTo(house.x, y - 22 * s)
    g.lineTo(x + w + 6 * s, y)
    g.closePath()
    g.fill()
    g.fillRect(x + w * 0.68, y - 20 * s, 7 * s, 14 * s)

    if (mood.season === 'winter') {
      g.fillStyle = 'rgba(242, 246, 251, 0.6)'
      g.beginPath()
      g.moveTo(x - 6 * s, y)
      g.lineTo(house.x, y - 22 * s)
      g.lineTo(x + w + 6 * s, y)
      g.lineTo(house.x, y - 16 * s)
      g.closePath()
      g.fill()
    }

    // тёплое окошко — когда темно или непогода
    const lit = mood.time !== 'day' || mood.sky !== 'clear'
    const wx = x + w * 0.3
    const wy = y + h * 0.3
    if (lit) {
      const glow = g.createRadialGradient(wx + 6 * s, wy + 6 * s, 0, wx + 6 * s, wy + 6 * s, 50 * s)
      glow.addColorStop(0, 'rgba(255, 200, 120, 0.35)')
      glow.addColorStop(1, 'rgba(255, 200, 120, 0)')
      g.fillStyle = glow
      g.fillRect(wx - 50 * s, wy - 50 * s, 112 * s, 112 * s)
    }
    g.fillStyle = lit ? '#ffcf86' : 'rgba(30, 40, 60, 0.5)'
    g.fillRect(wx, wy, 12 * s, 12 * s)

    // дымок из трубы зимой и осенью
    if (mood.season === 'winter' || mood.season === 'autumn') {
      g.strokeStyle = 'rgba(220, 225, 235, 0.18)'
      g.lineWidth = 5 * s
      g.lineCap = 'round'
      g.beginPath()
      const cx = x + w * 0.68 + 3.5 * s
      let cy = y - 22 * s
      g.moveTo(cx, cy)
      for (let k = 1; k < 8; k++) {
        cy -= 9 * s
        g.lineTo(cx + Math.sin(k * 0.9) * 6 * s + k * 2 * s, cy)
      }
      g.stroke()
    }
  }

  window.Wallpaper = { paint }
})()
