import type { PacketCodec } from './contracts';

export function jsonCodec<T>(validate: (value: unknown) => T | null, maxBytes = 512 * 1024): PacketCodec<T> {
  const encoder = new TextEncoder();
  return {
    encode(value) {
      const parsed = validate(value);
      if (!parsed) throw new TypeError('The packet is invalid.');
      const raw = JSON.stringify(parsed);
      if (encoder.encode(raw).byteLength > maxBytes) throw new RangeError('The packet is too large.');
      return raw;
    },
    decode(raw) {
      if (typeof raw !== 'string' || raw.length > maxBytes || encoder.encode(raw).byteLength > maxBytes)
        return null;
      try {
        return validate(JSON.parse(raw));
      } catch {
        return null;
      }
    },
  };
}
