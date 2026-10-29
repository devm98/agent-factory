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

export type Outfit =
  | 'none'
  | 'explorer'
  | 'blueprint'
  | 'glasses'
  | 'headphones'
  | 'manager'

export type Desk = {
  agentId: string
  name: string
  agentType: string
  model: string
  slot: number
  group: string
  outfit: Outfit
  // Agents that wake again (teammates, background runs) go idle at the end of
  // a turn instead of handing in their report and leaving.
  isResident: boolean
  tool?: { name: string; arg: string; count: number }
  status: Status
  since: number
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

declare module 'claude-code' {
  interface PluginState {
    'factory-view': { office: Shaped<Office> }
  }
}
