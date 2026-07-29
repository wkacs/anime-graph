const MAX_MAL_EXPORT_BYTES = 10 * 1024 * 1024

/** Reads a MAL XML export, including the gzip-compressed files MAL may produce. */
export async function readMalExport(file: File): Promise<string> {
  if (file.size > MAX_MAL_EXPORT_BYTES) throw new Error('A MAL export legfeljebb 10 MB lehet.')

  const bytes = new Uint8Array(await file.arrayBuffer())
  const isGzip = bytes[0] === 0x1f && bytes[1] === 0x8b
  if (!isGzip) return new TextDecoder().decode(bytes)
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('Ez a böngésző nem tudja megnyitni a gzip-es MAL exportot. Csomagold ki az XML-t, és úgy töltsd fel.')
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
  const decompressed = await new Response(stream).arrayBuffer()
  if (decompressed.byteLength > MAX_MAL_EXPORT_BYTES) throw new Error('A kicsomagolt MAL export túl nagy (legfeljebb 10 MB lehet).')
  return new TextDecoder().decode(decompressed)
}
