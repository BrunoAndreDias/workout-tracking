import type { NetworkInterfaceInfo } from 'node:os'
import { describe, expect, it } from 'vitest'
import { phoneUrls } from './lanAddresses.ts'

const nic = (address: string, over: Partial<NetworkInterfaceInfo> = {}): NetworkInterfaceInfo =>
  ({ address, family: 'IPv4', internal: false, netmask: '255.255.255.0', mac: '', cidr: null, ...over }) as NetworkInterfaceInfo

describe('phoneUrls', () => {
  it('lists the .local name first, then each private IPv4 on a real interface', () => {
    const urls = phoneUrls(
      {
        lo0: [nic('127.0.0.1', { internal: true })],
        en0: [nic('192.168.1.23'), nic('fe80::1', { family: 'IPv6' } as Partial<NetworkInterfaceInfo>)],
        en1: [nic('10.0.0.7'), nic('172.20.1.2'), nic('172.32.0.1'), nic('8.8.8.8'), nic('172.15.0.1')],
        utun8: [nic('10.2.0.2')],
      },
      'Brunos-MacBook.local',
      4173,
    )
    expect(urls).toEqual([
      'http://Brunos-MacBook.local:4173/',
      'http://192.168.1.23:4173/',
      'http://10.0.0.7:4173/',
      'http://172.20.1.2:4173/',
    ])
  })

  it('skips the .local name when there is none', () => {
    expect(phoneUrls({ en0: [nic('192.168.0.5')] }, undefined, 8080)).toEqual(['http://192.168.0.5:8080/'])
  })
})
