import { beforeEach, describe, expect, it, vi } from 'vitest'

const supabase = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://exemplo.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'chave-de-teste'
  const bucket = {
    remove: vi.fn(async () => ({ error: null })),
    createSignedUrls: vi.fn(async (paths: string[]) => ({ data: paths.map(path => ({ signedUrl: `https://assinado/${path}` })), error: null })),
  }
  return { bucket }
})
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ storage: { from: () => supabase.bucket } }) }))

const { ownedObjectPath, removeImage, signImageUrls } = await import('./storage')

const uuid = '0f8b2a4e-1c3d-4e5f-8a9b-0c1d2e3f4a5b'
const alice = 'alice123'
const ref = (owner: string, folder = 'transaction-images', file = `${uuid}.jpg`) => `supabase-storage://finance-uploads/${owner}/${folder}/${file}`

describe('ownedObjectPath', () => {
  it('aceita imagens da pasta do próprio usuário, nos dois formatos', () => {
    expect(ownedObjectPath(ref(alice), alice)).toBe(`${alice}/transaction-images/${uuid}.jpg`)
    expect(ownedObjectPath(`https://exemplo.supabase.co/storage/v1/object/public/finance-uploads/${alice}/profile-images/${uuid}.png`, alice))
      .toBe(`${alice}/profile-images/${uuid}.png`)
  })

  it.each([
    ['de outro usuário', ref('bob456')],
    ['de usuário com o mesmo começo de id', ref(`${alice}x`)],
    ['com ".." no caminho', `supabase-storage://finance-uploads/${alice}/../bob456/transaction-images/${uuid}.jpg`],
    ['com caractere codificado', ref(alice, 'transaction-images', `${uuid}%2ejpg`)],
    ['em pasta desconhecida', ref(alice, 'outra-pasta')],
    ['com nome de arquivo fora do padrão', ref(alice, 'transaction-images', 'foto.jpg')],
    ['de outro bucket', `supabase-storage://outro-bucket/${alice}/transaction-images/${uuid}.jpg`],
    ['link externo', 'https://exemplo.com/foto.jpg'],
    ['vazio', null],
  ])('recusa caminho %s', (_, value) => {
    expect(ownedObjectPath(value, alice)).toBeNull()
  })

  it('recusa tudo quando não há usuário', () => {
    expect(ownedObjectPath(ref(''), '')).toBeNull()
  })
})

describe('signImageUrls e removeImage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('só gera link para as imagens do próprio usuário', async () => {
    const urls = await signImageUrls([ref(alice), ref('bob456'), 'https://exemplo.com/rastreador.png', null], alice)
    expect(supabase.bucket.createSignedUrls).toHaveBeenCalledWith([`${alice}/transaction-images/${uuid}.jpg`], 3600)
    expect([...urls]).toEqual([[ref(alice), `https://assinado/${alice}/transaction-images/${uuid}.jpg`]])
  })

  it('não chama o Storage quando nenhuma imagem é do usuário', async () => {
    expect((await signImageUrls([ref('bob456')], alice)).size).toBe(0)
    expect(supabase.bucket.createSignedUrls).not.toHaveBeenCalled()
  })

  it('só apaga imagens da pasta do próprio usuário', async () => {
    await removeImage(ref('bob456'), alice)
    expect(supabase.bucket.remove).not.toHaveBeenCalled()
    await removeImage(ref(alice), alice)
    expect(supabase.bucket.remove).toHaveBeenCalledWith([`${alice}/transaction-images/${uuid}.jpg`])
  })
})
