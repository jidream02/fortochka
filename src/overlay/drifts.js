// Сугробы: у каждой поверхности (верх окна или панель задач) — массив высот по колонкам.
// Чтобы не было ровной «полоски», у каждой колонки есть свой шум: где-то снег держится лучше,
// где-то хуже, сверху налипают комья, у краёв свисает козырёк, а с толстого сугроба растут сосульки.

;(() => {
  const COL = 3
  const MAX_PILE = 24

  const style = {
    shade: 'rgba(120, 150, 200, 0.55)',
    under: '#d9e4f3'
  }

  // плавный шум из нескольких синусов, у каждой поверхности свои фазы
  function makeNoise(n) {
    const p = [Math.random() * 100, Math.random() * 100, Math.random() * 100]
    const out = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      out[i] = (Math.sin(i * 0.19 + p[0]) * 0.55 + Math.sin(i * 0.071 + p[1]) * 0.8 + Math.sin(i * 0.47 + p[2]) * 0.3) / 1.65
    }
    return out // примерно от -1 до 1
  }

  class Surface {
    constructor(id, x1, x2, y, maxPile = MAX_PILE) {
      this.id = id
      this.x1 = x1
      this.x2 = x2
      this.y = y
      this.maxPile = maxPile
      const n = Math.max(1, Math.ceil((x2 - x1) / COL))
      this.cols = new Float32Array(n)
      this.noise = makeNoise(n)
      this.segs = [[x1, x2]]
      this.items = [] // лепестки и листья, которые легли сверху
      this.icicles = []
      if (id !== 'floor') {
        for (let i = 4; i < n - 4; i++) {
          if (Math.random() < 0.06) this.icicles.push({ i, len: 4 + Math.random() * 12, w: 1.5 + Math.random() * 2 })
        }
      }
    }

    sameRect(x1, x2, y) {
      return Math.abs(this.x1 - x1) < 1 && Math.abs(this.x2 - x2) < 1 && Math.abs(this.y - y) < 1
    }

    visibleAt(x) {
      for (const [a, b] of this.segs) if (x >= a && x < b) return true
      return false
    }

    col(x) {
      return Math.min(this.cols.length - 1, Math.max(0, Math.floor((x - this.x1) / COL)))
    }

    top(x) {
      return this.y - this.cols[this.col(x)]
    }

    // сколько снега может удержать колонка: у краёв сугроб сходит на нет,
    // а посередине «вместимость» гуляет из-за шума — получаются бугры и ямки
    limit(i) {
      const x = this.x1 + i * COL
      let edge = Infinity
      for (const [a, b] of this.segs) {
        if (x >= a && x < b) edge = Math.min(x - a, b - x)
      }
      if (edge === Infinity) return 0
      const bumpy = this.maxPile * (0.6 + 0.4 * this.noise[i])
      return Math.max(1, Math.min(bumpy, 2 + edge * (0.3 + 0.15 * this.noise[i])))
    }

    // false — снежинка осталась лежать, true — не удержалась (колонка переполнена)
    add(x, amount) {
      let i = this.col(x)
      this.cols[i] += amount * (0.5 + Math.random())
      // осыпание: снег сползает к соседям, пока склон слишком крутой.
      // порог у каждой колонки свой — где-то снег налипает горкой
      for (let step = 0; step < 6; step++) {
        const h = this.cols[i]
        const left = i > 0 ? this.cols[i - 1] : -1
        const right = i < this.cols.length - 1 ? this.cols[i + 1] : -1
        const lowest = left < right ? i - 1 : i + 1
        const lowH = Math.min(left, right)
        if (lowH < 0 || h - lowH <= 1.6 + this.noise[i] * 1.2) break
        const move = (h - lowH) / (2.2 + Math.random())
        this.cols[i] -= move
        this.cols[lowest] += move
        i = lowest
      }
      const lim = this.limit(i)
      if (this.cols[i] > lim) {
        this.cols[i] = lim
        return true
      }
      return false
    }

    melt(rate) {
      let any = false
      for (let i = 0; i < this.cols.length; i++) {
        if (this.cols[i] > 0) {
          this.cols[i] = Math.max(0, this.cols[i] - rate * (0.7 + 0.3 * this.noise[i]))
          any = true
        }
      }
      return any
    }

    total() {
      let s = 0
      for (const h of this.cols) s += h
      return s
    }

    height(i) {
      const h = Math.min(this.cols[i], this.limit(i))
      // мелкая неровность поверхности, растёт вместе с сугробом
      return h <= 0.3 ? 0 : h + this.noise[(i * 2) % this.noise.length] * Math.min(3, h * 0.18)
    }

    draw(ctx) {
      for (const [a, b] of this.segs) {
        const i1 = this.col(a)
        const i2 = this.col(b - 1)
        let peak = 0
        for (let i = i1; i <= i2; i++) peak = Math.max(peak, this.cols[i])
        if (peak < 0.3) continue

        // козырёк: толстый снег немного свисает за край окна
        const hl = this.height(i1)
        const hr = this.height(i2)
        const overL = Math.min(5, hl * 0.35)
        const overR = Math.min(5, hr * 0.35)

        const pts = []
        pts.push([a - overL, this.y + Math.min(3, hl * 0.25)])
        for (let i = i1; i <= i2; i++) {
          const x = Math.max(a, Math.min(b, this.x1 + i * COL + COL / 2))
          pts.push([x, this.y - this.height(i)])
        }
        pts.push([b + overR, this.y + Math.min(3, hr * 0.25)])

        ctx.beginPath()
        ctx.moveTo(pts[0][0], pts[0][1])
        // сглаживание через середины отрезков — края получаются мягкими, а не ломаными
        for (let k = 1; k < pts.length - 1; k++) {
          const mx = (pts[k][0] + pts[k + 1][0]) / 2
          const my = (pts[k][1] + pts[k + 1][1]) / 2
          ctx.quadraticCurveTo(pts[k][0], pts[k][1], mx, my)
        }
        ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1])
        ctx.lineTo(b, this.y + 1)
        ctx.lineTo(a, this.y + 1)
        ctx.closePath()

        const grad = ctx.createLinearGradient(0, this.y - peak, 0, this.y + 2)
        grad.addColorStop(0, '#ffffff')
        grad.addColorStop(0.7, '#f1f6fd')
        grad.addColorStop(1, style.under)
        ctx.fillStyle = grad
        ctx.shadowColor = style.shade
        ctx.shadowBlur = 5
        ctx.shadowOffsetY = 1
        ctx.fill()
        ctx.shadowBlur = 0
        ctx.shadowOffsetY = 0

        // комья сверху
        ctx.fillStyle = '#fbfdff'
        for (let i = i1 + 2; i <= i2 - 2; i += 5) {
          const h = this.height(i)
          if (h < 5 || this.noise[(i * 3) % this.noise.length] < 0.15) continue
          const x = this.x1 + i * COL + COL / 2
          const r = Math.min(4.5, h * 0.22)
          ctx.beginPath()
          ctx.arc(x, this.y - h + r * 0.35, r, 0, Math.PI * 2)
          ctx.fill()
        }

        // сосульки под толстым снегом
        for (const ic of this.icicles) {
          if (ic.i < i1 || ic.i > i2) continue
          const h = this.cols[ic.i]
          if (h < 7) continue
          const len = ic.len * Math.min(1, (h - 7) / 10)
          if (len < 1.5) continue
          const x = this.x1 + ic.i * COL + COL / 2
          const g = ctx.createLinearGradient(0, this.y, 0, this.y + len)
          g.addColorStop(0, 'rgba(225, 240, 255, 0.95)')
          g.addColorStop(1, 'rgba(190, 220, 250, 0.35)')
          ctx.fillStyle = g
          ctx.beginPath()
          ctx.moveTo(x - ic.w, this.y)
          ctx.lineTo(x + ic.w, this.y)
          ctx.lineTo(x, this.y + len)
          ctx.closePath()
          ctx.fill()
        }
      }
    }
  }

  // Видимые куски верхнего края: окно может быть частично закрыто окнами выше по z-порядку
  function visibleSegments(win, above) {
    let segs = [[win.x, win.x + win.w]]
    for (const o of above) {
      if (!(o.y <= win.y - 2 && o.y + o.h > win.y - 4)) continue
      const a = o.x
      const b = o.x + o.w
      const next = []
      for (const [s, e] of segs) {
        if (b <= s || a >= e) { next.push([s, e]); continue }
        if (a > s) next.push([s, a])
        if (b < e) next.push([b, e])
      }
      segs = next
    }
    return segs.filter(([s, e]) => e - s > 8)
  }

  window.Drifts = { Surface, visibleSegments, COL, style }
})()
