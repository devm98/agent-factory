import type { Outfit, Status } from '../types'

// The mascot is drawn once, as a grid of palette keys, and both surfaces
// read the same grid: desktop as SVG rects, the terminal as half-block cells.
export const WIDTH = 16
export const HEIGHT = 12

export const PALETTE: Record<string, number> = {
  C: 0xd97757, // body
  E: 0x1f1e1d, // eyes
  H: 0xa0763b, // explorer hat
  h: 0x6b4e26, // hat band
  P: 0x534ab7, // headphones
  L: 0xb5d4f4, // glasses lens
  G: 0x185fa5, // glasses frame
  Y: 0xefa027, // gold
  W: 0xe6f1fb, // paper
  B: 0x378add, // blueprint ink
  R: 0xe24b4a, // error mark
}

export type Grid = string[][]

function pixel(grid: Grid, row: number, col: number): string {
  return grid[row]?.[col] ?? '.'
}

function color(key: string): number {
  return PALETTE[key] ?? 0
}

function blank(): Grid {
  return Array.from({ length: HEIGHT }, () => Array<string>(WIDTH).fill('.'))
}

function rect(grid: Grid, x: number, y: number, w: number, h: number, key: string) {
  for (let row = y; row < y + h; row++) {
    for (let col = x; col < x + w; col++) {
      const line = grid[row]
      if (line !== undefined && col >= 0 && col < WIDTH) line[col] = key
    }
  }
}

// One frame of the mascot; `frame` alternates 0 and 1 for the two-step moves.
export function sprite(status: Status, outfit: Outfit, frame: number): Grid {
  const grid = blank()
  rect(grid, 3, 3, 10, 6, 'C')

  if (outfit === 'glasses') {
    rect(grid, 4, 4, 3, 2, 'L')
    rect(grid, 9, 4, 3, 2, 'L')
    rect(grid, 7, 4, 2, 1, 'G')
  }

  if (status === 'sleep') {
    rect(grid, 4, 5, 2, 1, 'E')
    rect(grid, 9, 5, 2, 1, 'E')
  } else if (status === 'error') {
    rect(grid, 5, 5, 1, 1, 'E')
    rect(grid, 10, 5, 1, 1, 'E')
    rect(grid, 4, 4, 2, 1, 'E')
    rect(grid, 10, 4, 2, 1, 'E')
  } else if (status === 'done' || status === 'delivering') {
    rect(grid, 4, 5, 1, 1, 'E')
    rect(grid, 5, 4, 1, 1, 'E')
    rect(grid, 6, 5, 1, 1, 'E')
    rect(grid, 9, 5, 1, 1, 'E')
    rect(grid, 10, 4, 1, 1, 'E')
    rect(grid, 11, 5, 1, 1, 'E')
  } else {
    const look = status === 'thinking' || status === 'idle' ? (frame === 0 ? -1 : 1) : 0
    rect(grid, 5 + look, 4, 1, 2, 'E')
    rect(grid, 10 + look, 4, 1, 2, 'E')
  }

  if (outfit === 'explorer') {
    rect(grid, 2, 2, 12, 1, 'H')
    rect(grid, 4, 0, 8, 2, 'H')
    rect(grid, 4, 1, 8, 1, 'h')
  } else if (outfit === 'headphones') {
    rect(grid, 4, 1, 8, 1, 'P')
    rect(grid, 3, 2, 1, 1, 'P')
    rect(grid, 12, 2, 1, 1, 'P')
    rect(grid, 2, 3, 1, 3, 'P')
    rect(grid, 13, 3, 1, 3, 'P')
  } else if (outfit === 'manager') {
    rect(grid, 4, 1, 8, 1, 'Y')
    rect(grid, 4, 0, 1, 1, 'Y')
    rect(grid, 7, 0, 2, 1, 'Y')
    rect(grid, 11, 0, 1, 1, 'Y')
    rect(grid, 7, 6, 2, 1, 'Y')
    rect(grid, 7, 7, 2, 2, 'Y')
  }

  const armsUp = status === 'done'
  const handUp = status === 'waiting' || armsUp
  if (armsUp) rect(grid, 1, 2, 2, 4, 'C')
  else if (status === 'working') rect(grid, 1, frame === 0 ? 6 : 7, 2, 1, 'C')
  else rect(grid, 1, 6, 2, 1, 'C')
  if (handUp) rect(grid, 13, 2, 2, 4, 'C')
  else if (status === 'working') rect(grid, 13, frame === 0 ? 7 : 6, 2, 1, 'C')
  else rect(grid, 13, 6, 2, 1, 'C')

  if (status === 'delivering') rect(grid, 13, 5, 3, 3, 'W')
  if (outfit === 'blueprint' && status !== 'delivering') {
    rect(grid, 14, 4, 2, 4, 'W')
    rect(grid, 14, 5, 2, 1, 'B')
  }
  if (status === 'error') rect(grid, 14, 0, 1, 2, 'R')

  const legLift = status === 'arriving' || status === 'delivering' ? frame : -1
  for (const [index, x] of [4, 6, 9, 11].entries()) {
    rect(grid, x, 9, 1, index % 2 === legLift ? 1 : 2, 'C')
  }

  return grid
}

