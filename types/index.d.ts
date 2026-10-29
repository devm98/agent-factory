export type Status =
  | 'arriving'
  | 'working'
  | 'thinking'
  | 'waiting'
  | 'error'
  | 'done'
  | 'delivering'
  | 'idle'
  | 'sleep'

export type Slot = 'head' | 'face' | 'neck' | 'hand' | 'desk'

// The item worn in each slot, by its id in the wardrobe; 'none' leaves a
// slot bare on purpose, so it wins over the agent type's default.
export type Look = Partial<Record<Slot, string>>

export type Desk = {
  agentId: string
  name: string
  agentType: string
  model: string
  task: string
  slot: number
  group: string
  look: Look
  // Agents that wake again (teammates, background runs) go idle at the end of
  // a turn instead of handing in their report and leaving.
  isResident: boolean
  tool?: { name: string; arg: string; count: number }
  toolCalls: number
  status: Status
  since: number
  startedAt: number
  lastEventAt: number
  errorStreak: number
  hasEnded?: boolean
}

export type Office = {
  manager: Desk
  desks: Desk[]
  breakRoom: number
  completed: number
}

// Looks chosen for whole agent types, keyed by the type in lower case
// ('manager' for Claude); kept across sessions in the store too.
export type Styles = Record<string, Look>

export type WardrobePanel = {
  isOpen: boolean
  target: string
  item: string
}

declare module 'claude-code' {
  interface PluginState {
    'factory-view': {
      office: Shaped<Office>
      styles: Shaped<Styles>
      wardrobe: Shaped<WardrobePanel>
    }
  }
}
