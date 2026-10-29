import type { Desk, Look, Office, Slot, Styles } from '../types'
import { MANAGER_ID } from './model'

export const SLOTS: readonly Slot[] = ['head', 'face', 'neck', 'hand', 'desk']

export const SLOT_LABEL: Record<Slot, string> = {
  head: 'Đầu',
  face: 'Mặt',
  neck: 'Cổ',
  hand: 'Tay',
  desk: 'Bàn',
}

export const ITEMS: Record<string, { slot: Slot; label: string }> = {
  explorer: { slot: 'head', label: 'Mũ thám hiểm' },
  beanie: { slot: 'head', label: 'Mũ len' },
  cap: { slot: 'head', label: 'Mũ lưỡi trai' },
  party: { slot: 'head', label: 'Mũ tiệc' },
  crown: { slot: 'head', label: 'Vương miện' },
  headphones: { slot: 'head', label: 'Tai nghe' },
  bow: { slot: 'head', label: 'Nơ' },
  glasses: { slot: 'face', label: 'Kính' },
  shades: { slot: 'face', label: 'Kính râm' },
  tie: { slot: 'neck', label: 'Cà vạt' },
  scarf: { slot: 'neck', label: 'Khăn quàng' },
  blueprint: { slot: 'hand', label: 'Bản vẽ' },
  coffee: { slot: 'hand', label: 'Cốc cà phê' },
  cat: { slot: 'desk', label: 'Mèo' },
  cactus: { slot: 'desk', label: 'Xương rồng' },
  photo: { slot: 'desk', label: 'Khung ảnh' },
}

// Words a dress command takes besides an item: 'none' strips every slot,
// 'reset' goes back to the agent type's default.
export const NONE = 'none'
export const RESET = 'reset'

export const MANAGER_TYPE = 'manager'

export function typeKey(agentType: string): string {
  return agentType.toLowerCase()
}

export function defaultLook(agentType: string): Look {
  const type = typeKey(agentType)
  if (type === MANAGER_TYPE) return { head: 'crown', neck: 'tie' }
  if (type === 'explore') return { head: 'explorer' }
  if (type === 'plan') return { hand: 'blueprint' }
  if (type.includes('review')) return { face: 'glasses' }
  if (type === 'general-purpose' || type === 'claude') return { head: 'headphones' }

  return {}
}

function clean(look: Look): Look {
  const out: Look = {}
  for (const slot of SLOTS) {
    const item = look[slot]
    if (item !== undefined && item !== NONE && ITEMS[item] !== undefined) out[slot] = item
  }

  return out
}

export function resolveLook(agentType: string, styles: Styles): Look {
  return clean({ ...defaultLook(agentType), ...styles[typeKey(agentType)] })
}

const BARE: Look = { head: NONE, face: NONE, neck: NONE, hand: NONE, desk: NONE }

// One item put on over a look; NONE strips the look bare.
export function wear(look: Look, item: string): Look {
  if (item === NONE) return { ...BARE }
  const known = ITEMS[item]
  if (known === undefined) return look

  return { ...look, [known.slot]: item }
}

export type Target =
  | { kind: 'manager' }
  | { kind: 'all' }
  | { kind: 'desk'; agentId: string; name: string }
  | { kind: 'type'; agentType: string }

export function findTarget(word: string, office: Office): Target {
  const lower = word.toLowerCase()
  if (lower === 'claude' || lower === MANAGER_TYPE || lower === MANAGER_ID) return { kind: 'manager' }
  if (lower === 'all' || lower === 'tất cả') return { kind: 'all' }
  const desk = office.desks.find(
    one => one.agentId.toLowerCase() === lower || one.name.toLowerCase() === lower,
  )
  if (desk !== undefined) return { kind: 'desk', agentId: desk.agentId, name: desk.name }

  return { kind: 'type', agentType: word }
}

export function targetLabel(target: Target): string {
  switch (target.kind) {
    case 'manager':
      return 'Claude'
    case 'all':
      return 'mọi agent đang có bàn'
    case 'desk':
      return target.name
    case 'type':
      return `mọi agent ${target.agentType}`
  }
}

