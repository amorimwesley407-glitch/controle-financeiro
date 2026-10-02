import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { localStorage, localStorageBucket, readLocalImage } from '@/lib/local-storage'

test('upload local mantém ownership, URLs privadas e remoção autorizada', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'clareza-storage-'))
  const previous = { ...process.env }
  process.env.LOCAL_STORAGE_DIR = root
  process.env.STORAGE_PROVIDER = 'local'
  try {
    const { uploadImage, signImageUrlsForUser, removeImagesForUser } = await import('@/lib/storage')
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x01])
    const reference = await uploadImage(new File([bytes], 'receipt.png', { type: 'image/png' }), 'owner-A', 'transaction-images')
    assert.ok(reference)
    assert.ok(reference.startsWith(`local-storage://${localStorageBucket}/owner-A/transaction-images/`))
    const objectPath = reference.slice(`local-storage://${localStorageBucket}/`.length)
    assert.deepEqual((await readLocalImage(objectPath, 'owner-A'))?.bytes, Buffer.from(bytes))
    assert.equal(await readLocalImage(objectPath, 'owner-B'), null)
    assert.equal((await signImageUrlsForUser('owner-B', [reference])).size, 0)
    assert.equal((await signImageUrlsForUser('owner-A', [reference])).get(reference), `/api/uploads/${objectPath}`)
    await removeImagesForUser('owner-B', [reference])
    assert.ok(await readLocalImage(objectPath, 'owner-A'))
    await removeImagesForUser('owner-A', [reference])
    assert.equal(await readLocalImage(objectPath, 'owner-A'), null)
    await assert.rejects(() => uploadImage(new File(['invalid'], 'invalid.png', { type: 'image/png' }), 'owner-A', 'profile-images'), /inválido/)
    await assert.rejects(() => localStorage().from(localStorageBucket).upload('../outside.png', bytes, { contentType: 'image/png', upsert: false }), /inválido/)
    assert.equal(await readLocalImage('../outside.png', 'owner-A'), null)
  } finally {
    process.env = previous
    await rm(root, { recursive: true, force: true })
  }
})
