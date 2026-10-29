import type { Desk, Office, Status } from '../types'
import { bubbleText, counts, groups, layoutTier } from './model'
import type { Tier } from './model'
import { sprite, toSvg } from './sprites'

// The desktop office as one SVG document. Plain strings and no JSX, so it
// can be drawn and previewed outside the engine too.

export const ANIMATED: readonly Status[] = ['working', 'thinking', 'idle', 'arriving', 'delivering']

export const STATUS_STYLE: Record<Status, { fill: string; ink: string; term: string }> = {
  arriving: { fill: '#F1EFE8', ink: '#5F5E5A', term: 'subtle' },
  working: { fill: '#E6F1FB', ink: '#0C447C', term: 'suggestion' },
  thinking: { fill: '#F1EFE8', ink: '#444441', term: 'subtle' },
  waiting: { fill: '#FAEEDA', ink: '#854F0B', term: 'warning' },
  error: { fill: '#FCEBEB', ink: '#A32D2D', term: 'error' },
  done: { fill: '#EAF3DE', ink: '#3B6D11', term: 'success' },
  delivering: { fill: '#EAF3DE', ink: '#3B6D11', term: 'success' },
  idle: { fill: '#F1EFE8', ink: '#888780', term: 'inactive' },
  sleep: { fill: '#F1EFE8', ink: '#888780', term: 'inactive' },
}

export const VIEW_WIDTH = 640
const WALL = 120
const FONT = 'font-family="Segoe UI, system-ui, sans-serif"'

export function escape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function fit(text: string, room: number): string {
  return text.length > room ? text.slice(0, Math.max(1, room - 1)) + '…' : text
}

const r = (x: number, y: number, w: number, h: number, fill: string, extra = '') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${extra}/>`

const text = (x: number, y: number, size: number, fill: string, body: string, extra = '') =>
  `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" ${FONT}${extra}>${escape(body)}</text>`

// ---- the room ---------------------------------------------------------------

function wall(): string {
  let out = r(0, 0, VIEW_WIDTH, WALL, '#EFE6D8')
  for (let x = 0; x < VIEW_WIDTH; x += 16) out += r(x, 0, 8, WALL, '#F3EBDF')
  out += r(0, WALL - 8, VIEW_WIDTH, 8, '#A9774B') + r(0, WALL - 8, VIEW_WIDTH, 2, '#C4946A')

  for (const x of [28, 118]) {
    out += r(x - 4, 18, 78, 64, '#FFFFFF', ' rx="3"') + r(x, 22, 70, 56, '#B5D4F4')
    out += `<g><ellipse cx="${x + 22}" cy="40" rx="12" ry="5" fill="#FFFFFF"/><ellipse cx="${x + 30}" cy="37" rx="8" ry="5" fill="#FFFFFF"/>`
    out += `<animateTransform attributeName="transform" type="translate" values="0 0;22 0;0 0" dur="24s" repeatCount="indefinite"/></g>`
    out += r(x + 34, 22, 2, 56, '#FFFFFF') + r(x, 49, 70, 2, '#FFFFFF')
    out += r(x - 6, 82, 82, 5, '#D9CBB5')
  }

  const cx = VIEW_WIDTH / 2
  out += r(cx - 84, 26, 168, 30, '#2C2C2A', ' rx="4"') + r(cx - 80, 30, 160, 22, '#3D3B37', ' rx="2"')
  out += text(cx, 46, 13, '#EFA027', 'AGENT FACTORY', ' text-anchor="middle" font-weight="600" letter-spacing="2"')

  out += r(cx + 100, 22, 56, 44, '#7A5634', ' rx="2"') + r(cx + 104, 26, 48, 36, '#FAF7F0')
  ;[14, 22, 18, 28].forEach((h, i) => (out += r(cx + 110 + i * 10, 58 - h, 6, h, ['#378ADD', '#1D9E75', '#EF9F27', '#D97757'][i]!)))

  const clockX = cx + 186
  out += `<circle cx="${clockX}" cy="44" r="18" fill="#FFFFFF" stroke="#5F5E5A" stroke-width="3"/>`
  for (let i = 0; i < 12; i += 3) {
    const a = (i / 12) * Math.PI * 2
    out += `<circle cx="${clockX + Math.sin(a) * 13}" cy="${44 - Math.cos(a) * 13}" r="1.5" fill="#5F5E5A"/>`
  }
  out += `<rect x="${clockX - 1}" y="32" width="2" height="12" fill="#2C2C2A"><animateTransform attributeName="transform" type="rotate" from="0 ${clockX} 44" to="360 ${clockX} 44" dur="60s" repeatCount="indefinite"/></rect>`
  out += `<rect x="${clockX - 1}" y="36" width="2" height="8" fill="#993C1D"><animateTransform attributeName="transform" type="rotate" from="0 ${clockX} 44" to="360 ${clockX} 44" dur="720s" repeatCount="indefinite"/></rect>`

  const shelfX = VIEW_WIDTH - 96
  out += r(shelfX, 10, 84, WALL - 18, '#7A5634', ' rx="2"')
  const books = ['#D85A30', '#378ADD', '#639922', '#EF9F27', '#7F77DD', '#1D9E75', '#D4537E']
  for (let shelf = 0; shelf < 3; shelf++) {
    const y = 14 + shelf * 32
    out += r(shelfX + 4, y, 76, 26, '#5A3E24')
    for (let b = 0; b < 8; b++) {
      const h = 18 + ((b * 7 + shelf * 3) % 7)
      out += r(shelfX + 6 + b * 9, y + 26 - h, 7, h, books[(b + shelf * 2) % books.length]!)
    }
    out += r(shelfX, y + 26, 84, 4, '#8C6440')
  }

  return out
}

