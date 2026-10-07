export interface ZipEntry {
  readonly name: string
  readonly method: number
  readonly compressedSize: number
  readonly size: number
  readonly localHeaderOffset: number
}

const NOT_A_ZIP = 'Este ficheiro não é um zip que a app consiga ler.'
const UNSUPPORTED = 'O ficheiro usa uma compressão que a app não lê.'
const MAX_COMMENT = 65535
const EOCD_SIZE = 22
const UINT32_MAX = 0xffffffff

async function view(file: Blob, start: number, end: number): Promise<DataView> {
  const bytes = await file.slice(start, end).arrayBuffer()
  if (bytes.byteLength !== end - start) throw new Error(NOT_A_ZIP)
  return new DataView(bytes)
}

function expectSignature(v: DataView, at: number, signature: number): void {
  if (at < 0 || at + 4 > v.byteLength || v.getUint32(at, true) !== signature) throw new Error(NOT_A_ZIP)
}

export async function isZip(file: Blob): Promise<boolean> {
  if (file.size < 4) return false
  return (await view(file, 0, 4)).getUint32(0, true) === 0x04034b50
}

async function directoryLocation(file: Blob): Promise<{ count: number; size: number; offset: number }> {
  const tailStart = Math.max(0, file.size - (EOCD_SIZE + MAX_COMMENT))
  const tail = await view(file, tailStart, file.size)
  let at = tail.byteLength - EOCD_SIZE
  while (at >= 0 && tail.getUint32(at, true) !== 0x06054b50) at--
  if (at < 0) throw new Error(NOT_A_ZIP)

  const locator = at - 20
  if (locator >= 0 && tail.getUint32(locator, true) === 0x07064b50) {
    const recordOffset = Number(tail.getBigUint64(locator + 8, true))
    const record = await view(file, recordOffset, recordOffset + 56)
    expectSignature(record, 0, 0x06064b50)
    return {
      count: Number(record.getBigUint64(32, true)),
      size: Number(record.getBigUint64(40, true)),
      offset: Number(record.getBigUint64(48, true)),
    }
  }
  return { count: tail.getUint16(at + 10, true), size: tail.getUint32(at + 12, true), offset: tail.getUint32(at + 16, true) }
}

function zip64Values(extra: DataView): bigint[] {
  for (let at = 0; at + 4 <= extra.byteLength; ) {
    const id = extra.getUint16(at, true)
    const length = extra.getUint16(at + 2, true)
    if (id === 0x0001) {
      const values: bigint[] = []
      for (let i = 0; i + 8 <= length; i += 8) values.push(extra.getBigUint64(at + 4 + i, true))
      return values
    }
    at += 4 + length
  }
  return []
}

/** Every entry of the central directory, read from the file's tail with Blob.slice, so a multi-GB file is never loaded whole. */
export async function zipEntries(file: Blob): Promise<ZipEntry[]> {
  try {
    const { count, size, offset } = await directoryLocation(file)
    const directory = await view(file, offset, offset + size)
    const decoder = new TextDecoder()
    const entries: ZipEntry[] = []
    let at = 0
    for (let i = 0; i < count; i++) {
      expectSignature(directory, at, 0x02014b50)
      const nameLength = directory.getUint16(at + 28, true)
      const extraLength = directory.getUint16(at + 30, true)
      const commentLength = directory.getUint16(at + 32, true)
      const nameAt = at + 46
      const extraAt = nameAt + nameLength
      const wide = zip64Values(new DataView(directory.buffer, extraAt, extraLength))
      const next = () => Number(wide.shift() ?? 0n)
      let sizeField = directory.getUint32(at + 24, true)
      let compressedField = directory.getUint32(at + 20, true)
      let offsetField = directory.getUint32(at + 42, true)
      if (sizeField === UINT32_MAX) sizeField = next()
      if (compressedField === UINT32_MAX) compressedField = next()
      if (offsetField === UINT32_MAX) offsetField = next()
      entries.push({
        name: decoder.decode(new Uint8Array(directory.buffer, nameAt, nameLength)),
        method: directory.getUint16(at + 10, true),
        compressedSize: compressedField,
        size: sizeField,
        localHeaderOffset: offsetField,
      })
      at = extraAt + extraLength + commentLength
    }
    return entries
  } catch {
    throw new Error(NOT_A_ZIP)
  }
}

/** The entry's data, decompressed. Sizes come from the central directory, since a local header with a data descriptor holds zeros. */
export async function openEntry(file: Blob, entry: ZipEntry): Promise<ReadableStream<Uint8Array<ArrayBuffer>>> {
  const header = await view(file, entry.localHeaderOffset, entry.localHeaderOffset + 30)
  expectSignature(header, 0, 0x04034b50)
  if (header.getUint16(6, true) & 1 || (entry.method !== 0 && entry.method !== 8)) throw new Error(UNSUPPORTED)
  const dataStart = entry.localHeaderOffset + 30 + header.getUint16(26, true) + header.getUint16(28, true)
  const raw = file.slice(dataStart, dataStart + entry.compressedSize).stream()
  return entry.method === 0 ? raw : raw.pipeThrough(new DecompressionStream('deflate-raw'))
}
