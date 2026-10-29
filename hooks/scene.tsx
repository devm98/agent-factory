import type { Elements } from 'claude-code'

import type { Desk, Office, Status } from '../types'
import { bubbleText, counts, groups, layoutTier, MANAGER_ID } from './model'
import type { Tier } from './model'
import { RASTER_COLUMNS, RASTER_ROWS, sprite, toRasterCells, toSvg } from './sprites'

export const ANIMATED: readonly Status[] = ['working', 'thinking', 'idle', 'arriving', 'delivering']

const BUBBLE: Record<Status, { fill: string; ink: string; term: string }> = {
  arriving: { fill: '#F1EFE8', ink: '#5F5E5A', term: 'subtle' },
  working: { fill: '#E6F1FB', ink: '#0C447C', term: 'suggestion' },
  thinking: { fill: '#F1EFE8', ink: '#444441', term: 'subtle' },
  waiting: { fill: '#FAEEDA', ink: '#633806', term: 'warning' },
  error: { fill: '#FCEBEB', ink: '#791F1F', term: 'error' },
  done: { fill: '#EAF3DE', ink: '#27500A', term: 'success' },
  delivering: { fill: '#EAF3DE', ink: '#27500A', term: 'success' },
  idle: { fill: '#F1EFE8', ink: '#888780', term: 'inactive' },
  sleep: { fill: '#F1EFE8', ink: '#888780', term: 'inactive' },
}

export function rasterKey(desk: Desk): string {
  return `d-${desk.agentId}`
}

export function summary(office: Office): string {
  const c = counts(office.desks)
  const parts = [`${c.busy} đang làm`]
  if (c.waiting > 0) parts.push(`${c.waiting} chờ bạn`)
  if (c.error > 0) parts.push(`${c.error} lỗi`)
  if (c.done > 0) parts.push(`${c.done} xong`)
  if (c.idle > 0) parts.push(`${c.idle} rảnh`)

  return parts.join(' · ')
}

function escape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function fit(text: string, room: number): string {
  return text.length > room ? text.slice(0, Math.max(1, room - 1)) + '…' : text
}

// ---- desktop: one SVG for the whole office --------------------------------

const VIEW_WIDTH = 480
const WALL = 72

function bubbleSvg(desk: Desk, cx: number, y: number, maxWidth: number, size: number): string {
  const style = BUBBLE[desk.status]
  const room = Math.floor((maxWidth - 10) / (size * 0.56))
  const text = fit(bubbleText(desk), room)
  const width = Math.min(maxWidth, text.length * size * 0.56 + 12)
  const height = size + 8

  return (
    `<rect x="${cx - width / 2}" y="${y}" width="${width}" height="${height}" rx="4" fill="${style.fill}"/>` +
    `<text x="${cx}" y="${y + size + 2}" font-size="${size}" text-anchor="middle" fill="${style.ink}" font-family="sans-serif">${escape(text)}</text>`
  )
}

function mascotSvg(desk: Desk, x: number, y: number, scale: number, isAnimated: boolean): string {
  if (!isAnimated || !ANIMATED.includes(desk.status)) {
    const still = toSvg(sprite(desk.status, desk.outfit, 0), x, y, scale)
    if (desk.status === 'done') {
      return `<g>${still}<animateTransform attributeName="transform" type="translate" values="0 0;0 -${scale};0 0" dur="0.8s" repeatCount="indefinite"/></g>`
    }

    return still
  }
  const period = desk.status === 'working' ? 0.5 : desk.status === 'thinking' || desk.status === 'idle' ? 1.6 : 0.6
  const frames = [0, 1].map(
    frame =>
      `<g opacity="${frame === 0 ? 1 : 0}">${toSvg(sprite(desk.status, desk.outfit, frame), x, y, scale)}` +
      `<animate attributeName="opacity" values="${frame === 0 ? '1;0' : '0;1'}" dur="${period}s" calcMode="discrete" repeatCount="indefinite"/></g>`,
  )

  return frames.join('')
}

