// Всё, что летает: снег, лепестки, листья, дождь, пух, светлячки, сердечки

;(() => {
  const rand = (a, b) => a + Math.random() * (b - a)
  const pick = arr => arr[(Math.random() * arr.length) | 0]

  const LEAF_COLORS = ['#e2621b', '#f0a028', '#c8381e', '#d9b23a', '#a8501c']
  const PETAL_COLORS = ['#ffc6d9', '#ffb3cc', '#ffd9e6', '#f9a8c4']

  const SEASONS = {
    winter: { fall: ['snow'], ambient: null },
    spring: { fall: ['petal'], ambient: null },
    summer: { fall: ['fluff'], ambient: 'firefly' },
    autumn: { fall: ['leaf', 'leaf', 'rain', 'rain', 'rain'], ambient: null }
  }

  function spawn(kind, W, opts = {}) {
    const size = opts.size || 1
    const speed = opts.speed || 1
    const p = { kind, x: rand(-40, W + 40), y: rand(-60, -5), vx: 0, vy: 0, life: 0, seed: Math.random() * 1000 }

    switch (kind) {
      case 'snow':
        p.r = rand(1, 3.4) * size
        p.vy = rand(28, 60) * speed * (0.6 + p.r / 4)
        p.sway = rand(10, 30)
        p.alpha = rand(0.7, 1)
        // часть снежинок летит «перед» окнами и ложится только на панель задач
        p.front = Math.random() < 0.4
        break
      case 'petal':
        p.r = rand(3, 5.5) * size
        p.vy = rand(24, 45) * speed
        p.sway = rand(30, 70)
        p.rot = rand(0, Math.PI * 2)
        p.spin = rand(-2, 2)
        p.color = pick(PETAL_COLORS)
        break
      case 'leaf':
        p.r = rand(5, 8.5) * size
        p.vy = rand(35, 65) * speed
        p.sway = rand(40, 90)
        p.rot = rand(0, Math.PI * 2)
        p.spin = rand(-3, 3)
        p.color = pick(LEAF_COLORS)
        break
      case 'rain':
        p.len = rand(10, 18) * size
        p.vy = rand(650, 900) * speed
        p.alpha = rand(0.25, 0.5)
        break
      case 'fluff':
        p.r = rand(2.5, 4) * size
        p.y = rand(-40, opts.H || 800)
        p.x = rand(0, W)
        p.vx = rand(15, 35) * speed
        p.vy = rand(-6, 10) * speed
        p.sway = rand(10, 25)
        p.rot = rand(0, Math.PI * 2)
        break
      case 'firefly':
        p.x = rand(0, W)
        p.y = rand((opts.H || 800) * 0.45, opts.floor || 800)
        p.vx = rand(-15, 15)
        p.vy = rand(-10, 10)
        p.blink = rand(0, Math.PI * 2)
        p.r = rand(1.6, 2.6) * size
        break
      case 'splash':
      case 'heart':
      case 'zzz':
        Object.assign(p, opts)
        break
    }
    return p
  }

  function drawParticle(ctx, p, t) {
    switch (p.kind) {
      case 'snow': {
        ctx.globalAlpha = p.alpha
        ctx.fillStyle = '#ffffff'
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fill()
        break
      }
      case 'petal': {
        ctx.globalAlpha = p.fade ?? 0.95
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.scale(1, Math.abs(Math.cos(p.rot * 0.7)) * 0.6 + 0.4)
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.ellipse(0, 0, p.r, p.r * 0.62, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
        break
      }
      case 'leaf': {
        ctx.globalAlpha = p.fade ?? 1
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.scale(1, Math.abs(Math.cos(p.rot * 0.5)) * 0.5 + 0.5)
        const r = p.r
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.moveTo(-r, 0)
        ctx.quadraticCurveTo(0, -r * 0.8, r, 0)
        ctx.quadraticCurveTo(0, r * 0.8, -r, 0)
        ctx.fill()
        ctx.strokeStyle = 'rgba(80, 30, 10, 0.5)'
        ctx.lineWidth = 0.8
        ctx.beginPath()
        ctx.moveTo(-r * 1.25, 0)
        ctx.lineTo(r * 0.8, 0)
        ctx.stroke()
        ctx.restore()
        break
      }
      case 'rain': {
        ctx.globalAlpha = p.alpha
        ctx.strokeStyle = '#b9d4f0'
        ctx.lineWidth = 1.2
        ctx.beginPath()
        ctx.moveTo(p.x, p.y)
        ctx.lineTo(p.x - p.vx * 0.02, p.y - p.len)
        ctx.stroke()
        break
      }
      case 'splash': {
        ctx.globalAlpha = Math.max(0, 0.6 - p.life * 2)
        ctx.fillStyle = '#cfe2f7'
        ctx.fillRect(p.x, p.y, 1.5, 1.5)
        break
      }
      case 'fluff': {
        ctx.globalAlpha = 0.85 * Math.max(0, Math.min(1, p.life / 2, (30 - p.life) / 3))
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.strokeStyle = 'rgba(255,255,255,0.8)'
        ctx.lineWidth = 0.7
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2
          ctx.beginPath()
          ctx.moveTo(0, 0)
          ctx.lineTo(Math.cos(a) * p.r * 1.6, Math.sin(a) * p.r * 1.6)
          ctx.stroke()
        }
        ctx.fillStyle = '#fffbea'
        ctx.beginPath()
        ctx.arc(0, 0, 1.2, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
        break
      }
      case 'firefly': {
        const glow = (Math.sin(t * 2.2 + p.blink) + 1) / 2
        if (glow < 0.15) break
        ctx.globalAlpha = glow
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 6)
        g.addColorStop(0, 'rgba(255, 245, 150, 0.9)')
        g.addColorStop(0.3, 'rgba(220, 255, 120, 0.35)')
        g.addColorStop(1, 'rgba(200, 255, 100, 0)')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r * 6, 0, Math.PI * 2)
        ctx.fill()
        break
      }
      case 'heart': {
        ctx.globalAlpha = Math.max(0, 1 - p.life / 1.4)
        ctx.fillStyle = '#ff5c8a'
        const s = p.r
        ctx.beginPath()
        ctx.moveTo(p.x, p.y + s * 0.9)
        ctx.bezierCurveTo(p.x - s * 1.6, p.y - s * 0.2, p.x - s * 0.6, p.y - s * 1.3, p.x, p.y - s * 0.4)
        ctx.bezierCurveTo(p.x + s * 0.6, p.y - s * 1.3, p.x + s * 1.6, p.y - s * 0.2, p.x, p.y + s * 0.9)
        ctx.fill()
        break
      }
      case 'zzz': {
        ctx.globalAlpha = Math.max(0, 1 - p.life / 2.5)
        ctx.fillStyle = '#e8eefc'
        ctx.font = `bold ${p.r}px Segoe UI, sans-serif`
        ctx.fillText('z', p.x, p.y)
        break
      }
    }
    ctx.globalAlpha = 1
  }

  // сколько частиц каждого вида рождается относительно снега
  const RATE = { snow: 1, petal: 0.3, leaf: 0.25, rain: 1.6, fluff: 0.05 }

  window.Particles = { SEASONS, RATE, spawn, drawParticle, rand }
})()