// What dressing a target with an item does to the styles kept for types
// and to the desks on the floor now.
export function dress(
  office: Office,
  styles: Styles,
  target: Target,
  item: string,
): { office: Office; styles: Styles } {
  const restyle = (type: string): Styles => {
    const key = typeKey(type)
    if (item === RESET) {
      const { [key]: _dropped, ...rest } = styles
      return rest
    }

    return { ...styles, [key]: wear(styles[key] ?? {}, item) }
  }
  const redress = (desk: Desk, nextStyles: Styles): Desk => ({
    ...desk,
    look: resolveLook(desk.agentType, nextStyles),
  })
  const personal = (desk: Desk): Desk => ({
    ...desk,
    look: item === RESET ? resolveLook(desk.agentType, styles) : clean(wear(desk.look, item)),
  })

  switch (target.kind) {
    case 'manager': {
      const nextStyles = restyle(MANAGER_TYPE)
      return { styles: nextStyles, office: { ...office, manager: redress(office.manager, nextStyles) } }
    }
    case 'type': {
      const nextStyles = restyle(target.agentType)
      const key = typeKey(target.agentType)
      const desks = office.desks.map(desk => (typeKey(desk.agentType) === key ? redress(desk, nextStyles) : desk))
      return { styles: nextStyles, office: { ...office, desks } }
    }
    case 'desk': {
      const desks = office.desks.map(desk => (desk.agentId === target.agentId ? personal(desk) : desk))
      return { styles, office: { ...office, desks } }
    }
    case 'all':
      return { styles, office: { ...office, desks: office.desks.map(personal) } }
  }
}

export function isItem(word: string): boolean {
  return word === NONE || word === RESET || ITEMS[word] !== undefined
}

export function catalog(): string {
  return SLOTS.map(slot => {
    const items = Object.entries(ITEMS)
      .filter(([, item]) => item.slot === slot)
      .map(([id, item]) => `${id} (${item.label})`)
    return `${SLOT_LABEL[slot]}: ${items.join(', ')}`
  }).join('\n')
}

// The targets the wardrobe panel offers: Claude, the types seen, each desk.
export function targetOptions(office: Office, styles: Styles): { value: string; label: string }[] {
  const types = new Set<string>(['Explore', 'Plan', 'general-purpose'])
  for (const desk of office.desks) types.add(desk.agentType)
  for (const key of Object.keys(styles)) if (key !== MANAGER_TYPE && ![...types].some(t => typeKey(t) === key)) types.add(key)

  return [
    { value: 'claude', label: 'Claude (manager)' },
    ...[...types].map(type => ({ value: type, label: `Mọi agent ${type}` })),
    ...office.desks.map(desk => ({ value: desk.agentId, label: `Bàn: ${desk.name}` })),
  ]
}

export function itemOptions(): { value: string; label: string }[] {
  return [
    ...Object.entries(ITEMS).map(([id, item]) => ({ value: id, label: `${SLOT_LABEL[item.slot]} · ${item.label}` })),
    { value: NONE, label: 'Bỏ hết đồ' },
    { value: RESET, label: 'Về mặc định' },
  ]
}

// The look a target would wear now, for the panel's preview.
export function lookOf(target: Target, office: Office, styles: Styles): Look {
  switch (target.kind) {
    case 'manager':
      return office.manager.look
    case 'desk':
      return office.desks.find(desk => desk.agentId === target.agentId)?.look ?? {}
    case 'type':
      return resolveLook(target.agentType, styles)
    case 'all':
      return {}
  }
}

// The look the panel shows: the target as it would be with the item on.
export function previewLook(office: Office, styles: Styles, targetWord: string, item: string): Look {
  const target = findTarget(targetWord, office)
  const dressed = isItem(item) ? dress(office, styles, target, item) : { office, styles }
  if (target.kind === 'all') return dressed.office.desks[0]?.look ?? {}

  return lookOf(target, dressed.office, dressed.styles)
}
