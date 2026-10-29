import type { Elements } from 'claude-code'

import type { Desk, Office } from '../types'
import { bubbleText, counts, groups, layoutTier, MANAGER_ID } from './model'
import type { Counts } from './model'
import { desktopSvg, fit, STATUS_STYLE } from './office-svg'
import { RASTER_COLUMNS, RASTER_ROWS, sprite, toRasterCells } from './sprites'

export { ANIMATED } from './office-svg'

export function rasterKey(desk: Desk): string {
  return `d-${desk.agentId}`
}

const SUMMARY: { key: keyof Counts; label: string; color: string }[] = [
  { key: 'busy', label: 'đang làm', color: STATUS_STYLE.working.ink },
  { key: 'waiting', label: 'chờ bạn', color: STATUS_STYLE.waiting.ink },
  { key: 'error', label: 'lỗi', color: STATUS_STYLE.error.ink },
  { key: 'done', label: 'xong', color: STATUS_STYLE.done.ink },
  { key: 'idle', label: 'rảnh', color: STATUS_STYLE.idle.ink },
]

function summaryParts(office: Office) {
  const c = counts(office.desks)

  return SUMMARY.filter(part => part.key === 'busy' || c[part.key] > 0).map(part => ({
    ...part,
    count: c[part.key],
  }))
}

export function summary(office: Office): string {
  return summaryParts(office)
    .map(part => `${part.count} ${part.label}`)
    .join(' · ')
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
      <Text color={STATUS_STYLE[desk.status].term}>{fit(bubbleText(desk), RASTER_COLUMNS + 2)}</Text>
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
      <Text color={STATUS_STYLE[desk.status].term}>●</Text> {fit(desk.name, 16)}{' '}
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

export function desktopTree(
  els: Elements['desktop'],
  office: Office,
  columns: number,
  onView: View,
) {
  const { Box, Text, Button, Svg } = els
  const named = [office.manager, ...[...office.desks].sort((a, b) => a.slot - b.slot)]
  // The pane gives its width in columns; the office scales to fill it.
  const width = Math.round(Math.min(Math.max(columns * 8, 320), 960))
  const isQuiet = office.desks.length === 0

  return (
    <Box flexDirection="column" gap="sm">
      <Box flexDirection="row" flexWrap="wrap" columnGap="md">
        {isQuiet ? (
          <Text size="footnote" dimColor>
            Văn phòng đang yên tĩnh. Bàn sẽ có người khi Claude giao việc cho subagent.
          </Text>
        ) : (
          summaryParts(office).map(part => (
            <Text size="footnote">
              <Text color={part.color}>●</Text> <Text weight="semibold">{part.count}</Text> {part.label}
            </Text>
          ))
        )}
      </Box>
      <Svg
        source={desktopSvg(office)}
        alt={`Văn phòng: manager và ${office.desks.length} subagent. ${summary(office)}`}
        width={width}
        isInteractive
      />
      <Box flexDirection="row" flexWrap="wrap" columnGap="sm" rowGap="xs">
        {named.map(desk => (
          <Button key={desk.agentId} plain onPress={onView(desk.agentId)}>
            <Text color={STATUS_STYLE[desk.status].ink}>●</Text>{' '}
            {desk.agentId === MANAGER_ID ? 'claude' : desk.name}{' '}
            <Text dimColor>{desk.agentId === MANAGER_ID ? 'manager' : desk.model}</Text>
          </Button>
        ))}
      </Box>
    </Box>
  )
}
