import { describe, expect, it } from 'vitest'
import { decodeOfx, parseOfx } from './ofx'

const sgml = `OFXHEADER:100
DATA:OFXSGML
ENCODING:USASCII
CHARSET:1252

<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<DTSTART>20261001000000[-3:BRT]
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261005120000[-3:BRT]
<TRNAMT>-26.98
<FITID>1
<MEMO>Compra no débito - IFOOD   SP
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20261006
<TRNAMT>2052,12
<FITID>2
<NAME>Salário &amp; bônus
</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`

describe('parseOfx', () => {
  it('lê OFX antigo, sem tags de fechamento', () => {
    expect(parseOfx(sgml)).toEqual([
      { description: 'Compra no débito - IFOOD SP', type: 'expense', date: '2026-10-05', amountCents: 2698 },
      { description: 'Salário & bônus', type: 'income', date: '2026-10-06', amountCents: 205212 },
    ])
  })
  it('lê OFX em XML, com tags fechadas e tudo numa linha', () => {
    const xml = '<?xml version="1.0"?><OFX><STMTTRN><DTPOSTED>20261005</DTPOSTED><TRNAMT>-10.00</TRNAMT><MEMO>Uber</MEMO></STMTTRN><STMTTRN><DTPOSTED>20261006</DTPOSTED><TRNAMT>5</TRNAMT><MEMO>Pix</MEMO></STMTTRN></OFX>'
    expect(parseOfx(xml).map(row => [row.description, row.amountCents, row.type])).toEqual([['Uber', 1000, 'expense'], ['Pix', 500, 'income']])
  })
  it('lê OFX antigo sem </STMTTRN>', () => {
    expect(parseOfx('<STMTTRN>\n<DTPOSTED>20261005\n<TRNAMT>-1.50\n<MEMO>A b\n<STMTTRN>\n<DTPOSTED>20261006\n<TRNAMT>-2\n<MEMO>C d\n</BANKTRANLIST>')).toHaveLength(2)
  })
  it('ignora valor zero e cobre descrição vazia', () => {
    const rows = parseOfx('<STMTTRN><DTPOSTED>20261005<TRNAMT>0.00<MEMO>Nada</STMTTRN><STMTTRN><DTPOSTED>20261005<TRNAMT>-3.00<MEMO></STMTTRN>')
    expect(rows).toEqual([{ description: 'Lançamento sem descrição', type: 'expense', date: '2026-10-05', amountCents: 300 }])
  })
  it('recusa arquivo sem lançamentos ou com dados inválidos', () => {
    expect(() => parseOfx('não é ofx')).toThrow('Nenhum lançamento')
    expect(() => parseOfx('<STMTTRN><DTPOSTED>ontem<TRNAMT>-1</STMTTRN>')).toThrow('inválido')
    expect(() => parseOfx('<STMTTRN><DTPOSTED>20261005<TRNAMT>abc</STMTTRN>')).toThrow('inválido')
    expect(() => parseOfx('<STMTTRN><DTPOSTED>20261005</STMTTRN>')).toThrow('inválido')
  })
  it('corta descrição maior que o limite do app', () => {
    expect(parseOfx(`<STMTTRN><DTPOSTED>20261005<TRNAMT>-1<MEMO>${'x'.repeat(200)}</STMTTRN>`)[0].description).toHaveLength(80)
  })
})

describe('decodeOfx', () => {
  const encode = (text: string) => Uint8Array.from(text, char => char.charCodeAt(0)).buffer
  it('usa Windows-1252 por padrão', () => {
    expect(decodeOfx(encode('CHARSET:1252\n<MEMO>Padaria S\xE3o Jo\xE3o'))).toContain('São João')
  })
  it('respeita UTF-8 do cabeçalho', () => {
    const bytes = new TextEncoder().encode('ENCODING:UTF-8\n<MEMO>São João')
    expect(decodeOfx(bytes.buffer as ArrayBuffer)).toContain('São João')
  })
})
