export type Id = string

export interface CatalogItem {
  id: Id
  name: string
  notes?: string
  archived?: boolean
  createdAt: string
  updatedAt: string
}

export interface Category extends CatalogItem {
  order: number
}

export interface EquipmentLibraryItem extends CatalogItem {
  categoryId?: Id
  unit?: string
  originId?: Id
}

export interface PersonLibraryItem extends CatalogItem {
  company?: string
  typeIds: Id[]
  roleIds: Id[]
  phones: string[]
  emails: string[]
}

export interface ShowEquipmentCategory {
  id: Id
  name: string
  order: number
  /**
   * Whether equipment in this category feeds the input list generator. Defaults to true
   * (undefined = included) so shows saved before this field existed keep generating every row.
   */
  includeInInputList?: boolean
}

export interface EquipmentAssignment {
  id: Id
  use: string
}

export interface ShowEquipmentItem {
  id: Id
  sourceLibraryId?: Id
  categoryId: Id
  name: string
  quantity: number
  unit?: string
  originName?: string
  notes?: string
  checked: boolean
  order: number
  includeInInputList?: boolean
  assignments?: EquipmentAssignment[]
}

export interface ShowPerson {
  id: Id
  sourceLibraryId?: Id
  name: string
  company?: string
  typeNames: string[]
  roleNames: string[]
  phones: string[]
  emails: string[]
  notes?: string
  order: number
}

export interface ScheduleItem {
  id: Id
  name: string
  startTime: string
  endTime?: string
  notes?: string
  order: number
}

export interface InputListRow {
  id: Id
  order: number
  channel: string
  use: string
  equipment: string
  phantom: boolean
  patch?: string
  notes?: string
  sourceEquipmentId?: Id
  sourceAssignmentId?: Id
  sourceEquipmentName?: string
  sourceUse?: string
}

export interface MonitorReturn {
  id: Id
  order: number
  destination: string
  system: string
  stereo: boolean
  outputStart: number
  notes?: string
}

export interface InputListConfig {
  rows: InputListRow[]
  channelStart: number
  returns: MonitorReturn[]
  generalNotes?: string
  createdAt: string
  updatedAt: string
  lastSyncedAt?: string
}

export interface Show {
  id: Id
  publicSlug: string
  name: string
  date?: string
  time?: string
  showType?: string
  note?: string
  archived: boolean
  equipmentCategories: ShowEquipmentCategory[]
  equipment: ShowEquipmentItem[]
  people: ShowPerson[]
  schedule: ScheduleItem[]
  inputList?: InputListConfig
  createdAt: string
  updatedAt: string
}

export interface Preset {
  id: Id
  name: string
  description?: string
  archived: boolean
  showType?: string
  note?: string
  equipmentCategories: ShowEquipmentCategory[]
  equipment: ShowEquipmentItem[]
  people: ShowPerson[]
  schedule: ScheduleItem[]
  createdAt: string
  updatedAt: string
}

export interface Library {
  equipment: EquipmentLibraryItem[]
  people: PersonLibraryItem[]
  categories: Category[]
  roles: CatalogItem[]
  personTypes: CatalogItem[]
  origins: CatalogItem[]
}

export type DateFormat = 'dd/MM/yyyy' | 'MM/dd/yyyy' | 'yyyy-MM-dd'
export type TimeFormat = '24h' | '12h'
export type Language = 'es' | 'en'
export type InitialModule = 'shows' | 'library' | 'presets'

export interface Preferences {
  dateFormat: DateFormat
  timeFormat: TimeFormat
  language: Language
  initialModule: InitialModule
  theme: 'light' | 'dark' | 'system'
  showInputListWarnings: boolean
}

export interface AppSnapshot {
  version: 1 | 2 | 3
  exportedAt: string
  shows: Show[]
  presets: Preset[]
  library: Library
  preferences: Preferences
}

export interface BackupRecord {
  id: Id
  createdAt: string
  reason: string
  snapshot: AppSnapshot
}


export interface WorkspaceData {
  presets: Preset[]
  library: Library
  preferences: Preferences
}

export type SyncStatus = 'unconfigured' | 'connecting' | 'synced' | 'syncing' | 'offline' | 'conflict' | 'error'

export interface ShowConflict {
  id: Id
  showId: Id
  operation: 'upsert' | 'delete'
  localShow?: Show
  remoteShow?: Show
  remoteRevision: number
  remoteDeleted?: boolean
  createdAt: string
}

export interface ShowLockInfo {
  showId: Id
  ownerClientId: string
  deviceLabel: string
  expiresAt: string
}
