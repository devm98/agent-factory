import { describe, expect, test } from 'claude-code/testing'

import {
  askStart,
  emptyOffice,
  byAttention,
  layoutTier,
  spawn,
  tick,
  TIMING,
  toolArg,
  toolEnd,
  toolStart,
  turnEnd,
} from '../hooks/model'
import { desktopSvg } from '../hooks/office-svg'
import { dress, findTarget, previewLook, resolveLook } from '../hooks/wardrobe'
import { RASTER_COLUMNS, RASTER_ROWS, sprite, toRasterCells } from '../hooks/sprites'

const EXPLORE = {
  agentId: 'a1',
  description: 'scan auth',
  agentType: 'Explore',
  model: 'claude-haiku-5-5',
  isResident: false,
  look: resolveLook('Explore', {}),
}

describe('the office model', () => {
  test('a subagent walks in, works, finishes and leaves for the break room', async () => {
    let office = spawn(emptyOffice(0), EXPLORE, 0)
    expect(office.desks[0]?.status).toBe('arriving')
    expect(office.desks[0]?.look).toEqual({ head: 'explorer' })
    expect(office.desks[0]?.model).toBe('haiku')

    office = tick(office, TIMING.arriving)
    expect(office.desks[0]?.status).toBe('thinking')

    office = toolStart(office, 'a1', 'Grep', 'auth', 2000)
    office = toolEnd(office, 'a1', false, 2100)
    office = toolStart(office, 'a1', 'Grep', 'login', 2200)
    expect(office.desks[0]?.status).toBe('working')
    expect(office.desks[0]?.toolCalls).toBe(2)
    expect(office.desks[0]?.tool).toEqual({ name: 'Grep', arg: 'login', count: 2 })

    office = toolEnd(office, 'a1', false, 2300)
    office = turnEnd(office, 'a1', 'answer', 3000)
    expect(office.desks[0]?.status).toBe('done')

    office = tick(office, 3000 + TIMING.celebrate)
    expect(office.desks[0]?.status).toBe('delivering')
    office = tick(office, 3000 + TIMING.celebrate + TIMING.deliver)
    expect(office.desks.length).toBe(0)
    expect(office.breakRoom).toBe(1)
    expect(office.completed).toBe(1)
  })

  test('two failed tools in a row show an error, a good one clears it', async () => {
    let office = spawn(emptyOffice(0), EXPLORE, 0)
    office = toolEnd(toolStart(office, 'a1', 'Read', 'a.ts', 1), 'a1', true, 2)
    expect(office.desks[0]?.status).toBe('thinking')
    office = toolEnd(toolStart(office, 'a1', 'Read', 'a.ts', 3), 'a1', true, 4)
    expect(office.desks[0]?.status).toBe('error')
    office = toolEnd(toolStart(office, 'a1', 'Read', 'b.ts', 5), 'a1', false, 6)
    expect(office.desks[0]?.status).toBe('thinking')
  })

  test('a call waiting for approval marks the desk, and the manager when it is main', async () => {
    let office = spawn(emptyOffice(0), EXPLORE, 0)
    office = askStart(office, 'a1', 10)
    office = askStart(office, undefined, 10)
    expect(office.desks[0]?.status).toBe('waiting')
    expect(office.manager.status).toBe('waiting')
  })

  test('a teammate stays at its desk and dozes off', async () => {
    let office = spawn(emptyOffice(0), { ...EXPLORE, isResident: true }, 0)
    office = turnEnd(office, 'a1', 'answer', 100)
    expect(office.desks[0]?.status).toBe('idle')
    office = tick(office, 100 + TIMING.sleepAfter)
    expect(office.desks[0]?.status).toBe('sleep')
  })

  test('slots stay put and a freed slot is reused', async () => {
    let office = emptyOffice(0)
    for (const id of ['a', 'b', 'c']) office = spawn(office, { ...EXPLORE, agentId: id }, 0)
    office = turnEnd(office, 'b', 'answer', 0)
    office = tick(tick(office, TIMING.celebrate), TIMING.celebrate + TIMING.deliver)
    office = spawn(office, { ...EXPLORE, agentId: 'd' }, 0)
    expect(office.desks.map(desk => [desk.agentId, desk.slot])).toEqual([['a', 0], ['c', 2], ['d', 1]])
  })

  test('the layout tightens as the office fills', async () => {
    expect([8, 9, 24, 25].map(layoutTier)).toEqual(['full', 'compact', 'compact', 'grouped'])
  })

  test('a bubble shows a short argument', async () => {
    expect(toolArg({ file_path: 'C:\\src\\auth\\login.ts' })).toBe('login.ts')
    expect(toolArg({ command: 'npm test\nnpm run lint' })).toBe('npm test')
  })
})

