import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ownedObjectPath, removeImage, signImageUrls } from './storage'

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

  describe('imagens antigas na pasta legacy', () => {
    const owner = 'aXkn170jRestoDoId'
    const legacy = (prefix: string, folder = 'category-icons', file = `${uuid}.png`) => `https://exemplo.supabase.co/storage/v1/object/public/finance-uploads/legacy/${folder}/${prefix}-${file}`

    it.each(['category-icons', 'transaction-images', 'profile-images'])('aceita as do próprio dono em %s', folder => {
      expect(ownedObjectPath(legacy('aXkn170j', folder), owner)).toBe(`legacy/${folder}/aXkn170j-${uuid}.png`)
    })

    it.each([
      ['de outro dono', legacy('5RBspOCG')],
      ['com código maior que 8 caracteres', legacy('aXkn170jR')],
      ['com ".." no caminho', legacy('aXkn170j', '../category-icons')],
      ['em pasta desconhecida', legacy('aXkn170j', 'outra-pasta')],
      ['com nome fora do padrão', legacy('aXkn170j', 'category-icons', 'foto.png')],
    ])('recusa %s', (_, value) => {
      expect(ownedObjectPath(value, owner)).toBeNull()
    })

    it('recusa quando o id do usuário é só o começo do código', () => {
      expect(ownedObjectPath(legacy('aXkn170j'), 'aXkn')).toBeNull()
    })
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

  it('gera link e apaga imagens antigas só do próprio dono', async () => {
    const owner = 'aXkn170jRestoDoId'
    const mine = `https://exemplo.supabase.co/storage/v1/object/public/finance-uploads/legacy/category-icons/aXkn170j-${uuid}.png`
    const other = `https://exemplo.supabase.co/storage/v1/object/public/finance-uploads/legacy/category-icons/5RBspOCG-${uuid}.png`
    const path = `legacy/category-icons/aXkn170j-${uuid}.png`
    expect([...await signImageUrls([mine, other], owner)]).toEqual([[mine, `https://assinado/${path}`]])
    await removeImage(other, owner)
    expect(supabase.bucket.remove).not.toHaveBeenCalled()
    await removeImage(mine, owner)
    expect(supabase.bucket.remove).toHaveBeenCalledWith([path])
  })

  it('só apaga imagens da pasta do próprio usuário', async () => {
    await removeImage(ref('bob456'), alice)
    expect(supabase.bucket.remove).not.toHaveBeenCalled()
    await removeImage(ref(alice), alice)
    expect(supabase.bucket.remove).toHaveBeenCalledWith([`${alice}/transaction-images/${uuid}.jpg`])
  })
})
