import type { NetworkInterfaceInfo } from 'node:os'

const isPrivateIPv4 = (address: string): boolean => {
  const [a, b] = address.split('.').map(Number)
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
}

export const phoneUrls = (
  interfaces: Record<string, NetworkInterfaceInfo[] | undefined>,
  localHostName: string | undefined,
  port: number,
): string[] => {
  const urls = localHostName ? [`http://${localHostName}:${port}/`] : []
  for (const [name, infos] of Object.entries(interfaces)) {
    if (name.startsWith('utun')) continue
    for (const info of infos ?? []) {
      if (info.family === 'IPv4' && !info.internal && isPrivateIPv4(info.address)) urls.push(`http://${info.address}:${port}/`)
    }
  }
  return urls
}