describe('the wardrobe', () => {
  test('dressing a type is kept for the type and dresses its desks now', async () => {
    let office = spawn(emptyOffice(0), EXPLORE, 0)
    office = spawn(office, { ...EXPLORE, agentId: 'p1', agentType: 'Plan', look: resolveLook('Plan', {}) }, 0)
    const dressed = dress(office, {}, findTarget('explore', office), 'beanie')
    expect(dressed.styles).toEqual({ explore: { head: 'beanie' } })
    expect(dressed.office.desks.map(desk => desk.look)).toEqual([{ head: 'beanie' }, { hand: 'blueprint' }])
    expect(resolveLook('Explore', dressed.styles)).toEqual({ head: 'beanie' })
  })

  test('a desk is dressed alone, and none and reset undo it', async () => {
    let office = spawn(emptyOffice(0), EXPLORE, 0)
    office = spawn(office, { ...EXPLORE, agentId: 'a2', description: 'other' }, 0)
    const one = dress(office, {}, findTarget('scan auth', office), 'shades')
    expect(one.styles).toEqual({})
    expect(one.office.desks.map(desk => desk.look)).toEqual([{ head: 'explorer', face: 'shades' }, { head: 'explorer' }])
    const bare = dress(one.office, {}, findTarget('a1', one.office), 'none')
    expect(bare.office.desks[0]?.look).toEqual({})
    const back = dress(bare.office, {}, findTarget('a1', bare.office), 'reset')
    expect(back.office.desks[0]?.look).toEqual({ head: 'explorer' })
  })

  test('Claude keeps a crown and tie until dressed otherwise', async () => {
    const office = emptyOffice(0)
    expect(office.manager.look).toEqual({ head: 'crown', neck: 'tie' })
    const dressed = dress(office, {}, findTarget('claude', office), 'party')
    expect(dressed.office.manager.look).toEqual({ head: 'party', neck: 'tie' })
    expect(dressed.styles).toEqual({ manager: { head: 'party' } })
    expect(previewLook(office, {}, 'claude', 'cat')).toEqual({ head: 'crown', neck: 'tie', desk: 'cat' })
  })

  test('agents waiting for the person come first in a list', async () => {
    let office = emptyOffice(0)
    for (const id of ['a', 'b', 'c']) office = spawn(office, { ...EXPLORE, agentId: id }, 0)
    office = askStart(office, 'c', 1)
    expect(byAttention(office.desks).map(desk => desk.agentId)).toEqual(['c', 'a', 'b'])
  })
})

describe('drawing', () => {
  test('a mascot fills a raster exactly', async () => {
    const cells = toRasterCells(sprite('working', { head: 'beanie', face: 'shades', neck: 'scarf', hand: 'coffee' }, 1))
    expect(cells.length).toBe((RASTER_COLUMNS * RASTER_ROWS * 12 * 4) / 3)
  })

  test('a crowded office stays inside the Svg size limit', async () => {
    for (const count of [8, 24, 60]) {
      let office = emptyOffice(0)
      for (let i = 0; i < count; i++) {
        office = toolStart(spawn(office, { ...EXPLORE, agentId: `a${i}` }, 0), `a${i}`, 'Grep', 'auth', 1)
      }
      expect(desktopSvg(office).length < 131072).toBe(true)
    }
  })
})

const PANE = {
  plugin: 'factory-view',
  component: 'Pane',
  requestId: 'factory-view',
  props: {
    title: 'Factory View',
    isFocused: false,
    bodyColumns: 80,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

test('a spawned agent gets a desk on both surfaces', async ($, on) => {
  on('command.register', () => ({ value: { command: 'factory' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('agent.spawn', () => ({ model: 'claude-haiku-5-5', agentId: 'a1' }))
  on('tool.call', () => ({ result: {} }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.agent.spawn({
    tool_use_id: 'tu1',
    prompt: 'Find the auth code',
    description: 'scan auth',
    subagentType: 'Explore',
    provider: { plugin: 'engine', tier: 'core' },
    parentModel: 'claude-opus-5-5',
    background: false,
    fork: false,
  })
  await $.tool.call({ tool: 'Grep', pattern: 'auth', agentId: 'a1' })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Button', key: 'a1' })).toBeDefined()
    expect((await ui.find({ type: 'Text', text: /đang làm/ }))?.text).toContain('1 đang làm')
    await ui.unmount()
  }
})

test('the dress command and the wardrobe panel dress agents', async ($, on) => {
  const kept = new Map<string, unknown>()
  on('store.get', (_, e) => ({ value: kept.get(e.key) }))
  on('store.set', (_, e) => (kept.set(e.key, e.value), { value: undefined }))
  on('command.register', () => ({ value: { command: 'factory' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('agent.spawn', () => ({ model: 'claude-haiku-5-5', agentId: 'a1' }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.agent.spawn({
    tool_use_id: 'tu1',
    prompt: 'Find the auth code',
    description: 'scan auth',
    subagentType: 'Explore',
    provider: { plugin: 'engine', tier: 'core' },
    parentModel: 'claude-opus-5-5',
    background: false,
    fork: false,
  })

  const answer = await $.command.run({ command: 'factory', args: 'dress Explore beanie', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 120 } })
  expect(answer.text).toContain('Mũ len')
  expect(kept.get('styles')).toEqual({ explore: { head: 'beanie' } })
  const unknown = await $.command.run({ command: 'factory', args: 'dress claude jetpack', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 120 } })
  expect(unknown.text).toContain('Không có món')

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'wardrobe-toggle' })
  expect(await ui.find({ key: 'wardrobe-target' })).toBeDefined()
  expect(await ui.find({ key: 'wardrobe-wear' })).toBeDefined()
  await ui.unmount()
})
