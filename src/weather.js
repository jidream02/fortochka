// open-meteo: бесплатно и без ключа

async function findCity(name) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?count=1&language=ru&name=${encodeURIComponent(name)}`
  const res = await fetch(url)
  const json = await res.json()
  const hit = json.results && json.results[0]
  if (!hit) return null
  return { city: hit.name, lat: hit.latitude, lon: hit.longitude }
}

function describe(code) {
  if (code === 0) return 'ясно'
  if (code <= 3) return 'облачно'
  if (code === 45 || code === 48) return 'туман'
  if (code >= 51 && code <= 57) return 'морось'
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'дождь'
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'снег'
  if (code >= 95) return 'гроза'
  return '—'
}

function precip(code) {
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow'
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95) return 'rain'
  return null
}

async function current(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    '&current=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m,precipitation'
  const res = await fetch(url)
  const { current: c } = await res.json()
  // направление ветра — откуда дует; нас интересует только лево/право
  const side = Math.sin((c.wind_direction_10m * Math.PI) / 180) > 0 ? -1 : 1
  return {
    temp: Math.round(c.temperature_2m),
    text: describe(c.weather_code),
    precip: precip(c.weather_code),
    amount: c.precipitation,
    wind: Math.round(c.wind_speed_10m),
    windSide: side,
    at: Date.now()
  }
}

module.exports = { findCity, current }