export function hex(color: number): string {
  return '#' + color.toString(16).padStart(6, '0')
}

// The grid as SVG rects at (x, y), each pixel `scale` units, runs merged.
export function toSvg(grid: Grid, x: number, y: number, scale: number): string {
  let out = ''
  grid.forEach((row, rowIndex) => {
    let col = 0
    while (col < WIDTH) {
      const key = row[col] ?? '.'
      if (key === '.') {
        col++
        continue
      }
      let end = col
      while (end + 1 < WIDTH && row[end + 1] === key) end++
      out += `<rect x="${x + col * scale}" y="${y + rowIndex * scale}" width="${(end - col + 1) * scale}" height="${scale}" fill="${hex(color(key))}"/>`
      col = end + 1
    }
  })

  return out
}

const DEFAULT_COLOR = 0x01000000
const UPPER_HALF = 0x2580
const LOWER_HALF = 0x2584
const SPACE = 0x20

export const RASTER_COLUMNS = WIDTH
export const RASTER_ROWS = HEIGHT / 2

// The grid as a Raster's cells: two pixel rows to a cell, the upper one the
// foreground of `▀` and the lower one its background.
export function toRasterCells(grid: Grid): string {
  const words = new Uint32Array(RASTER_COLUMNS * RASTER_ROWS * 3)
  let index = 0
  for (let row = 0; row < HEIGHT; row += 2) {
    for (let col = 0; col < WIDTH; col++) {
      const top = pixel(grid, row, col)
      const bottom = pixel(grid, row + 1, col)
      let cell: [number, number, number]
      if (top === '.' && bottom === '.') cell = [SPACE, DEFAULT_COLOR, DEFAULT_COLOR]
      else if (top === '.') cell = [LOWER_HALF, color(bottom), DEFAULT_COLOR]
      else if (bottom === '.') cell = [UPPER_HALF, color(top), DEFAULT_COLOR]
      else cell = [UPPER_HALF, color(top), color(bottom)]
      words.set(cell, index)
      index += 3
    }
  }

  return base64(new Uint8Array(words.buffer))
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

export function base64(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0
    const b = i + 1 < bytes.length ? bytes[i + 1] ?? 0 : 0
    const c = i + 2 < bytes.length ? bytes[i + 2] ?? 0 : 0
    const n = (a << 16) | (b << 8) | c
    out += ALPHABET.charAt((n >> 18) & 63) + ALPHABET.charAt((n >> 12) & 63)
    out += i + 1 < bytes.length ? ALPHABET.charAt((n >> 6) & 63) : '='
    out += i + 2 < bytes.length ? ALPHABET.charAt(n & 63) : '='
  }

  return out
}
