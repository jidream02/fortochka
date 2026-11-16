// Звуки природы, сгенерированные прямо в WebAudio: дождь, ветер, камин, сверчки.
// Никаких файлов — всё из шума и осцилляторов.

;(() => {
  const LAYERS = ['rain', 'wind', 'fire', 'crickets']

  class Ambient {
    constructor() {
      this.ctx = null
      this.master = null
      this.gains = {}
      this.levels = { rain: 0, wind: 0, fire: 0, crickets: 0 }
      this.volume = 0.5
      this.on = false
    }

    noise(seconds, brown = false) {
      const ctx = this.ctx
      const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate)
      const d = buf.getChannelData(0)
      let last = 0
      for (let i = 0; i < d.length; i++) {
        const white = Math.random() * 2 - 1
        if (brown) {
          last = (last + 0.02 * white) / 1.02
          d[i] = last * 3.5
        } else {
          d[i] = white
        }
      }
      const src = ctx.createBufferSource()
      src.buffer = buf
      src.loop = true
      return src
    }

    filter(type, freq, q = 0.7) {
      const f = this.ctx.createBiquadFilter()
      f.type = type
      f.frequency.value = freq
      f.Q.value = q
      return f
    }

    // короткий щелчок шума — капля или треск полена
    burst(dest, { freq, dur, gain }) {
      const ctx = this.ctx
      const t = ctx.currentTime
      const src = ctx.createBufferSource()
      src.buffer = this.burstBuf
      const f = this.filter('bandpass', freq, 1.5)
      const g = ctx.createGain()
      g.gain.setValueAtTime(gain, t)
      g.gain.exponentialRampToValueAtTime(0.001, t + dur)
      src.connect(f).connect(g).connect(dest)
      src.start(t, Math.random() * 0.5, dur + 0.02)
    }

    // повторять fn через случайные промежутки (капли, треск, стрекот)
    every(minMs, maxMs, fn) {
      const loop = () => {
        if (this.on) fn()
        setTimeout(loop, minMs + Math.random() * (maxMs - minMs))
      }
      loop()
    }

    build() {
      const ctx = (this.ctx = new AudioContext())
      this.master = ctx.createGain()
      this.master.gain.value = this.volume
      this.master.connect(ctx.destination)
      this.burstBuf = this.noise(1).buffer

      for (const name of LAYERS) {
        const g = ctx.createGain()
        g.gain.value = 0
        g.connect(this.master)
        this.gains[name] = g
      }

      // дождь: ровный шелест + отдельные капли
      const rain = this.noise(4)
      rain.connect(this.filter('highpass', 500)).connect(this.filter('lowpass', 5200)).connect(this.gains.rain)
      rain.start()
      const rumble = this.noise(4, true)
      const rg = ctx.createGain()
      rg.gain.value = 0.5
      rumble.connect(this.filter('lowpass', 300)).connect(rg).connect(this.gains.rain)
      rumble.start()
      this.every(30, 140, () => {
        if (this.levels.rain > 0.01) this.burst(this.gains.rain, { freq: 2500 + Math.random() * 3000, dur: 0.03, gain: 0.15 + Math.random() * 0.25 })
      })

      // ветер: бурый шум через фильтр, который медленно «дышит»
      const wind = this.noise(6, true)
      const wf = this.filter('bandpass', 500, 0.8)
      const swell = ctx.createGain()
      swell.gain.value = 0.7
      wind.connect(wf).connect(swell).connect(this.gains.wind)
      wind.start()
      const lfo = ctx.createOscillator()
      lfo.frequency.value = 0.07
      const lfoAmt = ctx.createGain()
      lfoAmt.gain.value = 300
      lfo.connect(lfoAmt).connect(wf.frequency)
      const lfo2 = ctx.createOscillator()
      lfo2.frequency.value = 0.11
      const lfo2Amt = ctx.createGain()
      lfo2Amt.gain.value = 0.35
      lfo2.connect(lfo2Amt).connect(swell.gain)
      lfo.start()
      lfo2.start()

      // камин: низкое гудение и треск
      const fire = this.noise(4, true)
      const fg = ctx.createGain()
      fg.gain.value = 0.6
      fire.connect(this.filter('lowpass', 220)).connect(fg).connect(this.gains.fire)
      fire.start()
      this.every(40, 380, () => {
        if (this.levels.fire < 0.01) return
        const pops = Math.random() < 0.2 ? 3 : 1
        for (let i = 0; i < pops; i++) {
          setTimeout(() => this.burst(this.gains.fire, { freq: 1500 + Math.random() * 4000, dur: 0.008 + Math.random() * 0.03, gain: 0.3 + Math.random() * 0.6 }), i * 25)
        }
      })

      // сверчки: высокий тон, нарезанный на короткие «стрекотания»
      const osc = ctx.createOscillator()
      osc.frequency.value = 4300
      const chirp = ctx.createGain()
      chirp.gain.value = 0
      osc.connect(chirp).connect(this.filter('bandpass', 4300, 4)).connect(this.gains.crickets)
      osc.start()
      this.every(700, 1600, () => {
        if (this.levels.crickets < 0.01) return
        const t = ctx.currentTime
        for (let i = 0; i < 3; i++) {
          chirp.gain.setValueAtTime(0, t + i * 0.06)
          chirp.gain.linearRampToValueAtTime(0.12, t + i * 0.06 + 0.01)
          chirp.gain.linearRampToValueAtTime(0, t + i * 0.06 + 0.04)
        }
      })
    }

    setVolume(v) {
      this.volume = v
      if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.2)
    }

    // плавно, за пару секунд, чтобы смена погоды не била по ушам
    setLevels(levels) {
      Object.assign(this.levels, levels)
      if (!this.ctx) return
      for (const name of LAYERS) {
        this.gains[name].gain.setTargetAtTime(this.on ? this.levels[name] : 0, this.ctx.currentTime, 1.2)
      }
    }

    start() {
      if (!this.ctx) this.build()
      this.ctx.resume()
      this.on = true
      this.setLevels({})
    }

    stop() {
      this.on = false
      this.setLevels({})
    }
  }

  // что звучит при каком настроении
  function levelsFor(mood) {
    const l = { rain: 0, wind: 0, fire: 0, crickets: 0 }
    if (!mood) return l
    if (mood.sky === 'rain') l.rain = 0.7
    if (mood.sky === 'storm') { l.rain = 0.9; l.wind = 0.5 }
    if (mood.sky === 'snow') { l.wind = 0.45; l.fire = 0.6 }
    if (mood.sky === 'fog') l.wind = 0.3
    if (mood.season === 'winter' && mood.sky !== 'snow') { l.fire = 0.5; l.wind = Math.max(l.wind, 0.2) }
    if (mood.season === 'autumn') { l.fire = Math.max(l.fire, 0.3); l.wind = Math.max(l.wind, 0.25) }
    if (mood.season === 'summer' && (mood.time === 'night' || mood.time === 'dusk') && mood.sky !== 'rain') l.crickets = 0.5
    if (mood.season !== 'winter' && mood.sky === 'clear' && mood.time === 'day') l.wind = Math.max(l.wind, 0.15)
    return l
  }

  window.Ambient = { Ambient, levelsFor, LAYERS }
})()
