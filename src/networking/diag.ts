/**
 * Connection diagnostics shared by the transport, room and FightScene (exposed via window.__ac.net() / debug overlay).
 * Pure bookkeeping: never affects the simulation.
 */
export interface NetEventLog { t: number; kind: string; detail: string }

export const netDiag = {
  /** Fatal link closes (each one triggers the room's reconnect flow). */
  closes: [] as NetEventLog[],
  /** Non-fatal transport noise (DataConnection 'error', ICE 'disconnected' blips, send failures). */
  warnings: [] as NetEventLog[],
  /** Times the room entered 'reconnecting'. */
  reconnects: 0,
};

const stamp = (): number => Math.round(typeof performance !== 'undefined' ? performance.now() : Date.now());

function push(list: NetEventLog[], kind: string, detail: string): void {
  list.push({ t: stamp(), kind, detail });
  if (list.length > 50) list.shift();
}
export function logClose(kind: string, detail: string): void { push(netDiag.closes, kind, detail); }
export function logWarning(kind: string, detail: string): void { push(netDiag.warnings, kind, detail); }
export function resetNetDiag(): void { netDiag.closes.length = 0; netDiag.warnings.length = 0; netDiag.reconnects = 0; }