function monitorSvg(desk: Desk, x: number, y: number, w: number, h: number): string {
  const id = `m${desk.agentId.replace(/[^a-zA-Z0-9]/g, '')}`
  let out = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="#5F5E5A"/>`
  out += `<rect x="${x + w / 2 - 2}" y="${y + h}" width="4" height="4" fill="#5F5E5A"/>`
  const screen = desk.status === 'sleep' ? '#2C2C2A' : desk.status === 'error' ? '#791F1F' : '#2C3E35'
  out += `<rect x="${x + 2}" y="${y + 2}" width="${w - 4}" height="${h - 4}" fill="${screen}"/>`
  if (desk.status === 'working') {
    out += `<clipPath id="${id}"><rect x="${x + 2}" y="${y + 2}" width="${w - 4}" height="${h - 4}"/></clipPath><g clip-path="url(#${id})"><g>`
    for (let line = 0; line < 8; line++) {
      const width = ((line * 7) % 5) + 3
      out += `<rect x="${x + 4}" y="${y + 4 + line * 3}" width="${Math.min(width * 2, w - 8)}" height="1.5" fill="#5DCAA5"/>`
    }
    out += `<animateTransform attributeName="transform" type="translate" values="0 0;0 -12" dur="1.2s" repeatCount="indefinite"/></g></g>`
  } else if (desk.status === 'error') {
    out += `<circle cx="${x + w / 2}" cy="${y - 4}" r="3" fill="#B4B2A9"><animate attributeName="cy" values="${y - 2};${y - 14}" dur="1.4s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.9;0" dur="1.4s" repeatCount="indefinite"/></circle>`
  }

  return out
}

function zzzSvg(x: number, y: number): string {
  return ['z', 'Z'].map((letter, index) =>
    `<text x="${x + index * 6}" y="${y}" font-size="${9 + index * 3}" fill="#888780" font-family="sans-serif">${letter}` +
    `<animate attributeName="y" values="${y};${y - 14}" dur="2s" begin="${index}s" repeatCount="indefinite"/>` +
    `<animate attributeName="opacity" values="1;0" dur="2s" begin="${index}s" repeatCount="indefinite"/></text>`,
  ).join('')
}

function roomSvg(office: Office, height: number): string {
  let out = `<rect width="${VIEW_WIDTH}" height="${height}" fill="#D9BC94"/>`
  for (let y = WALL + 22; y < height; y += 22) {
    out += `<rect x="0" y="${y}" width="${VIEW_WIDTH}" height="1" fill="#C9A77C"/>`
  }
  out += `<rect width="${VIEW_WIDTH}" height="${WALL}" fill="#EDE3D3"/>`
  out += `<rect y="${WALL - 4}" width="${VIEW_WIDTH}" height="4" fill="#B98A5E"/>`
  for (const x of [24, 96]) {
    out += `<rect x="${x}" y="12" width="56" height="40" fill="#B5D4F4" stroke="#FFFFFF" stroke-width="3"/>`
    out += `<rect x="${x + 27}" y="12" width="2" height="40" fill="#FFFFFF"/>`
  }
  const clockX = VIEW_WIDTH - 44
  out += `<circle cx="${clockX}" cy="30" r="14" fill="#FFFFFF" stroke="#5F5E5A" stroke-width="2"/>`
  out += `<rect x="${clockX - 1}" y="20" width="2" height="10" fill="#2C2C2A"><animateTransform attributeName="transform" type="rotate" from="0 ${clockX} 30" to="360 ${clockX} 30" dur="10s" repeatCount="indefinite"/></rect>`
  out += `<rect x="${clockX - 1}" y="23" width="2" height="7" fill="#993C1D"><animateTransform attributeName="transform" type="rotate" from="0 ${clockX} 30" to="360 ${clockX} 30" dur="120s" repeatCount="indefinite"/></rect>`
  const plant = 14 + Math.min(office.completed, 12) * 3
  const potX = VIEW_WIDTH - 90
  out += `<rect x="${potX + 4}" y="${WALL - 4 - plant}" width="3" height="${plant}" fill="#3B6D11"/>`
  for (let leaf = 0; leaf < Math.min(1 + Math.floor(office.completed / 2), 7); leaf++) {
    const side = leaf % 2 === 0 ? -7 : 7
    out += `<ellipse cx="${potX + 5 + side}" cy="${WALL - 8 - leaf * 5}" rx="6" ry="3" fill="#639922"/>`
  }
  out += `<rect x="${potX - 2}" y="${WALL - 8}" width="16" height="14" fill="#993C1D"/>`

  return out
}

function managerSvg(office: Office, y: number): string {
  const desk = office.manager
  const cx = VIEW_WIDTH / 2
  let out = bubbleSvg(desk, cx, y, 200, 11)
  out += mascotSvg(desk, cx - 32, y + 22, 4, true)
  out += `<rect x="${cx - 70}" y="${y + 62}" width="140" height="30" rx="3" fill="#E8B64C" stroke="#B8862B" stroke-width="2"/>`
  out += `<rect x="${cx - 70}" y="${y + 62}" width="140" height="5" fill="#F5CF6E"/>`
  out += monitorSvg(desk, cx + 40, y + 40, 26, 20)
  out += `<text x="${cx}" y="${y + 84}" font-size="10" text-anchor="middle" fill="#633806" font-family="sans-serif">claude · manager</text>`
  if (desk.status === 'sleep') out += zzzSvg(cx + 30, y + 28)

  return out
}

function deskSvg(desk: Desk, cx: number, y: number, cell: number, tier: Tier): string {
  const isFull = tier === 'full'
  const scale = isFull ? 3 : 2
  const spriteW = 16 * scale
  const spriteX = cx - spriteW / 2 - (isFull ? 8 : 6)
  let out = bubbleSvg(desk, cx, y, cell - 6, isFull ? 10 : 9)
  out += mascotSvg(desk, spriteX, y + 20, scale, isFull)
  const deskY = y + 20 + 9 * scale
  out += `<rect x="${cx - cell / 2 + 8}" y="${deskY}" width="${cell - 16}" height="${isFull ? 20 : 14}" rx="2" fill="#B98A5E"/>`
  out += `<rect x="${cx - cell / 2 + 8}" y="${deskY}" width="${cell - 16}" height="3" fill="#CFA57A"/>`
  out += monitorSvg(desk, spriteX + spriteW + 2, deskY - (isFull ? 16 : 12), isFull ? 22 : 16, isFull ? 16 : 12)
  const label = fit(isFull ? `${desk.name} · ${desk.model}` : desk.name, Math.floor(cell / 5.5))
  out += `<text x="${cx}" y="${deskY + (isFull ? 32 : 24)}" font-size="${isFull ? 10 : 9}" text-anchor="middle" fill="#444441" font-family="sans-serif">${escape(label)}</text>`
  if (desk.status === 'sleep') out += zzzSvg(spriteX + spriteW - 4, y + 22)

  return out
}

function groupSvg(name: string, desks: Desk[], x: number, y: number, w: number, h: number): string {
  const c = counts(desks)
  let out = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="#F5EBDD" stroke="#B98A5E"/>`
  out += `<text x="${x + 8}" y="${y + 16}" font-size="11" fill="#444441" font-family="sans-serif">${escape(fit(`${name} ×${desks.length}`, 24))}</text>`
  const line = `${c.busy} làm · ${c.waiting} chờ · ${c.done} xong`
  out += `<text x="${x + 8}" y="${y + 30}" font-size="9" fill="#5F5E5A" font-family="sans-serif">${line}</text>`
  desks.slice(0, 30).forEach((desk, index) => {
    const dx = x + 8 + (index % 10) * 13
    const dy = y + 38 + Math.floor(index / 10) * 13
    out += `<rect x="${dx}" y="${dy}" width="10" height="10" rx="2" fill="${desk.status === 'thinking' ? '#B4B2A9' : BUBBLE[desk.status].ink}"/>`
  })

  return out
}

