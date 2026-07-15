export type RemoteShowApplyResult = 'applied' | 'stale' | 'duplicate' | 'pending'

export function classifyRemoteShowRevision(currentAcceptedRevision: number | undefined, incomingRevision: number) {
  const current = currentAcceptedRevision ?? 0
  if (incomingRevision < current) return 'stale' as const
  if (incomingRevision === current) return 'duplicate' as const
  return 'newer' as const
}