function floor(height: number): string {
  let out = r(0, WALL, VIEW_WIDTH, height - WALL, '#D9BC94')
  let row = 0
  for (let y = WALL + 20; y < height; y += 20, row++) {
    out += r(0, y, VIEW_WIDTH, 1, '#C9A77C')
    for (let x = (row % 2) * 60; x < VIEW_WIDTH; x += 120) out += r(x, y - 20, 1, 20, '#C9A77C')
  }

  return out
}

function plant(x: number, baseY: number, completed: number): string {
  const grown = Math.min(completed, 12)
  const stem = 18 + grown * 4
  let out = r(x + 9, baseY - 18 - stem, 3, stem, '#3B6D11')
  for (let leaf = 0; leaf < 2 + Math.floor(grown / 1.5); leaf++) {
    const side = leaf % 2 === 0 ? -8 : 9
    out += `<ellipse cx="${x + 10 + side}" cy="${baseY - 22 - leaf * 6}" rx="9" ry="4" fill="${leaf % 3 === 0 ? '#639922' : '#97C459'}"/>`
  }
  out += `<path d="M${x} ${baseY - 20} h22 l-3 20 h-16 z" fill="#B5543A"/>` + r(x - 2, baseY - 22, 26, 4, '#993C1D')

  return out
}

// ---- people and desks -------------------------------------------------------

function bubble(desk: Desk, cx: number, y: number, maxWidth: number, size: number, tailX: number): string {
  const style = STATUS_STYLE[desk.status]
  const room = Math.floor((maxWidth - 14) / (size * 0.56))
  const body = fit(bubbleText(desk), room)
  const width = Math.min(maxWidth, Math.max(30, body.length * size * 0.56 + 16))
  const height = size + 10
  const left = Math.max(cx - width / 2, tailX - width + 10)
  const tail = Math.min(Math.max(tailX, left + 8), left + width - 8)

  return (
    `<rect x="${left}" y="${y}" width="${width}" height="${height}" rx="${height / 2}" fill="${style.fill}" stroke="${style.ink}" stroke-opacity="0.25"/>` +
    `<path d="M${tail - 5} ${y + height - 0.5} l5 6 l5 -6 z" fill="${style.fill}"/>` +
    text(left + width / 2, y + size + 3, size, style.ink, body, ' text-anchor="middle"')
  )
}

