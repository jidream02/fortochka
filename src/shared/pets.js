// Пиксельные питомцы. Рисую от руки в строках: 20x12, смотрят вправо.
// o — контур, b — шерсть, l — светлое, s — полоски, e — глаза, n — нос

const HEAD = [
  '..............o...o.',
  '.............obo.obo',
  '.............obbbbbo',
  '.............obebebo',
  '.............oblnlbo'
]

const withTail = rows => rows.map((r, i) => (i >= 2 ? '.o' + r.slice(2) : r))

const FRAMES = {
  walk1: [
    ...withTail(HEAD),
    '..o..ooooooooobbbbo.',
    '..oobbbbbbbbbbbbbo..',
    '...obsbbsbbsbbbbbo..',
    '...obbbbbbbbbllllo..',
    '....obbbbbbbbbbbo...',
    '....obo.obo..obo.obo',
    '....ooo.ooo..ooo.ooo'
  ],
  walk2: [
    ...withTail(HEAD),
    '..o..ooooooooobbbbo.',
    '..oobbbbbbbbbbbbbo..',
    '...obsbbsbbsbbbbbo..',
    '...obbbbbbbbbllllo..',
    '....obbbbbbbbbbbo...',
    '...obo..obo.obo..obo',
    '...ooo..ooo.ooo..ooo'
  ],
  sit: [
    ...HEAD,
    '.........ooooobbbbo.',
    '........obbbbbbbbbo.',
    '........obsbbsbbbbo.',
    '........obbbbbbllbo.',
    '........obbbbbbllbo.',
    '..ooooooobbbbbbbbbo.',
    '........ooooooooooo.'
  ],
  sleep: [
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    '.............o..o...',
    '....oooooooooboobo..',
    '...obbbbbbbbbbbbbo..',
    '..obsbbsbbsbbobbbbo.',
    '..obbbbbbbbbbbblnbo.',
    '..ooooooooooooooooo.'
  ]
}

const KINDS = {
  fox:   { title: 'Лиса',       o: '#3a1d10', b: '#e8772e', l: '#fff3e6', s: '#e8772e', e: '#1b1b1b', n: '#2b1a12' },
  ginger:{ title: 'Рыжий кот',  o: '#4a2a14', b: '#f2a04b', l: '#ffe2bf', s: '#d07a2c', e: '#2f6b2a', n: '#e88a9a' },
  gray:  { title: 'Серый кот',  o: '#2a2d33', b: '#9aa3ad', l: '#dfe4ea', s: '#737c87', e: '#d8b13a', n: '#e88a9a' },
  black: { title: 'Чёрный кот', o: '#0b0b0e', b: '#26262e', l: '#3a3a45', s: '#1d1d24', e: '#f5d33c', n: '#7d5560' },
  white: { title: 'Белый кот',  o: '#7a7f8a', b: '#fbfbfd', l: '#ffffff', s: '#eceef2', e: '#4a8fe0', n: '#f0a0b0' },
  calico:{ title: 'Трёхцветка', o: '#3a2a20', b: '#f7f1e8', l: '#ffffff', s: '#c9772f', e: '#3f7a3a', n: '#e88a9a' }
}

const PIXEL = 4
const cache = {}

function petSprite(kind, frame) {
  const key = kind + ':' + frame
  if (cache[key]) return cache[key]
  const pal = KINDS[kind] || KINDS.fox
  const rows = FRAMES[frame]
  const c = document.createElement('canvas')
  c.width = rows[0].length * PIXEL
  c.height = rows.length * PIXEL
  const g = c.getContext('2d')
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x]
      if (ch === '.') continue
      g.fillStyle = pal[ch]
      g.fillRect(x * PIXEL, y * PIXEL, PIXEL, PIXEL)
    }
  })
  cache[key] = c
  return c
}

window.Pets = { KINDS, FRAMES, PIXEL, petSprite }
