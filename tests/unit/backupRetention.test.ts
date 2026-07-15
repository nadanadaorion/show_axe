import { describe, expect, it } from 'vitest'
import { excessBackupIds } from '../../src/lib/db'
import type { BackupRecord } from '../../src/types'

describe('backup retention', () => {
  it('keeps the ten newest records and removes every older backup', () => {
    const records = Array.from({ length: 13 }, (_, index) => ({ id: `backup-${index}` })) as BackupRecord[]
    expect(excessBackupIds(records)).toEqual(['backup-10', 'backup-11', 'backup-12'])
  })
})
