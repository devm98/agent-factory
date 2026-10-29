import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Office, Styles, WardrobePanel } from '../types'
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
  waitingCount,
} from './model'
import { ANIMATED, desktopTree, rasterKey, terminalTree } from './scene'
import { RASTER_COLUMNS, RASTER_ROWS, sprite, toRasterCells } from './sprites'
import {
  catalog,
  dress,
  findTarget,
  isItem,
  ITEMS,
  MANAGER_TYPE,
  NONE,
  RESET,
  resolveLook,
  targetLabel,
} from './wardrobe'

const PANE = 'factory-view'
const TITLE = 'Factory View'
const STORE_KEY = 'styles'
// Change a tag when its value's fields change: it declines what an earlier
// version stored, which outlives a reload.
const office = atom({ plugin: 'factory-view', key: 'office' } as const, emptyOffice(0), {
  shape: 'office-2',
})
const styles = atom({ plugin: 'factory-view', key: 'styles' } as const, {} as Styles, {
  shape: 'styles-1',
})
const wardrobe = atom(
  { plugin: 'factory-view', key: 'wardrobe' } as const,
  { isOpen: false, target: 'claude', item: 'beanie' } as WardrobePanel,
  { shape: 'wardrobe-1' },
)

// What the last drawing showed, for the terminal's frame timer; a reload
// starts these over and the next drawing fills them in again.
let frame = 0
let drawnOn: string | undefined
let drawn: Office | undefined
let hasAutoOpened = false
let shownWaiting = 0

// A hook of this mod must never get in the way of Claude's own work: a
// failed write of the office is dropped and the event goes on.
async function quietly(work: () => Promise<unknown>) {
  try {
    await work()
  } catch {
    // The next event redraws the office from what it holds.
  }
}

async function isPaneOpen($: EngineInterface): Promise<boolean> {
  return (await $.ui.panes()).some(pane => pane.id === PANE)
}

// The pane's title counts the agents waiting for the person.
async function refreshTitle($: EngineInterface) {
  const waiting = waitingCount(await read($, office))
  if (waiting === shownWaiting) return
  shownWaiting = waiting
  if (await isPaneOpen($)) {
    await $.ui.open({ id: PANE, title: waiting > 0 ? `${TITLE} · ${waiting} chờ bạn` : TITLE })
  }
}

async function applyDress($: EngineInterface, targetWord: string, item: string): Promise<string> {
  const kept = await read($, styles)
  const target = findTarget(targetWord, await read($, office))
  let nextStyles = kept
  await update($, office, value => {
    const dressed = dress(value, kept, target, item)
    nextStyles = dressed.styles
    return dressed.office
  })
  if (nextStyles !== kept) {
    await update($, styles, () => nextStyles)
    await $.store.set(STORE_KEY, nextStyles)
  }
  const who = targetLabel(target)
  if (item === RESET) return `Đã trả ${who} về bộ đồ mặc định.`
  if (item === NONE) return `Đã bỏ hết đồ của ${who}.`

  return `Đã mặc ${ITEMS[item]?.label ?? item} cho ${who}.`
}

