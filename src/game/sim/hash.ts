/** FNV-1a 32-bit hash over a canonical (key-sorted) serialization. Used for desync detection. */

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

function fnvStr(h: number, s: string): number {
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, FNV_PRIME);
  }
  return h;
}

function walk(h: number, v: unknown): number {
  if (v === null || v === undefined) return fnvStr(h, 'n');
  switch (typeof v) {
    case 'number': return fnvStr(h, 'd' + String(v) + ';');
    case 'string': return fnvStr(h, 's' + v.length + ':' + v);
    case 'boolean': return fnvStr(h, v ? 'T' : 'F');
    case 'object': {
      if (Array.isArray(v)) {
        h = fnvStr(h, '[' + v.length);
        for (const item of v) h = walk(h, item);
        return fnvStr(h, ']');
      }
      const o = v as Record<string, unknown>;
      const keys = Object.keys(o).filter((k) => o[k] !== undefined).sort();
      h = fnvStr(h, '{');
      for (const k of keys) {
        h = fnvStr(h, k + '=');
        h = walk(h, o[k]);
      }
      return fnvStr(h, '}');
    }
    default: return fnvStr(h, '?');
  }
}

export function hashValue(v: unknown): number {
  return walk(FNV_OFFSET, v) >>> 0;
}

/** Canonical JSON (sorted keys) — handy for debugging desyncs (diff two dumps). */
export function canonicalJson(v: unknown): string {
  return JSON.stringify(v, (_k, val) => {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(val).sort()) out[k] = (val as Record<string, unknown>)[k];
      return out;
    }
    return val;
  });
}
