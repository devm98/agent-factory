import type { Desk, Office, Outfit, Status } from '../types'

export const MANAGER_ID = 'main'

// How long each passing state lasts before tick() moves it on, in ms.
export const TIMING = {
  arriving: 1500,
  celebrate: 6000,
  deliver: 2000,
  sleepAfter: 60000,
  errorLinger: 8000,
}

export type Tier = 'full' | 'compact' | 'grouped'

export function layoutTier(count: number): Tier {
  if (count <= 8) return 'full'
  if (count <= 24) return 'compact'
  return 'grouped'
}

export function outfitFor(agentType: string): Outfit {
  const type = agentType.toLowerCase()
  if (type === 'explore') return 'explorer'
  if (type === 'plan') return 'blueprint'
  if (type.includes('review')) return 'glasses'
  if (type === 'general-purpose' || type === 'claude') return 'headphones'
  return 'none'
}

export function emptyOffice(now: number): Office {
  return {
    manager: {
      agentId: MANAGER_ID,
      name: 'claude',
      agentType: 'manager',
      model: '',
      slot: -1,
      group: 'manager',
      outfit: 'manager',
      isResident: true,
      status: 'idle',
      since: now,
      lastEventAt: now,
      errorStreak: 0,
    },
    desks: [],
    breakRoom: 0,
    completed: 0,
  }
}

function freeSlot(desks: readonly Desk[]): number {
  const taken = new Set(desks.map(desk => desk.slot))
  let slot = 0
  while (taken.has(slot)) slot++
  return slot
}

export type SpawnFacts = {
  agentId: string
  name?: string
  description?: string
  agentType: string
  model: string
  isResident: boolean
  workflowRunId?: string
}

export function spawn(office: Office, facts: SpawnFacts, now: number): Office {
  const existing = office.desks.find(desk => desk.agentId === facts.agentId)
  if (existing !== undefined) {
    return withDesk(office, facts.agentId, desk => ({
      ...setStatus(desk, 'thinking', now),
      hasEnded: false,
    }))
  }
  const group = facts.workflowRunId
    ? `workflow ${facts.workflowRunId.slice(-4)}`
    : facts.agentType
  const desk: Desk = {
    agentId: facts.agentId,
    name: shortName(facts),
    agentType: facts.agentType,
    model: shortModel(facts.model),
    slot: freeSlot(office.desks),
    group,
    outfit: outfitFor(facts.agentType),
    isResident: facts.isResident,
    status: 'arriving',
    since: now,
    lastEventAt: now,
    errorStreak: 0,
  }

  return { ...office, desks: [...office.desks, desk] }
}

function shortName(facts: SpawnFacts): string {
  const base = facts.name ?? facts.description ?? facts.agentType
  return base.length > 18 ? base.slice(0, 17) + '…' : base
}

export function shortModel(model: string): string {
  const known = ['opus', 'sonnet', 'haiku', 'fable']
  return known.find(name => model.toLowerCase().includes(name)) ?? model
}

function setStatus(desk: Desk, status: Status, now: number): Desk {
  if (desk.status === status) return { ...desk, lastEventAt: now }
  return { ...desk, status, since: now, lastEventAt: now }
}

// Applies fn to the manager (agentId undefined) or the subagent's desk;
// events from loops with no desk (a fork the engine runs) change nothing.
export function withDesk(
  office: Office,
  agentId: string | undefined,
  fn: (desk: Desk) => Desk,
): Office {
  if (agentId === undefined || agentId === MANAGER_ID) {
    return { ...office, manager: fn(office.manager) }
  }
  if (!office.desks.some(desk => desk.agentId === agentId)) return office

  return {
    ...office,
    desks: office.desks.map(desk => (desk.agentId === agentId ? fn(desk) : desk)),
  }
}

export function turnStart(office: Office, agentId: string | undefined, now: number): Office {
  return withDesk(office, agentId, desk => setStatus(desk, 'thinking', now))
}

export function toolStart(
  office: Office,
  agentId: string | undefined,
  name: string,
  arg: string,
  now: number,
): Office {
  return withDesk(office, agentId, desk => {
    const count = desk.tool?.name === name ? desk.tool.count + 1 : 1
    const status = desk.status === 'error' ? 'error' : 'working'

    return { ...setStatus(desk, status, now), tool: { name, arg, count } }
  })
}

export function toolEnd(
  office: Office,
  agentId: string | undefined,
  isError: boolean,
  now: number,
): Office {
  return withDesk(office, agentId, desk => {
    const errorStreak = isError ? desk.errorStreak + 1 : 0
    const status = errorStreak >= 2 ? 'error' : 'thinking'

    return { ...setStatus(desk, status, now), errorStreak }
  })
}

