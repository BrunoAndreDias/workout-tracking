import { deflateRawSync } from 'node:zlib'

export interface ZipRow {
  name: string
  data: string
  method?: number
  zip64?: boolean
  localExtra?: number
}

function u16(n: number): Buffer {
  const b = Buffer.alloc(2)
  b.writeUInt16LE(n)
  return b
}
function u32(n: number): Buffer {
  const b = Buffer.alloc(4)
  b.writeUInt32LE(n)
  return b
}
function u64(n: number): Buffer {
  const b = Buffer.alloc(8)
  b.writeBigUInt64LE(BigInt(n))
  return b
}

/** Builds a zip archive in memory for tests: deflated (method 8) by default, or stored, Zip64 or with an odd local extra field per row. */
export function buildZip(rows: readonly ZipRow[], comment = ''): Blob {
  const parts: Buffer[] = []
  const directory: Buffer[] = []
  let offset = 0
  const anyZip64 = rows.some((r) => r.zip64)
  for (const row of rows) {
    const method = row.method ?? 8
    const raw = Buffer.from(row.data)
    const packed = method === 8 ? deflateRawSync(raw) : raw
    const name = Buffer.from(row.name)
    const localExtra = Buffer.alloc(row.localExtra ?? 0, 0x7f)
    const local = Buffer.concat([
      u32(0x04034b50), u16(20), u16(0), u16(method), u16(0), u16(0), u32(0),
      u32(packed.length), u32(raw.length), u16(name.length), u16(localExtra.length), name, localExtra, packed,
    ])
    const extra = row.zip64 ? Buffer.concat([u16(1), u16(24), u64(raw.length), u64(packed.length), u64(offset)]) : Buffer.alloc(0)
    const wide = row.zip64 ? 0xffffffff : undefined
    directory.push(
      Buffer.concat([
        u32(0x02014b50), u16(45), u16(20), u16(0), u16(method), u16(0), u16(0), u32(0),
        u32(wide ?? packed.length), u32(wide ?? raw.length), u16(name.length), u16(extra.length), u16(0),
        u16(0), u16(0), u32(0), u32(wide ?? offset), name, extra,
      ]),
    )
    parts.push(local)
    offset += local.length
  }
  const cd = Buffer.concat(directory)
  parts.push(cd)
  const cdOffset = offset
  if (anyZip64) {
    const recordOffset = cdOffset + cd.length
    parts.push(
      Buffer.concat([
        u32(0x06064b50), u64(44), u16(45), u16(45), u32(0), u32(0),
        u64(rows.length), u64(rows.length), u64(cd.length), u64(cdOffset),
      ]),
      Buffer.concat([u32(0x07064b50), u32(0), u64(recordOffset), u32(1)]),
    )
  }
  const commentBytes = Buffer.from(comment)
  parts.push(
    Buffer.concat([
      u32(0x06054b50), u16(0), u16(0),
      u16(anyZip64 ? 0xffff : rows.length), u16(anyZip64 ? 0xffff : rows.length),
      u32(anyZip64 ? 0xffffffff : cd.length), u32(anyZip64 ? 0xffffffff : cdOffset),
      u16(commentBytes.length), commentBytes,
    ]),
  )
  return new Blob([Buffer.concat(parts)])
}
