import type { Elements } from 'claude-code'

import type { Desk, Look, Office, Styles, WardrobePanel } from '../types'
import { bubbleText, byAttention, counts, groups, layoutTier, MANAGER_ID } from './model'
import type { Counts } from './model'
import { desktopHeight, desktopSvg, fit, STATUS_STYLE, VIEW_WIDTH } from './office-svg'
import { RASTER_COLUMNS, RASTER_ROWS, sprite, toRasterCells, toSvg } from './sprites'
import { itemOptions, previewLook, targetOptions } from './wardrobe'

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
        cells={toRasterCells(sprite(desk.status, desk.look, frame))}
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
    const bySlot = byAttention(office.desks)
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

export type WardrobeUi = {
  panel: WardrobePanel
  styles: Styles
  toggle: () => unknown
  pickTarget: (value: string) => unknown
  pickItem: (value: string) => unknown
  wear: () => unknown
}

function lookPreview(look: Look): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 18 14" width="96" height="72" shape-rendering="crispEdges">` +
    `<rect x="-1" y="-1" width="18" height="14" rx="2" fill="#EFE6D8"/>` +
    toSvg(sprite('idle', look, 0), 0, 0, 1) +
    `</svg>`
  )
}

export function desktopTree(
  els: Elements['desktop'],
  office: Office,
  columns: number,
  onView: View,
  ui: WardrobeUi,
) {
  const { Box, Text, Button, Svg, Select } = els
  const named = [office.manager, ...byAttention(office.desks)]
  // The pane gives its width in columns, not pixels. The interactive frame
  // keeps a default height unless told one, so both sides are set from it.
  const width = Math.round(Math.min(Math.max(columns * 7.5, 280), 1200))
  const svg = desktopSvg(office)
  const height = Math.round((width * desktopHeight(svg)) / VIEW_WIDTH)
  const isQuiet = office.desks.length === 0
  const { panel } = ui

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
        source={svg}
        alt={`Văn phòng: manager và ${office.desks.length} subagent. ${summary(office)}`}
        width={width}
        height={height}
        isInteractive
      />
      <Box flexDirection="row" flexWrap="wrap" columnGap="sm" rowGap="xs">
        {named.map(desk => (
          <Button key={desk.agentId} plain onPress={onView(desk.agentId)}>
            <Text color={STATUS_STYLE[desk.status].ink}>●</Text>{' '}
            {desk.agentId === MANAGER_ID ? 'claude' : desk.name}{' '}
            <Text dimColor>{desk.status === 'waiting' ? 'chờ bạn' : desk.agentId === MANAGER_ID ? 'manager' : desk.model}</Text>
          </Button>
        ))}
        <Button key="wardrobe-toggle" onPress={ui.toggle}>
          {panel.isOpen ? 'Đóng tủ đồ' : 'Tủ đồ'}
        </Button>
      </Box>
      {panel.isOpen && (
        <Box flexDirection="column" gap="sm" borderStyle="round" padding="sm">
          <Box flexDirection="row" gap="md" alignItems="center">
            <Svg
              source={lookPreview(previewLook(office, ui.styles, panel.target, panel.item))}
              alt="Xem trước bộ đồ"
              width={96}
              height={72}
            />
            <Box flexDirection="column" gap="xs" flexGrow={1}>
              <Select
                key="wardrobe-target"
                label="Mặc cho"
                options={targetOptions(office, ui.styles)}
                value={panel.target}
                onSelect={ui.pickTarget}
              />
              <Select
                key="wardrobe-item"
                label="Món đồ"
                options={itemOptions()}
                value={panel.item}
                onSelect={ui.pickItem}
              />
            </Box>
          </Box>
          <Box flexDirection="row" gap="sm" alignItems="center">
            <Button key="wardrobe-wear" variant="primary" onPress={ui.wear}>
              Mặc
            </Button>
            <Text size="footnote" dimColor>
              Đồ chọn cho cả loại agent được nhớ cho các phiên sau.
            </Text>
          </Box>
        </Box>
      )}
    </Box>
  )
}