function mascot(desk: Desk, x: number, y: number, s: number, isAnimated: boolean): string {
  if (!isAnimated || !ANIMATED.includes(desk.status)) {
    const still = toSvg(sprite(desk.status, desk.look, 0), x, y, s)
    if (desk.status === 'done') {
      return `<g>${still}<animateTransform attributeName="transform" type="translate" values="0 0;0 -${s * 1.5};0 0" dur="0.7s" repeatCount="indefinite"/></g>`
    }

    return still
  }
  const period = desk.status === 'working' ? 0.45 : desk.status === 'thinking' || desk.status === 'idle' ? 1.6 : 0.5

  return [0, 1]
    .map(
      frame =>
        `<g opacity="${frame === 0 ? 1 : 0}">${toSvg(sprite(desk.status, desk.look, frame), x, y, s)}` +
        `<animate attributeName="opacity" values="${frame === 0 ? '1;0' : '0;1'}" dur="${period}s" calcMode="discrete" repeatCount="indefinite"/></g>`,
    )
    .join('')
}

// A small sign over the head for the states that want the person's eye.
function badge(desk: Desk, x: number, y: number): string {
  if (desk.status === 'waiting') {
    return (
      `<g><circle cx="${x}" cy="${y}" r="8" fill="#EF9F27"/>` +
      text(x, y + 4.5, 12, '#FFFFFF', '!', ' text-anchor="middle" font-weight="700"') +
      `<animateTransform attributeName="transform" type="translate" values="0 0;0 -3;0 0" dur="0.9s" repeatCount="indefinite"/></g>`
    )
  }
  if (desk.status === 'done') {
    return `<circle cx="${x}" cy="${y}" r="8" fill="#639922"/><path d="M${x - 4} ${y} l3 3 l5 -6" stroke="#FFFFFF" stroke-width="2" fill="none"/>`
  }
  if (desk.status === 'sleep') {
    return ['z', 'Z']
      .map(
        (letter, index) =>
          `<text x="${x + index * 7}" y="${y}" font-size="${10 + index * 3}" fill="#888780" ${FONT}>${letter}` +
          `<animate attributeName="y" values="${y};${y - 16}" dur="2.4s" begin="${index * 1.2}s" repeatCount="indefinite"/>` +
          `<animate attributeName="opacity" values="1;0" dur="2.4s" begin="${index * 1.2}s" repeatCount="indefinite"/></text>`,
      )
      .join('')
  }

  return ''
}

