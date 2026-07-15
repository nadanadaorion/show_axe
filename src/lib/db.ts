import Dexie, { type EntityTable } from 'dexie'
import type {
  AppSnapshot,
  BackupRecord,
  CatalogItem,
  Category,
  EquipmentLibraryItem,
  PersonLibraryItem,
  Preferences,
  Preset,
  Show,
  WorkspaceData,
} from '../types'

export interface PreferenceRecord extends Preferences {
  id: 'main'
}

export interface SyncRecord {
  id: string
  revision: number
  syncedAt: string
}

export type PendingMutationKind = 'show-upsert' | 'show-delete' | 'workspace-upsert'

export interface PendingMutation {
  id: string
  kind: PendingMutationKind
  entityId: string
  expectedRevision: number
  queuedAt: string
  show?: Show
  workspace?: WorkspaceData
}

export class OrionShowsDatabase extends Dexie {
  shows!: EntityTable<Show, 'id'>
  presets!: EntityTable<Preset, 'id'>
  equipmentLibrary!: EntityTable<EquipmentLibraryItem, 'id'>
  peopleLibrary!: EntityTable<PersonLibraryItem, 'id'>
  categories!: EntityTable<Category, 'id'>
  roles!: EntityTable<CatalogItem, 'id'>
  personTypes!: EntityTable<CatalogItem, 'id'>
  origins!: EntityTable<CatalogItem, 'id'>
  preferences!: EntityTable<PreferenceRecord, 'id'>
  backups!: EntityTable<BackupRecord, 'id'>
  syncRecords!: EntityTable<SyncRecord, 'id'>
  pendingMutations!: EntityTable<PendingMutation, 'id'>

  constructor() {
    // V2 deliberately uses a new local database. V1 data is not migrated automatically.
    super('orion-shows-v2')
    this.version(1).stores({
      shows: 'id, publicSlug, date, archived, updatedAt',
      presets: 'id, archived, updatedAt',
      equipmentLibrary: 'id, name, categoryId, archived',
      peopleLibrary: 'id, name, archived',
      categories: 'id, name, order, archived',
      roles: 'id, name, archived',
      personTypes: 'id, name, archived',
      origins: 'id, name, archived',
      preferences: 'id',
      backups: 'id, createdAt',
      syncRecords: 'id, revision, syncedAt',
      pendingMutations: 'id, kind, entityId, queuedAt',
    })
  }
}

export const db = new OrionShowsDatabase()

export async function writeLocalSnapshot(snapshot: AppSnapshot) {
  await db.transaction(
    'rw',
    [
      db.shows,
      db.presets,
      db.equipmentLibrary,
      db.peopleLibrary,
      db.categories,
      db.roles,
      db.personTypes,
      db.origins,
      db.preferences,
    ],
    async () => {
      await Promise.all([
        db.shows.clear(),
        db.presets.clear(),
        db.equipmentLibrary.clear(),
        db.peopleLibrary.clear(),
        db.categories.clear(),
        db.roles.clear(),
        db.personTypes.clear(),
        db.origins.clear(),
        db.preferences.clear(),
      ])
      await Promise.all([
        db.shows.bulkPut(snapshot.shows),
        db.presets.bulkPut(snapshot.presets),
        db.equipmentLibrary.bulkPut(snapshot.library.equipment),
        db.peopleLibrary.bulkPut(snapshot.library.people),
        db.categories.bulkPut(snapshot.library.categories),
        db.roles.bulkPut(snapshot.library.roles),
        db.personTypes.bulkPut(snapshot.library.personTypes),
        db.origins.bulkPut(snapshot.library.origins),
        db.preferences.put({ id: 'main', ...snapshot.preferences } as PreferenceRecord),
      ])
    },
  )
}