export function desktopSvg(office: Office): string {
  const tier = layoutTier(office.desks.length)
  const managerY = WALL + 6
  const top = managerY + 104
  let body = ''
  let bottom = top

  if (tier === 'grouped') {
    const list = groups(office.desks)
    const w = (VIEW_WIDTH - 40) / 3
    const h = 90
    list.forEach((group, index) => {
      const x = 10 + (index % 3) * (w + 10)
      const y = top + Math.floor(index / 3) * (h + 10)
      body += groupSvg(group.name, group.desks, x, y, w, h)
    })
    bottom = top + Math.ceil(list.length / 3) * (h + 10)
  } else {
    const columns = tier === 'full' ? 4 : 6
    const cell = VIEW_WIDTH / columns
    const rowHeight = tier === 'full' ? 120 : 84
    const rows = Math.max(...office.desks.map(desk => desk.slot), -1) + 1
    for (const desk of office.desks) {
      const cx = cell * (desk.slot % columns) + cell / 2
      const y = top + Math.floor(desk.slot / columns) * rowHeight
      body += deskSvg(desk, cx, y, cell, tier)
    }
    bottom = top + Math.ceil(rows / columns) * rowHeight
  }

  const lounge = bottom + 6
  body += `<rect x="12" y="${lounge}" width="120" height="22" rx="6" fill="#7F77DD"/><rect x="12" y="${lounge + 14}" width="120" height="10" rx="3" fill="#534AB7"/>`
  body += `<text x="144" y="${lounge + 16}" font-size="11" fill="#444441" font-family="sans-serif">Phòng nghỉ: ${office.breakRoom} agent đã xong</text>`
  const height = lounge + 36

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW_WIDTH} ${height}" width="${VIEW_WIDTH}" height="${height}" shape-rendering="crispEdges">` +
    roomSvg(office, height) +
    managerSvg(office, managerY) +
    body +
    `</svg>`
  )
}