function monitor(desk: Desk | undefined, x: number, y: number, w: number, h: number): string {
  let out = r(x + w / 2 - 2, y + h, 4, 4, '#444441') + r(x + w / 2 - 7, y + h + 3, 14, 2, '#444441')
  out += r(x, y, w, h, '#444441', ' rx="2"')
  const status = desk?.status
  const screen = status === undefined || status === 'sleep' ? '#2C2C2A' : status === 'error' ? '#791F1F' : '#21352C'
  out += r(x + 2, y + 2, w - 4, h - 4, screen)
  if (desk === undefined) return out

  if (status === 'working') {
    const id = `m${desk.agentId.replace(/[^a-zA-Z0-9]/g, '')}`
    out += `<clipPath id="${id}">${r(x + 2, y + 2, w - 4, h - 4, '#000')}</clipPath><g clip-path="url(#${id})"><g>`
    for (let line = 0; line < 10; line++) {
      const width = Math.min((((line * 7) % 5) + 2) * (w / 10), w - 8)
      out += r(x + 4, y + 4 + line * 3.5, width, 1.5, line % 4 === 0 ? '#EF9F27' : '#5DCAA5')
    }
    out += `<animateTransform attributeName="transform" type="translate" values="0 0;0 -14" dur="1.2s" repeatCount="indefinite"/></g></g>`
  } else if (status === 'error') {
    out += text(x + w / 2, y + h / 2 + 4, 11, '#F7C1C1', '!', ' text-anchor="middle" font-weight="700"')
    for (const [dx, delay] of [[-4, 0], [4, 0.7]] as const) {
      out += `<circle cx="${x + w / 2 + dx}" cy="${y}" r="4" fill="#B4B2A9">`
      out += `<animate attributeName="cy" values="${y};${y - 18}" dur="1.4s" begin="${delay}s" repeatCount="indefinite"/>`
      out += `<animate attributeName="opacity" values="0.9;0" dur="1.4s" begin="${delay}s" repeatCount="indefinite"/></circle>`
    }
  } else if (status === 'thinking' || status === 'waiting' || status === 'arriving') {
    out += r(x + 4, y + 5, (w - 8) * 0.6, 1.5, '#5DCAA5') + r(x + 4, y + 9, (w - 8) * 0.4, 1.5, '#5DCAA5')
  } else if (status === 'done' || status === 'delivering') {
    out += `<path d="M${x + w / 2 - 5} ${y + h / 2} l4 4 l7 -8" stroke="#97C459" stroke-width="2" fill="none"/>`
  }

  return out
}

// The item a look keeps on the desk, standing on the desk top at baseY.
function deskItem(item: string | undefined, x: number, baseY: number, s: number): string {
  const u = s / 2
  if (item === 'cat') {
    let out = r(x, baseY - 5 * u, 7 * u, 5 * u, '#888780', ` rx="${u}"`)
    out += r(x + 4 * u, baseY - 9 * u, 5 * u, 5 * u, '#888780', ` rx="${u}"`)
    out += `<path d="M${x + 4 * u} ${baseY - 9 * u} l${u} ${-2 * u} l${u} ${2 * u} z M${x + 7 * u} ${baseY - 9 * u} l${u} ${-2 * u} l${u} ${2 * u} z" fill="#888780"/>`
    out += r(x + 5 * u, baseY - 7 * u, u, u, '#2C2C2A') + r(x + 7 * u, baseY - 7 * u, u, u, '#2C2C2A')
    out += `<path d="M${x} ${baseY - 2 * u} q${-3 * u} ${-2 * u} ${-2 * u} ${-6 * u}" stroke="#888780" stroke-width="${u}" fill="none"><animateTransform attributeName="transform" type="rotate" values="0 ${x} ${baseY - 2 * u};-14 ${x} ${baseY - 2 * u};0 ${x} ${baseY - 2 * u}" dur="2.4s" repeatCount="indefinite"/></path>`
    return out
  }
  if (item === 'cactus') {
    return (
      r(x + 2 * u, baseY - 11 * u, 3 * u, 8 * u, '#639922', ` rx="${u}"`) +
      r(x, baseY - 8 * u, 2 * u, 3 * u, '#639922', ` rx="${u / 2}"`) +
      r(x + 5 * u, baseY - 9 * u, 2 * u, 3 * u, '#639922', ` rx="${u / 2}"`) +
      r(x, baseY - 3 * u, 7 * u, 3 * u, '#B5543A')
    )
  }
  if (item === 'photo') {
    return (
      r(x, baseY - 8 * u, 8 * u, 7 * u, '#7A5634') +
      r(x + u, baseY - 7 * u, 6 * u, 5 * u, '#B5D4F4') +
      `<circle cx="${x + 4 * u}" cy="${baseY - 4.5 * u}" r="${1.5 * u}" fill="#D97757"/>` +
      r(x + 3 * u, baseY - u, 2 * u, u, '#7A5634')
    )
  }

  return ''
}

function minutes(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const m = Math.floor(total / 60)

  return m > 0 ? `${m} phút ${total % 60} giây` : `${total} giây`
}

