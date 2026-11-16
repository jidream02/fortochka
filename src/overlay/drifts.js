// Сугробы: у каждой поверхности (верх окна или панель задач) — массив высот по колонкам.

;(() => {
  const COL = 3
  const MAX_PILE = 22

  class Surface {
    constructor(id, x1, x2, y, maxPile = MAX_PILE) {
      this.id = id
      this.x1 = x1
      this.x2 = x2
      this.y = y
      this.maxPile = maxPile
      this.cols = new Float32Array(Math.max(1, Math.ceil((x2 - x1) / COL)))
      this.segs = [[x1, x2]]
      this.items = [] // лепестки и листья, которые легли сверху
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

    // сколько снега может удержать колонка: у краёв сугроб сходит на нет
    limit(i) {
      const x = this.x1 + i * COL
      let edge = Infinity
      for (const [a, b] of this.segs) {
        if (x >= a && x < b) edge = Math.min(x - a, b - x)
      }
      if (edge === Infinity) return 0
      return Math.min(this.maxPile, 1.5 + edge * 0.35)
    }

    // возвращает true, если снежинка не удержалась и должна упасть дальше с края
    add(x, amount) {
      let i = this.col(x)
      this.cols[i] += amount
      // осыпание: снег сползает к соседям, пока склон слишком крутой
      for (let step = 0; step < 6; step++) {
        const h = this.cols[i]
        const left = i > 0 ? this.cols[i - 1] : -1
        const right = i < this.cols.length - 1 ? this.cols[i + 1] : -1
        const lowest = left < right ? i - 1 : i + 1
        const lowH = Math.min(left, right)
        if (lowH < 0 || h - lowH <= 1.2) break
        const move = (h - lowH) / 2.5
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
          this.cols[i] = Math.max(0, this.cols[i] - rate)
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

    draw(ctx) {
      for (const [a, b] of this.segs) {
        const i1 = this.col(a)
        const i2 = this.col(b - 1)
        let has = false
        for (let i = i1; i <= i2; i++) if (this.cols[i] > 0.3) { has = true; break }
        if (!has) continue

        ctx.beginPath()
        ctx.moveTo(a, this.y + 1)
        for (let i = i1; i <= i2; i++) {
          const x = Math.max(a, Math.min(b, this.x1 + i * COL + COL / 2))
          ctx.lineTo(x, this.y - Math.min(this.cols[i], this.limit(i)))
        }
        ctx.lineTo(b, this.y + 1)
        ctx.closePath()

        ctx.fillStyle = '#f4f8ff'
        ctx.shadowColor = 'rgba(120, 150, 200, 0.55)'
        ctx.shadowBlur = 4
        ctx.shadowOffsetY = 1
        ctx.fill()
        ctx.shadowBlur = 0
        ctx.shadowOffsetY = 0
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

  window.Drifts = { Surface, visibleSegments, COL }
})()
