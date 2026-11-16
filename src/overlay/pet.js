// Питомец гуляет по панели задач. Можно погладить мышкой.

class Pet {
  constructor() {
    this.x = 200
    this.y = 0
    this.vy = 0
    this.dir = 1
    this.state = 'walk' // walk | sit | sleep
    this.timer = 3
    this.anim = 0
    this.happy = 0
    this.hover = false
    this.zTimer = 0
    this.kind = 'fox'
    this.mode = 'walk'
    this.name = ''
  }

  get w() { return 20 * Pets.PIXEL }
  get h() { return 12 * Pets.PIXEL }

  configure({ kind, mode, name }) {
    this.kind = kind
    this.name = name || ''
    if (mode !== this.mode) {
      this.mode = mode
      this.state = mode
      this.timer = 4
    }
  }

  think() {
    // в режиме «гуляет» сам решает, что делать дальше
    const r = Math.random()
    if (this.state === 'walk') {
      if (r < 0.55) this.setState('sit', 4 + Math.random() * 6)
      else if (r < 0.7) this.setState('sleep', 15 + Math.random() * 20)
      else { this.dir *= -1; this.setState('walk', 3 + Math.random() * 6) }
    } else {
      if (Math.random() < 0.5) this.dir *= -1
      this.setState('walk', 4 + Math.random() * 8)
    }
  }

  setState(state, time) {
    this.state = state
    this.timer = time
  }

  update(dt, W, groundAt, fx) {
    this.anim += dt
    this.happy = Math.max(0, this.happy - dt)

    if (this.mode === 'walk' && !this.happy && !this.hover) {
      this.timer -= dt
      if (this.timer <= 0) this.think()
    }

    if (this.state === 'walk' && !this.happy && !this.hover) {
      this.x += this.dir * 38 * dt
      if (this.x < 10) { this.x = 10; this.dir = 1 }
      if (this.x > W - this.w - 10) { this.x = W - this.w - 10; this.dir = -1 }
    }

    const ground = groundAt(this.x + this.w / 2) - this.h
    if (this.y < ground || this.vy < 0) {
      this.vy += 900 * dt
      this.y += this.vy * dt
      if (this.y >= ground) { this.y = ground; this.vy = 0 }
    } else {
      this.y = ground
    }

    if (this.state === 'sleep' && !this.happy) {
      this.zTimer -= dt
      if (this.zTimer <= 0) {
        this.zTimer = 1.1
        const headX = this.dir > 0 ? this.x + this.w - 14 : this.x + 14
        fx.push(Particles.spawn('zzz', 0, { x: headX, y: this.y + 22, vx: 8 * this.dir, vy: -18, r: 11 + Math.random() * 5 }))
      }
    }
  }

  frame() {
    if (this.happy || this.hover) return 'sit'
    if (this.state === 'sleep') return 'sleep'
    if (this.state === 'sit') return 'sit'
    return Math.floor(this.anim * 6) % 2 ? 'walk1' : 'walk2'
  }

  contains(mx, my) {
    return mx > this.x - 6 && mx < this.x + this.w + 6 && my > this.y - 6 && my < this.y + this.h + 4
  }

  stroke(fx) {
    this.happy = 2.5
    if (this.state === 'sleep' && this.mode !== 'sleep') this.state = 'sit'
    fx.push(Particles.spawn('heart', 0, {
      x: this.x + this.w / 2 + (Math.random() - 0.5) * 30,
      y: this.y,
      vx: (Math.random() - 0.5) * 20,
      vy: -45,
      r: 6 + Math.random() * 3
    }))
  }

  hop() {
    if (this.vy === 0) this.vy = -260
  }

  draw(ctx) {
    const img = Pets.petSprite(this.kind, this.frame())
    ctx.imageSmoothingEnabled = false
    ctx.save()
    if (this.dir < 0) {
      ctx.translate(this.x + this.w, Math.round(this.y))
      ctx.scale(-1, 1)
      ctx.drawImage(img, 0, 0)
    } else {
      ctx.drawImage(img, Math.round(this.x), Math.round(this.y))
    }
    ctx.restore()

    if (this.hover && this.name) {
      ctx.font = '600 12px Segoe UI, sans-serif'
      const tw = ctx.measureText(this.name).width
      const bx = this.x + this.w / 2 - tw / 2 - 8
      const by = this.y - 26
      ctx.fillStyle = 'rgba(20, 26, 43, 0.85)'
      ctx.beginPath()
      ctx.roundRect(bx, by, tw + 16, 20, 10)
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.fillText(this.name, bx + 8, by + 14)
    }
  }
}

window.Pet = Pet