const STATUS_LABEL: Record<Status, string> = {
  arriving: 'Đang tới bàn',
  working: 'Đang làm',
  thinking: 'Đang nghĩ',
  waiting: 'Chờ bạn duyệt',
  error: 'Gặp lỗi',
  done: 'Đã xong',
  delivering: 'Đang nộp báo cáo',
  idle: 'Rảnh',
  sleep: 'Đang ngủ',
}

// What a hover over the desk tells: who, what for, and how far along.
function tooltip(desk: Desk, now: number): string {
  const lines = [
    `${desk.name} — ${desk.agentType}${desk.model ? ' · ' + desk.model : ''}`,
    desk.task ? `Việc: ${desk.task}` : '',
    `${STATUS_LABEL[desk.status]}${desk.tool && desk.status === 'working' ? ': ' + desk.tool.name + (desk.tool.arg ? ' ' + desk.tool.arg : '') : ''}`,
    `Đã chạy ${minutes(now - desk.startedAt)} · ${desk.toolCalls} lần gọi tool`,
  ].filter(line => line !== '')

  return `<title>${lines.map(escape).join('&#10;')}</title>`
}

function bell(x: number, y: number, waiting: number): string {
  let out = `<g><path d="M${x - 9} ${y} q0 -14 9 -14 q9 0 9 14 z" fill="#EFA027" stroke="#BA7517"/>` + r(x - 11, y, 22, 3, '#BA7517', ' rx="1"')
  out += `<circle cx="${x}" cy="${y + 4}" r="2.5" fill="#BA7517"/>`
  if (waiting > 0) {
    out += `<animateTransform attributeName="transform" type="rotate" values="0 ${x} ${y - 14};-16 ${x} ${y - 14};14 ${x} ${y - 14};0 ${x} ${y - 14}" dur="0.5s" repeatCount="indefinite"/></g>`
    out += `<circle cx="${x + 11}" cy="${y - 14}" r="8" fill="#E24B4A"/>` + text(x + 11, y - 10, 10, '#FFFFFF', String(waiting), ' text-anchor="middle" font-weight="700"')
  } else {
    out += '</g>'
  }

  return out
}

function chair(x: number, y: number, s: number): string {
  return r(x, y, 10 * s, 11 * s, '#5F5E5A', ` rx="${2 * s}"`) + r(x + s, y + s, 8 * s, 4 * s, '#6E6D68', ` rx="${s}"`)
}

type DeskLook = { s: number; cell: number; font: number; isAnimated: boolean; showModel: boolean }

const LOOK: Record<Exclude<Tier, 'grouped'>, DeskLook> = {
  full: { s: 5, cell: VIEW_WIDTH / 4, font: 11, isAnimated: true, showModel: true },
  compact: { s: 3.5, cell: VIEW_WIDTH / 6, font: 10, isAnimated: false, showModel: false },
}

function rowHeight(look: DeskLook): number {
  return look.font + 18 + 9 * look.s + 9 * look.s + 26
}

