import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Office } from '../types'
import {
  askStart,
  emptyOffice,
  layoutTier,
  MANAGER_ID,
  spawn,
  tick,
  toolArg,
  toolEnd,
  toolStart,
  turnEnd,
  turnStart,
} from './model'
import { ANIMATED, desktopTree, rasterKey, terminalTree } from './scene'
import { RASTER_COLUMNS, RASTER_ROWS, sprite, toRasterCells } from './sprites'

const PANE = 'factory-view'
const TITLE = 'Factory View'
// Change the tag when Office's fields change: it declines what an earlier
// version stored, which outlives a reload.
const office = atom({ plugin: 'factory-view', key: 'office' } as const, emptyOffice(0), {
  shape: 'office-1',
})

// What the last drawing showed, for the terminal's frame timer; a reload
// starts these over and the next drawing fills them in again.
let frame = 0
let drawnOn: string | undefined
let drawn: Office | undefined
let hasAutoOpened = false

// A hook of this mod must never get in the way of Claude's own work: a
// failed write of the office is dropped and the event goes on.
async function quietly(work: () => Promise<unknown>) {
  try {
    await work()
  } catch {
    // The next event redraws the office from what it holds.
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'factory',
      description: 'Mở hoặc đóng văn phòng Factory View',
    })

    $.clock.every(500, () => {
      frame = 1 - frame
      if (drawnOn !== 'terminal' || drawn === undefined) return
      if (layoutTier(drawn.desks.length) !== 'full') return
      for (const desk of [drawn.manager, ...drawn.desks]) {
        if (!ANIMATED.includes(desk.status)) continue
        void $.ui.blit({
          requestId: PANE,
          key: rasterKey(desk),
          cells: toRasterCells(sprite(desk.status, desk.outfit, frame)),
          columns: RASTER_COLUMNS,
          rows: RASTER_ROWS,
        })
      }
    })

    $.clock.every(2000, () => {
      void quietly(async () => {
        const now = Date.now()
        const current = await read($, office)
        if (tick(current, now) !== current) await update($, office, value => tick(value, now))
      })
    })

    return next(e)
  })

  on('command.run', { command: 'factory' }, async $ => {
    const isOpen = (await $.ui.panes()).some(pane => pane.id === PANE)
    if (isOpen) {
      await $.ui.close({ id: PANE })

      return { text: 'Đã đóng Factory View.' }
    }
    await $.ui.open({ id: PANE, title: TITLE })

    return { text: 'Đã mở Factory View.' }
  })

  on('agent.spawn', async ($, e, next) => {
    const started = await next(e)
    const agentId = started.agentId
    if (agentId === undefined) return started

    await quietly(() =>
      update($, office, value =>
        spawn(
          value,
          {
            agentId,
            name: e.name,
            description: e.description,
            agentType: e.subagentType,
            model: started.model,
            isResident: e.isTeammate === true,
            workflowRunId: e.workflow?.runId || undefined,
          },
          Date.now(),
        ),
      ),
    )
    if (!hasAutoOpened) {
      hasAutoOpened = true
      await quietly(async () => {
        const isOpen = (await $.ui.panes()).some(pane => pane.id === PANE)
        if (!isOpen) await $.ui.open({ id: PANE, title: TITLE })
      })
    }

    return started
  })

  on('turn.start', async ($, e, next) => {
    await quietly(() => update($, office, value => turnStart(value, e.agentId, Date.now())))

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const ended = await next(e)
    await quietly(() => update($, office, value => turnEnd(value, e.agentId, e.reason, Date.now())))

    return ended
  })

  on('tool.call', async ($, e, next) => {
    const arg = toolArg(e as unknown as Record<string, unknown>)
    await quietly(() => update($, office, value => toolStart(value, e.agentId, e.tool, arg, Date.now())))
    const ran = await next(e)
    const isError = 'isError' in ran && ran.isError === true
    await quietly(() => update($, office, value => toolEnd(value, e.agentId, isError, Date.now())))

    return ran
  })

  on('tool.check', async ($, e, next) => {
    const verdict = await next(e)
    // Only a real call that someone will be asked about makes the agent wait.
    if (verdict.decision === 'ask' && e.tool_use_id !== undefined && e.approver !== undefined) {
      await quietly(() => update($, office, value => askStart(value, e.agentId, Date.now())))
    }

    return verdict
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const current = await read($, office)
    drawn = current
    drawnOn = e.surface
    const onView = (agentId: string) => () =>
      $.ui.view(agentId === MANAGER_ID ? {} : { agentId })

    if (e.surface === 'terminal') return terminalTree($.ui.resolve(e), current, frame, onView)
    if (e.surface === 'desktop') return desktopTree($.ui.resolve(e), current, e.props.bodyColumns, onView)

    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="column">
        <Text>Factory View chỉ vẽ trên terminal và desktop.</Text>
      </Box>
    )
  })
}
