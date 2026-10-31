import { isIPv4, isIPv6 } from 'node:net';

// The address a login is counted against (decision 0007). Vercel overwrites `x-forwarded-for`
// with the address that connected to it, so a client cannot choose its own. An IPv6 client
// usually holds a whole /64, so its addresses count together. Without the header, as in local
// development, every login shares one count.

export const UNKNOWN_ADDRESS = 'unknown';

/** Eight 16-bit groups, from an address `isIPv6` accepts. */
function ipv6Groups(address: string): number[] {
  let text = address;
  const ipv4Tail = /(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(text);
  if (ipv4Tail) {
    const [a, b, c, d] = ipv4Tail.slice(1).map(Number) as [number, number, number, number];
    text = `${text.slice(0, ipv4Tail.index)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const [head = '', tail] = text.split('::');
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const gap = tail === undefined ? [] : Array<string>(8 - left.length - right.length).fill('0');
  return [...left, ...gap, ...right].map((group) => Number.parseInt(group, 16));
}

export function clientAddress(forwardedFor: string | undefined): string {
  const first = forwardedFor?.split(',')[0]?.trim() ?? '';
  const address = first.split('%')[0] ?? '';
  if (isIPv4(address)) return address;
  if (!isIPv6(address)) return UNKNOWN_ADDRESS;
  const groups = ipv6Groups(address);
  const mappedIPv4 = groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff;
  if (mappedIPv4) {
    const [high = 0, low = 0] = groups.slice(6);
    return [high >> 8, high & 0xff, low >> 8, low & 0xff].join('.');
  }
  return `${groups
    .slice(0, 4)
    .map((g) => g.toString(16))
    .join(':')}::/64`;
}