// One desk with its top at y; `desk` undefined draws an empty one.
function deskSvg(desk: Desk | undefined, cx: number, y: number, look: DeskLook, now: number): string {
  const { s, cell, font } = look
  const top = y + font + 18
  const spriteX = cx - 13 * s
  const deskTop = top + 9 * s
  let out = chair(spriteX + 3 * s, top + 2 * s, s)
  if (desk !== undefined) {
    out += bubble(desk, cx, y, cell - 10, font, spriteX + 8 * s)
    out += mascot(desk, spriteX, top, s, look.isAnimated)
    out += badge(desk, spriteX + 15 * s, top + s)
  }
  out += monitor(desk, cx + 4 * s, deskTop - 8 * s, 9 * s, 6 * s)
  const left = cx - cell / 2 + 8
  out += r(left, deskTop, cell - 16, 8 * s, '#B98A5E', ' rx="2"') + r(left, deskTop, cell - 16, 2 * s / 2 + 1, '#D2A77C')
  out += r(left + 4, deskTop + 8 * s, 4, 2 * s, '#7A5634') + r(left + cell - 28, deskTop + 8 * s, 4, 2 * s, '#7A5634')
  if (desk !== undefined) out += deskItem(desk.look.desk, left + 3 * s, deskTop + 1, s)

  const labelY = deskTop + 10 * s + 12
  if (desk === undefined) {
    out += text(cx, labelY, font - 1, '#A08A6E', 'Bàn trống', ' text-anchor="middle"')
  } else {
    const name = fit(desk.name, Math.floor(cell / (font * 0.6)))
    out += text(cx, labelY, font, '#3D3B37', name, ' text-anchor="middle" font-weight="600"')
    if (look.showModel && desk.model !== '') {
      out += text(cx, labelY + font + 3, font - 2, '#7A6A55', desk.model, ' text-anchor="middle"')
    }
  }

  return desk === undefined ? out : `<g>${tooltip(desk, now)}${out}</g>`
}

function manager(office: Office, y: number, now: number): string {
  const desk = office.manager
  const s = 6
  const cx = VIEW_WIDTH / 2
  const top = y + 34
  const spriteX = cx - 8 * s
  const deskTop = top + 9 * s
  let out = `<ellipse cx="${cx}" cy="${deskTop + 34}" rx="190" ry="34" fill="#B5543A" opacity="0.28"/>`
  out += chair(spriteX + 3 * s, top + 2 * s, s)
  out += bubble(desk, cx, y, 260, 12, cx)
  out += mascot(desk, spriteX, top, s, true)
  out += badge(desk, spriteX + 17 * s, top + s)
  out += monitor(desk, cx + 52, deskTop - 34, 46, 32)
  out += `<rect x="${cx - 74}" y="${deskTop - 12}" width="12" height="12" rx="2" fill="#FFFFFF"/><rect x="${cx - 63}" y="${deskTop - 9}" width="4" height="6" rx="2" fill="none" stroke="#FFFFFF" stroke-width="2"/>`
  out += r(cx - 120, deskTop, 240, 46, '#E8B64C', ' rx="4" stroke="#B8862B" stroke-width="2"')
  out += r(cx - 120, deskTop, 240, 7, '#F5CF6E', ' rx="3"')
  out += r(cx - 70, deskTop + 18, 140, 20, '#2C2C2A', ' rx="3"')
  out += text(cx, deskTop + 32, 11, '#EFA027', 'CLAUDE · MANAGER', ' text-anchor="middle" font-weight="600" letter-spacing="1"')
  out += deskItem(desk.look.desk, cx + 102, deskTop + 1, 4)
  out += bell(cx - 88, deskTop - 1, counts(office.desks).waiting + (desk.status === 'waiting' ? 1 : 0))

  return `<g>${tooltip(desk, now)}${out}</g>`
}

function room(name: string, desks: Desk[], x: number, y: number, w: number, h: number): string {
  const c = counts(desks)
  let out = r(x, y, w, h, '#F5EBDD', ' rx="8" stroke="#B98A5E"')
  out += text(x + 10, y + 20, 12, '#3D3B37', fit(`${name} ×${desks.length}`, 26), ' font-weight="600"')
  out += text(x + 10, y + 36, 10, '#5F5E5A', `${c.busy} làm · ${c.waiting} chờ bạn · ${c.done} xong`)
  desks.slice(0, 36).forEach((desk, index) => {
    const dx = x + 10 + (index % 12) * 15
    const dy = y + 46 + Math.floor(index / 12) * 15
    const fill = desk.status === 'thinking' ? '#B4B2A9' : STATUS_STYLE[desk.status].ink
    out += r(dx, dy, 11, 11, fill, ' rx="3"')
  })

  return out
}

