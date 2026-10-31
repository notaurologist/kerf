import { describe, expect, it } from 'vitest';
import { clientAddress, UNKNOWN_ADDRESS } from './clientAddress.ts';

describe('clientAddress', () => {
  it('keeps an IPv4 address whole', () => {
    expect(clientAddress('203.0.113.7')).toBe('203.0.113.7');
  });

  it('groups an IPv6 address by its /64', () => {
    expect(clientAddress('2001:db8:1:2:3:4:5:6')).toBe('2001:db8:1:2::/64');
    expect(clientAddress('2001:db8:1:2::9')).toBe('2001:db8:1:2::/64');
    expect(clientAddress('2001:DB8:1:2:ffff::')).toBe('2001:db8:1:2::/64');
    expect(clientAddress('2001:0db8:0001:0002::1')).toBe('2001:db8:1:2::/64');
    expect(clientAddress('2001:db8::1')).toBe('2001:db8:0:0::/64');
    expect(clientAddress('::1')).toBe('0:0:0:0::/64');
    expect(clientAddress('fe80::1%eth0')).toBe('fe80:0:0:0::/64');
  });

  it('tells apart IPv6 addresses in different /64s', () => {
    expect(clientAddress('2001:db8:1:3::1')).not.toBe(clientAddress('2001:db8:1:2::1'));
  });

  it('reads an IPv4 address written as IPv6 as the IPv4 address', () => {
    expect(clientAddress('::ffff:203.0.113.7')).toBe('203.0.113.7');
    expect(clientAddress('::ffff:cb00:7107')).toBe('203.0.113.7');
  });

  it('expands an IPv6 address that ends in dotted IPv4', () => {
    expect(clientAddress('64:ff9b:1:2::203.0.113.7')).toBe('64:ff9b:1:2::/64');
  });

  it('takes the first address of a list', () => {
    expect(clientAddress('203.0.113.7, 10.0.0.1')).toBe('203.0.113.7');
  });

  it('counts a missing or unreadable header as one unknown address', () => {
    expect(clientAddress(undefined)).toBe(UNKNOWN_ADDRESS);
    expect(clientAddress('')).toBe(UNKNOWN_ADDRESS);
    expect(clientAddress('not an address')).toBe(UNKNOWN_ADDRESS);
  });
});
