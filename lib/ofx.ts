export type OfxTransaction = { description: string; type: 'income' | 'expense'; date: string; amountCents: number }

/** Lê o texto do arquivo respeitando a codificação do cabeçalho: bancos brasileiros costumam usar Windows-1252. */
export function decodeOfx(bytes: ArrayBuffer) {
  const header = new TextDecoder('latin1').decode(bytes.slice(0, 1024))
  const isUtf8 = /ENCODING:\s*UTF-?8|encoding=["']UTF-?8/i.test(header)
  return new TextDecoder(isUtf8 ? 'utf-8' : 'windows-1252').decode(bytes)
}

const unescapeXml = (text: string) => text
  .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&apos;/gi, "'").replace(/&amp;/gi, '&')

/** O OFX antigo é SGML e não fecha as tags, então o valor vai até a próxima tag ou o fim da linha. */
const tagValue = (block: string, tag: string) => {
  const match = new RegExp(`<${tag}>([^<\\r\\n]*)`, 'i').exec(block)
  return match ? unescapeXml(match[1]).trim() : ''
}

/** Lançamentos de um extrato OFX de conta ou de cartão. O sinal do valor define se é receita ou despesa. */
export function parseOfx(text: string): OfxTransaction[] {
  const blocks = text.match(/<STMTTRN>[\s\S]*?(?=<\/STMTTRN>|<STMTTRN>|<\/BANKTRANLIST>|$)/gi)
  if (!blocks) throw new Error('Nenhum lançamento encontrado no arquivo OFX')
  return blocks.flatMap((block, index) => {
    const rawDate = /^(\d{4})(\d{2})(\d{2})/.exec(tagValue(block, 'DTPOSTED'))
    const amount = Number(tagValue(block, 'TRNAMT').replace(',', '.'))
    if (!rawDate || !tagValue(block, 'TRNAMT') || !Number.isFinite(amount)) throw new Error(`Lançamento ${index + 1} do OFX é inválido: confira a data e o valor.`)
    if (amount === 0) return []
    const description = (tagValue(block, 'MEMO') || tagValue(block, 'NAME')).replace(/\s+/g, ' ').slice(0, 80).trim()
    return [{
      description: description.length >= 2 ? description : 'Lançamento sem descrição',
      type: amount > 0 ? 'income' as const : 'expense' as const,
      date: `${rawDate[1]}-${rawDate[2]}-${rawDate[3]}`,
      amountCents: Math.round(Math.abs(amount) * 100),
    }]
  })
}
