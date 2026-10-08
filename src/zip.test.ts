import { describe, expect, it } from 'vitest'
import { isZip, openEntry, zipEntries } from './zip.ts'
import { buildZip } from './zipFixture.ts'
import type { ZipRow } from './zipFixture.ts'

async function readText(file: Blob, name: string): Promise<string> {
  const entry = (await zipEntries(file)).find((e) => e.name === name)
  if (!entry) throw new Error(`missing ${name}`)
  const stream = (await openEntry(file, entry)).pipeThrough(new TextDecoderStream())
  let text = ''
  for await (const chunk of stream) text += chunk
  return text
}

const xml = '<HealthData>' + '<Workout type="Corrida" energy="320"/>'.repeat(200) + '</HealthData>'
const standard: ZipRow[] = [
  { name: 'apple_health_export/export.xml', data: xml },
  { name: 'apple_health_export/export_cda.xml', data: '<ClinicalDocument/>' },
  { name: 'workout-routes/route.gpx', data: '<gpx>ação</gpx>', method: 0 },
]

describe('zip reader', () => {
  it('lists the entries and reads deflated and stored data back', async () => {
    const file = buildZip(standard)
    expect(await isZip(file)).toBe(true)
    expect((await zipEntries(file)).map((e) => e.name)).toEqual([
      'apple_health_export/export.xml',
      'apple_health_export/export_cda.xml',
      'workout-routes/route.gpx',
    ])
    expect(await readText(file, 'apple_health_export/export.xml')).toBe(xml)
    expect(await readText(file, 'workout-routes/route.gpx')).toBe('<gpx>ação</gpx>')
  })

  it('finds the data when the local header extra differs from the central directory', async () => {
    const file = buildZip([{ name: 'a.xml', data: xml, localExtra: 11 }, { name: 'b.xml', data: 'segundo', localExtra: 5 }])
    expect(await readText(file, 'a.xml')).toBe(xml)
    expect(await readText(file, 'b.xml')).toBe('segundo')
  })

  it('reads a Zip64 archive', async () => {
    const file = buildZip([{ name: 'big.xml', data: xml, zip64: true }, { name: 'small.xml', data: 'pequeno', zip64: true }])
    const entries = await zipEntries(file)
    expect(entries[0]).toMatchObject({ name: 'big.xml', size: xml.length, localHeaderOffset: 0 })
    expect(await readText(file, 'big.xml')).toBe(xml)
    expect(await readText(file, 'small.xml')).toBe('pequeno')
  })

  it('reads a zip with a trailing comment', async () => {
    const file = buildZip(standard, 'exportado do iPhone')
    expect(await readText(file, 'apple_health_export/export_cda.xml')).toBe('<ClinicalDocument/>')
  })

  it('rejects a file that is not a zip', async () => {
    const file = new Blob(['<?xml version="1.0"?><HealthData/>'])
    expect(await isZip(file)).toBe(false)
    await expect(zipEntries(file)).rejects.toThrow('Este ficheiro não é um zip que a app consiga ler.')
  })

  it('rejects an unsupported compression method', async () => {
    const file = buildZip([{ name: 'x.xml', data: 'x', method: 12 }])
    const [entry] = await zipEntries(file)
    await expect(openEntry(file, entry)).rejects.toThrow('O ficheiro usa uma compressão que a app não lê.')
  })
})