export function askStart(office: Office, agentId: string | undefined, now: number): Office {
  return withDesk(office, agentId, desk => setStatus(desk, 'waiting', now))
}

export type TurnEndReason = 'answer' | 'aborted' | 'refusal' | 'error'

export function turnEnd(
  office: Office,
  agentId: string | undefined,
  reason: TurnEndReason,
  now: number,
): Office {
  return withDesk(office, agentId, desk => {
    if (desk.agentId === MANAGER_ID || desk.isResident) {
      return { ...setStatus(desk, 'idle', now), tool: undefined }
    }
    const status = reason === 'answer' ? 'done' : 'error'

    return { ...setStatus(desk, status, now), hasEnded: true }
  })
}

// Moves the timed states on; returns the same object when nothing changed so
// the caller can skip the write.
export function tick(office: Office, now: number): Office {
  let changed = false
  let breakRoom = office.breakRoom
  let completed = office.completed
  const desks: Desk[] = []

  for (const desk of office.desks) {
    const age = now - desk.since
    if (desk.status === 'arriving' && age >= TIMING.arriving) {
      desks.push(setStatus(desk, 'thinking', now))
      changed = true
    } else if (desk.status === 'done' && age >= TIMING.celebrate) {
      desks.push(setStatus(desk, 'delivering', now))
      changed = true
    } else if (desk.status === 'delivering' && age >= TIMING.deliver) {
      breakRoom++
      completed++
      changed = true
    } else if (desk.status === 'error' && desk.hasEnded === true && age >= TIMING.errorLinger) {
      breakRoom++
      changed = true
    } else if (desk.status === 'idle' && age >= TIMING.sleepAfter) {
      desks.push(setStatus(desk, 'sleep', now))
      changed = true
    } else {
      desks.push(desk)
    }
  }

  let manager = office.manager
  if (manager.status === 'idle' && now - manager.since >= TIMING.sleepAfter) {
    manager = setStatus(manager, 'sleep', now)
    changed = true
  }

  return changed ? { manager, desks, breakRoom, completed } : office
}

export type Counts = Record<'busy' | 'waiting' | 'done' | 'error' | 'idle', number>

export function counts(desks: readonly Desk[]): Counts {
  const result: Counts = { busy: 0, waiting: 0, done: 0, error: 0, idle: 0 }
  for (const desk of desks) {
    if (desk.status === 'waiting') result.waiting++
    else if (desk.status === 'error') result.error++
    else if (desk.status === 'done' || desk.status === 'delivering') result.done++
    else if (desk.status === 'idle' || desk.status === 'sleep') result.idle++
    else result.busy++
  }

  return result
}

export function groups(desks: readonly Desk[]): { name: string; desks: Desk[] }[] {
  const byName = new Map<string, Desk[]>()
  for (const desk of desks) {
    const list = byName.get(desk.group) ?? []
    list.push(desk)
    byName.set(desk.group, list)
  }

  return [...byName].map(([name, list]) => ({ name, desks: list }))
}

// The few words a bubble shows for a desk.
export function bubbleText(desk: Desk): string {
  const tool = desk.tool
  const toolText = tool
    ? `${tool.name}${tool.count > 1 ? ` ×${tool.count}` : ''}${tool.arg ? ' ' + tool.arg : ''}`
    : ''
  switch (desk.status) {
    case 'arriving':
      return 'Đang tới bàn'
    case 'working':
      return toolText || 'Đang làm'
    case 'thinking':
      return '…'
    case 'waiting':
      return tool ? `Chờ bạn: ${tool.name}` : 'Chờ bạn'
    case 'error':
      return tool ? `${tool.name} lỗi` : 'Lỗi'
    case 'done':
      return '✓ Xong'
    case 'delivering':
      return 'Nộp báo cáo'
    case 'idle':
      return 'Rảnh'
    case 'sleep':
      return 'z z Z'
  }
}

// The short argument a bubble shows beside a tool's name.
export function toolArg(input: Record<string, unknown>): string {
  const pick = ['file_path', 'path', 'pattern', 'command', 'url', 'query', 'description', 'skill']
  for (const key of pick) {
    const value = input[key]
    if (typeof value !== 'string' || value === '') continue
    const text = key === 'file_path' || key === 'path' ? value.split(/[\\/]/).pop() ?? value : value
    const line = text.split('\n')[0] ?? ''

    return line.length > 24 ? line.slice(0, 23) + '…' : line
  }

  return ''
}