const HELP = [
  '/factory: mở hoặc đóng văn phòng.',
  '/factory dress <ai> <món>: mặc đồ. <ai> là claude, tên một agent, một loại agent (Explore, Plan…) hoặc all.',
  '  Món "none" bỏ hết đồ, "reset" về mặc định. Đồ cho cả loại agent được nhớ qua các phiên.',
  '/factory wardrobe: mở tủ đồ trong pane và xem danh sách món.',
].join('\n')

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'factory',
      description: 'Văn phòng Factory View: mở/đóng, mặc đồ cho agent (dress), tủ đồ (wardrobe)',
    })

    await quietly(async () => {
      const saved = await $.store.get(STORE_KEY)
      if (saved === null || typeof saved !== 'object') return
      const kept = saved as Styles
      await update($, styles, () => kept)
      await update($, office, value => ({
        ...value,
        manager: { ...value.manager, look: resolveLook(MANAGER_TYPE, kept) },
      }))
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
          cells: toRasterCells(sprite(desk.status, desk.look, frame)),
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
        await refreshTitle($)
      })
    })

    return next(e)
  })

  on('command.run', { command: 'factory' }, async ($, e) => {
    const words = e.args.trim().split(/\s+/).filter(word => word !== '')
    const verb = words[0]?.toLowerCase()

    if (verb === undefined) {
      if (await isPaneOpen($)) {
        await $.ui.close({ id: PANE })

        return { text: 'Đã đóng Factory View.' }
      }
      await $.ui.open({ id: PANE, title: TITLE })

      return { text: 'Đã mở Factory View.' }
    }

    if (verb === 'dress' || verb === 'mặc') {
      const item = words.at(-1)?.toLowerCase() ?? ''
      const targetWord = words.slice(1, -1).join(' ')
      if (targetWord === '') return { text: `Cách dùng: /factory dress <ai> <món>\n\nCác món:\n${catalog()}` }
      if (!isItem(item)) return { text: `Không có món "${item}". Các món:\n${catalog()}` }

      return { text: await applyDress($, targetWord, item) }
    }

    if (verb === 'wardrobe' || verb === 'tủ') {
      await update($, wardrobe, panel => ({ ...panel, isOpen: true }))
      await $.ui.open({ id: PANE, title: TITLE })

      return { text: `Đã mở tủ đồ trong Factory View.\n\nCác món:\n${catalog()}` }
    }

    return { text: HELP }
  })

  on('agent.spawn', async ($, e, next) => {
    const started = await next(e)
    const agentId = started.agentId
    if (agentId === undefined) return started

    await quietly(async () => {
      const look = resolveLook(e.subagentType, await read($, styles))
      await update($, office, value =>
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
            look,
          },
          Date.now(),
        ),
      )
    })
    if (!hasAutoOpened) {
      hasAutoOpened = true
      await quietly(async () => {
        if (!(await isPaneOpen($))) await $.ui.open({ id: PANE, title: TITLE })
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
    await quietly(async () => {
      await update($, office, value => toolEnd(value, e.agentId, isError, Date.now()))
      if (shownWaiting > 0) await refreshTitle($)
    })

    return ran
  })

  on('tool.check', async ($, e, next) => {
    const verdict = await next(e)
    // Only a real call that someone will be asked about makes the agent wait.
    if (verdict.decision === 'ask' && e.tool_use_id !== undefined && e.approver !== undefined) {
      await quietly(async () => {
        let newlyWaiting: string | undefined
        await update($, office, value => {
          const before = e.agentId === undefined ? value.manager : value.desks.find(desk => desk.agentId === e.agentId)
          const after = askStart(value, e.agentId, Date.now())
          newlyWaiting = before !== undefined && before.status !== 'waiting' ? before.name : undefined
          return after
        })
        if (newlyWaiting !== undefined) {
          const who = e.agentId === undefined ? 'Claude' : newlyWaiting
          $.ui.toast(`${who} đang chờ bạn duyệt ${e.tool}`, { timeoutMs: 8000 })
        }
        await refreshTitle($)
      })
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
    if (e.surface === 'desktop') {
      return desktopTree($.ui.resolve(e), current, e.props.bodyColumns, onView, {
        panel: await read($, wardrobe),
        styles: await read($, styles),
        toggle: () => update($, wardrobe, panel => ({ ...panel, isOpen: !panel.isOpen })),
        pickTarget: value => update($, wardrobe, panel => ({ ...panel, target: value })),
        pickItem: value => update($, wardrobe, panel => ({ ...panel, item: value })),
        wear: async () => {
          const panel = await read($, wardrobe)
          $.ui.toast(await applyDress($, panel.target, panel.item))
        },
      })
    }

    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="column">
        <Text>Factory View chỉ vẽ trên terminal và desktop.</Text>
      </Box>
    )
  })
}
