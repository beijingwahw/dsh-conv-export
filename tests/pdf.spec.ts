import { describe, expect, it } from 'vitest'
import { buildPdf } from '../src/client/exporters.ts'

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0xff, 0xd9])

function text(bytes: Uint8Array): string {
  return new TextDecoder('latin1').decode(bytes)
}

describe('buildPdf', () => {
  it('emits a well-formed single-page PDF', () => {
    const pdf = text(buildPdf([{ jpeg: JPEG, widthPx: 800, heightPx: 1131 }]))
    expect(pdf.startsWith('%PDF-1.4')).toBe(true)
    expect(pdf).toContain('/Type /Catalog')
    expect(pdf).toContain('/Count 1')
    expect(pdf).toContain('/Filter /DCTDecode')
    expect(pdf).toContain('endstream')
    expect(pdf).toContain('xref')
    expect(pdf).toContain('/Root 1 0 R')
    expect(pdf.trimEnd().endsWith('%%EOF')).toBe(true)
  })

  it('emits one page object triplet per slice', () => {
    const pdf = text(buildPdf([
      { jpeg: JPEG, widthPx: 800, heightPx: 1131 },
      { jpeg: JPEG, widthPx: 800, heightPx: 400 },
    ]))
    expect(pdf).toContain('/Count 2')
    expect(pdf.match(/\/Type \/Page /g)).toHaveLength(2)
    expect(pdf.match(/\/Subtype \/Image/g)).toHaveLength(2)
    // MediaBox reflects the slice heights (0.75 pt/px)
    expect(pdf).toContain('[0 0 600.00 848.25]')
    expect(pdf).toContain('[0 0 600.00 300.00]')
  })

  it('xref offsets point at object starts', () => {
    const bytes = text(buildPdf([{ jpeg: JPEG, widthPx: 800, heightPx: 1131 }]))
    const xref = bytes.slice(bytes.indexOf('xref'))
    const lines = xref.split('\n')
    // lines: 0=xref, 1="0 N", 2=free entry, 3=object 1 entry
    const entry = lines[3] ?? ''
    const offset = Number.parseInt(entry.slice(0, 10), 10)
    expect(bytes.slice(offset, offset + 7)).toBe('1 0 obj')
  })
})