// ---- terminal: desks of Text and Raster ------------------------------------

type View = (agentId: string) => () => unknown

export function terminalTree(
  els: Elements['terminal'],
  office: Office,
  frame: number,
  onView: View,
) {
  const { Box, Text, Button, Raster } = els
  const tier = layoutTier(office.desks.length)

  const fullDesk = (desk: Desk, isManager: boolean) => (
    <Box
      flexDirection="column"
      width={RASTER_COLUMNS + 4}
      paddingX={1}
      borderStyle={isManager ? 'round' : undefined}
      borderColor={isManager ? '#EFA027' : undefined}
    >
      <Text color={BUBBLE[desk.status].term}>{fit(bubbleText(desk), RASTER_COLUMNS + 2)}</Text>
      <Raster
        key={rasterKey(desk)}
        columns={RASTER_COLUMNS}
        rows={RASTER_ROWS}
        cells={toRasterCells(sprite(desk.status, desk.outfit, frame))}
      />
      <Button key={desk.agentId} plain onPress={onView(desk.agentId)}>
        {fit(desk.name, RASTER_COLUMNS - 4)} <Text dimColor>{isManager ? 'boss' : desk.model}</Text>
      </Button>
    </Box>
  )

  const row = (desk: Desk) => (
    <Button key={desk.agentId} plain onPress={onView(desk.agentId)}>
      <Text color={BUBBLE[desk.status].term}>●</Text> {fit(desk.name, 16)}{' '}
      <Text dimColor>{fit(bubbleText(desk), 28)}</Text>
    </Button>
  )

  let floor
  if (tier === 'full') {
    const bySlot = [...office.desks].sort((a, b) => a.slot - b.slot)
    floor = (
      <Box flexDirection="row" flexWrap="wrap" columnGap={1} rowGap={1}>
        {bySlot.map(desk => fullDesk(desk, false))}
      </Box>
    )
  } else if (tier === 'compact') {
    const bySlot = [...office.desks].sort((a, b) => a.slot - b.slot)
    floor = <Box flexDirection="column">{bySlot.map(row)}</Box>
  } else {
    floor = (
      <Box flexDirection="column">
        {groups(office.desks).map(group => {
          const c = counts(group.desks)
          const waiting = group.desks.filter(desk => desk.status === 'waiting')

          return (
            <Box flexDirection="column">
              <Text>
                {group.name} ×{group.desks.length}{' '}
                <Text dimColor>
                  — {c.busy} làm · {c.waiting} chờ bạn · {c.done} xong
                </Text>
              </Text>
              {waiting.map(row)}
            </Box>
          )
        })}
      </Box>
    )
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Text dimColor>{summary(office)}</Text>
      <Box flexDirection="row" justifyContent="center">
        {fullDesk(office.manager, true)}
      </Box>
      {office.desks.length === 0 ? (
        <Text dimColor>Chưa có subagent nào. Khi Claude giao việc, bàn mới sẽ xuất hiện ở đây.</Text>
      ) : (
        floor
      )}
      <Text dimColor>Phòng nghỉ: {office.breakRoom} agent đã xong</Text>
    </Box>
  )
}

export function desktopTree(els: Elements['desktop'], office: Office, onView: View) {
  const { Box, Text, Button, Svg } = els
  const named = [office.manager, ...[...office.desks].sort((a, b) => a.slot - b.slot)]

  return (
    <Box flexDirection="column" gap="sm">
      <Text size="footnote" dimColor>
        {summary(office)}
      </Text>
      <Svg
        source={desktopSvg(office)}
        alt={`Văn phòng: manager và ${office.desks.length} subagent. ${summary(office)}`}
        isInteractive
      />
      <Box flexDirection="row" flexWrap="wrap" columnGap="sm">
        {named.map(desk => (
          <Button key={desk.agentId} plain onPress={onView(desk.agentId)}>
            <Text color={BUBBLE[desk.status].ink}>●</Text> {desk.agentId === MANAGER_ID ? 'claude' : desk.name}
          </Button>
        ))}
      </Box>
    </Box>
  )
}
