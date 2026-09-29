import { isIP } from 'node:net';

export function originAllowed(
  origin: string | null,
  configuredOrigin: string | undefined,
  serverPort: number,
): boolean {
  if (!origin) return false;
  const origins = new Set<string>();
  const add = (value: string): void => {
    const url = new URL(value);
    if (
      (url.protocol !== 'http:' && url.protocol !== 'https:') ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    )
      throw new Error('APP_ORIGIN must be an HTTP or HTTPS origin.');
    origins.add(url.origin);
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      const alternate = new URL(url.origin);
      alternate.hostname = url.hostname === 'localhost' ? '127.0.0.1' : 'localhost';
      origins.add(alternate.origin);
    }
  };
  if (configuredOrigin) add(configuredOrigin);
  else {
    add('http://localhost:5173');
    add(`http://localhost:${serverPort}`);
  }
  return origins.has(origin);
}

export function normalizeAddress(address: string): string {
  return address.startsWith('::ffff:') && isIP(address.slice(7)) === 4 ? address.slice(7) : address;
}

export function trustedProxies(value: string): ReadonlySet<string> {
  const addresses = value
    .split(',')
    .map((address) => normalizeAddress(address.trim()))
    .filter(Boolean);
  if (addresses.some((address) => isIP(address) === 0))
    throw new Error('TRUSTED_PROXIES must contain IP addresses separated by commas.');
  return new Set(addresses);
}

export function clientAddress(peer: string, forwarded: string | null, trusted: ReadonlySet<string>): string {
  const normalizedPeer = normalizeAddress(peer);
  if (!trusted.has(normalizedPeer) || !forwarded || forwarded.length > 1024) return normalizedPeer;
  const chain = forwarded.split(',').map((address) => normalizeAddress(address.trim()));
  if (chain.length > 16 || chain.some((address) => isIP(address) === 0)) return normalizedPeer;
  for (let index = chain.length - 1; index >= 0; index--) {
    const address = chain[index]!;
    if (!trusted.has(address)) return address;
  }
  return chain[0] ?? normalizedPeer;
}

export class RateLimiter {
  private readonly entries = new Map<string, { count: number; resetAt: number }>();

  take(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
    const existing = this.entries.get(key);
    if (!existing || existing.resetAt <= now) {
      this.entries.set(key, { count: 1, resetAt: now + windowMs });
      if (this.entries.size > 10000) this.prune(now);
      return true;
    }
    if (existing.count >= limit) return false;
    existing.count++;
    return true;
  }

  prune(now = Date.now()): void {
    for (const [key, entry] of this.entries) if (entry.resetAt <= now) this.entries.delete(key);
    while (this.entries.size > 10000) {
      const first = this.entries.keys().next().value;
      if (first === undefined) break;
      this.entries.delete(first);
    }
  }
}

export function readCookies(request: Request): Map<string, string> {
  const cookies = new Map<string, string>();
  for (const part of (request.headers.get('cookie') ?? '').split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key && value.length <= 256) cookies.set(key, value);
  }
  return cookies;
}

export function sessionCookie(name: string, value: string, maxAge: number, secure: boolean): string {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}

export async function readJson(request: Request, maxBytes = 4096): Promise<Record<string, unknown> | null> {
  if (!(request.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) return null;
  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (!Number.isFinite(contentLength) || contentLength < 0 || contentLength > maxBytes) return null;
  if (!request.body) return null;
  const reader = request.body.getReader();
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      bytes += result.value.length;
      if (bytes > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(result.value);
    }
    const joined = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) {
      joined.set(chunk, offset);
      offset += chunk.length;
    }
    const result: unknown = JSON.parse(new TextDecoder().decode(joined));
    return result && typeof result === 'object' && !Array.isArray(result)
      ? (result as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function validCredentials(
  data: Record<string, unknown> | null,
): { username: string; password: string } | null {
  if (!data || typeof data.username !== 'string' || typeof data.password !== 'string') return null;
  const username = data.username.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(username) || data.password.length < 10 || data.password.length > 128)
    return null;
  return { username, password: data.password };
}