function lounge(office: Office, y: number): string {
  let out = r(12, y, VIEW_WIDTH - 24, 96, '#E9DCC6', ' rx="10"')
  out += r(32, y + 22, 230, 34, '#7F77DD', ' rx="8"')
  const seated = Math.min(office.breakRoom, 5)
  for (let i = 0; i < seated; i++) {
    out += toSvg(sprite('idle', {}, 0), 44 + i * 42, y + 26, 2)
  }
  out += r(32, y + 48, 230, 26, '#534AB7', ' rx="6"') + r(24, y + 36, 16, 40, '#534AB7', ' rx="6"') + r(254, y + 36, 16, 40, '#534AB7', ' rx="6"')
  if (office.breakRoom > seated) {
    out += text(147, y + 88, 10, '#534AB7', `+${office.breakRoom - seated} người nữa`, ' text-anchor="middle"')
  }

  out += r(300, y + 14, 44, 64, '#444441', ' rx="4"') + r(306, y + 20, 32, 14, '#2C2C2A', ' rx="2"')
  out += `<circle cx="336" cy="${y + 27}" r="2" fill="#E24B4A"/>` + r(314, y + 50, 16, 14, '#FFFFFF', ' rx="2"')
  out += `<path d="M318 ${y + 46} q2 -6 0 -10 M324 ${y + 46} q2 -6 0 -10" stroke="#B4B2A9" stroke-width="1.5" fill="none"><animate attributeName="opacity" values="1;0.2;1" dur="2s" repeatCount="indefinite"/></path>`

  out += `<path d="M366 ${y + 14} h28 v30 h-28 z" fill="#B5D4F4" opacity="0.85"/>` + r(362, y + 44, 36, 36, '#D3D1C7', ' rx="3"')

  out += text(420, y + 40, 14, '#3D3B37', 'Phòng nghỉ', ' font-weight="600"')
  out += text(420, y + 60, 12, '#5F5E5A', `${office.breakRoom} agent đã xong việc`)

  return out
}

export function desktopSvg(office: Office, now: number = Date.now()): string {
  const tier = layoutTier(office.desks.length)
  const managerY = WALL + 8
  const top = managerY + 150
  let body = ''
  let bottom = top

  if (tier === 'grouped') {
    const list = groups(office.desks)
    const w = (VIEW_WIDTH - 40) / 3
    const h = 104
    list.forEach((group, index) => {
      const x = 10 + (index % 3) * (w + 10)
      const y = top + Math.floor(index / 3) * (h + 10)
      body += room(group.name, group.desks, x, y, w, h)
    })
    bottom = top + Math.ceil(list.length / 3) * (h + 10)
  } else {
    const look = LOOK[tier]
    const columns = Math.round(VIEW_WIDTH / look.cell)
    const used = Math.max(...office.desks.map(desk => desk.slot), -1) + 1
    const slots = Math.max(columns, Math.ceil(used / columns) * columns)
    const bySlot = new Map(office.desks.map(desk => [desk.slot, desk]))
    const height = rowHeight(look)
    for (let slot = 0; slot < slots; slot++) {
      const cx = look.cell * (slot % columns) + look.cell / 2
      body += deskSvg(bySlot.get(slot), cx, top + Math.floor(slot / columns) * height, look, now)
    }
    bottom = top + (slots / columns) * height
  }

  const loungeY = bottom + 8
  const height = loungeY + 108

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW_WIDTH} ${height}" width="${VIEW_WIDTH}" height="${height}">` +
    floor(height) +
    wall() +
    plant(VIEW_WIDTH - 60, managerY + 110, office.completed) +
    manager(office, managerY, now) +
    body +
    lounge(office, loungeY) +
    `</svg>`
  )
}

export function desktopHeight(svg: string): number {
  const match = /viewBox="0 0 \d+ (\d+(?:\.\d+)?)"/.exec(svg)

  return match ? Number(match[1]) : 400
}
