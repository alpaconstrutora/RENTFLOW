// Helper temporário pra medir tempo de render server-side por seção.
// Remover depois do diagnóstico (em conjunto com os DebugTimings na UI).

export type TimingRecord = { label: string; ms: number }

export function startTimer(): { mark: (label: string) => void; records: TimingRecord[] } {
  const start = Date.now()
  let last = start
  const records: TimingRecord[] = []
  return {
    mark(label: string) {
      const now = Date.now()
      records.push({ label, ms: now - last })
      last = now
    },
    records,
  }
}

export function formatTimings(records: TimingRecord[]): string {
  const total = records.reduce((sum, r) => sum + r.ms, 0)
  const parts = records.map((r) => `${r.label}=${r.ms}ms`).join(' · ')
  return `TOTAL=${total}ms · ${parts}`
}

// Mede o tempo de uma promise individual. Útil pra timing por query
// dentro de um Promise.all — cada uma reporta paralelamente.
export async function timeIt<T>(label: string, p: PromiseLike<T>): Promise<{ label: string; ms: number; result: T }> {
  const t0 = Date.now()
  const result = await p
  return { label, ms: Date.now() - t0, result }
}
