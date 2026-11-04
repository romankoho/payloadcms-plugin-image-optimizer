import { describe, expect, it } from 'vitest'

import type { GenerateFilenameArgs } from '../src/types.js'

import { resolveConfig } from '../src/defaults.js'
import { createBeforeOperationHook } from '../src/hooks/beforeOperation.js'
import {
  seoFilename,
  timestampFilename,
  uuidFilename,
} from '../src/utilities/filenameStrategies.js'

const args = (a: Partial<GenerateFilenameArgs>): GenerateFilenameArgs => ({
  collectionSlug: 'media',
  mimeType: 'image/jpeg',
  originalFilename: '',
  ...a,
})

describe('uuidFilename', () => {
  it('returns a UUID stem on first upload', () => {
    const result = uuidFilename(args({ originalFilename: 'photo.jpg' }))
    expect(result).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  })

  it('reuses existing stem on re-upload', () => {
    const result = uuidFilename(args({
      existingFilename: 'abc123.webp',
      originalFilename: 'photo.jpg',
    }))
    expect(result).toBe('abc123')
  })
})

describe('seoFilename', () => {
  it('slugifies alt text with timestamp suffix', () => {
    const result = seoFilename(args({
      altText: 'Geländer aus Edelstahl',
      originalFilename: 'IMG_1234.jpg',
    }))
    expect(result).toMatch(/^gelander-aus-edelstahl-\d{8}T\d{9}Z$/)
  })

  it('falls back to original stem when alt text is missing', () => {
    const result = seoFilename(args({ originalFilename: 'my-photo.jpg' }))
    expect(result).toMatch(/^my-photo-\d{8}T\d{9}Z$/)
  })

  it('reuses existing stem on re-upload', () => {
    const result = seoFilename(args({
      altText: 'new alt',
      existingFilename: 'old-stem.webp',
      originalFilename: 'photo.jpg',
    }))
    expect(result).toBe('old-stem')
  })

  it('falls back to img-<hash> for Cyrillic alt text', () => {
    const result = seoFilename(args({
      altText: 'Мой файл',
      originalFilename: 'IMG_1234.jpg',
    }))
    expect(result).toMatch(/^img-[0-9a-f]{8}-\d{8}T\d{9}Z$/)
  })

  it('falls back to img-<hash> for Chinese alt text', () => {
    const result = seoFilename(args({
      altText: '我的图片',
      originalFilename: 'IMG_1234.jpg',
    }))
    expect(result).toMatch(/^img-[0-9a-f]{8}-\d{8}T\d{9}Z$/)
  })

  it('falls back to img-<hash> when both alt text and stem are non-ASCII', () => {
    // Empty altText → uses originalFilename stem. If that also can't be
    // slugified (e.g. pure emoji/symbols), the hash fallback still kicks in.
    const result = seoFilename(args({ altText: '', originalFilename: '!@#.jpg' }))
    expect(result).toMatch(/^img-[0-9a-f]{8}-\d{8}T\d{9}Z$/)
  })

  it('uses millisecond precision — two calls ≥1ms apart in the same second differ', async () => {
    // The prior bug: seoFilename stripped ms, so two uploads within the same
    // second produced identical filenames and collided on cloud storage. With
    // ms retained, any two calls >=1ms apart are distinct. (Real HTTP uploads
    // are always orders of magnitude farther apart than that.)
    const a = seoFilename(args({ altText: 'same alt', originalFilename: 'x.jpg' }))
    await new Promise((resolve) => setTimeout(resolve, 2))
    const b = seoFilename(args({ altText: 'same alt', originalFilename: 'x.jpg' }))
    expect(a).not.toBe(b)
    // Both should have 9-digit time parts (HHMMSSmmm) — confirming ms are kept.
    expect(a).toMatch(/^same-alt-\d{8}T\d{9}Z$/)
    expect(b).toMatch(/^same-alt-\d{8}T\d{9}Z$/)
  })
})

describe('timestampFilename', () => {
  it('keeps original stem and appends ISO timestamp with ms', () => {
    const result = timestampFilename(args({ originalFilename: 'photo.jpg' }))
    expect(result).toMatch(/^photo-\d{8}T\d{9}Z$/)
  })

  it('slugifies diacritics and spaces in the stem', () => {
    const result = timestampFilename(args({ originalFilename: 'Geländer Foto.jpg' }))
    expect(result).toMatch(/^gelander-foto-\d{8}T\d{9}Z$/)
  })

  it('uses millisecond precision (same ms resolution as seoFilename)', () => {
    const seo = seoFilename(args({ altText: 'test', originalFilename: 'x.jpg' }))
    const ts = timestampFilename(args({ originalFilename: 'x.jpg' }))
    // Both strategies now keep ms → 9 digits (HHMMSSmmm) after the `T`.
    const seoTimePart = seo.match(/T(\d+)Z$/)?.[1]
    const tsTimePart = ts.match(/T(\d+)Z$/)?.[1]
    expect(seoTimePart).toBeDefined()
    expect(tsTimePart).toBeDefined()
    expect(seoTimePart!.length).toBe(9)
    expect(tsTimePart!.length).toBe(9)
  })

  it('ignores missing alt text (uses stem only)', () => {
    const result = timestampFilename(args({
      altText: 'this should be ignored',
      originalFilename: 'photo.jpg',
    }))
    expect(result).toMatch(/^photo-/)
    expect(result).not.toContain('this-should-be-ignored')
  })

  it('reuses existing stem on re-upload', () => {
    const result = timestampFilename(args({
      existingFilename: 'photo-20260420T104530123Z.webp',
      originalFilename: 'photo.jpg',
    }))
    expect(result).toBe('photo-20260420T104530123Z')
  })

  it('falls back to "media" when stem slugifies to empty', () => {
    const result = timestampFilename(args({ originalFilename: '!@#.jpg' }))
    expect(result).toMatch(/^media-\d{8}T\d{9}Z$/)
  })

  it('truncates very long stems to 60 chars', () => {
    const longStem = 'a'.repeat(100)
    const result = timestampFilename(args({ originalFilename: `${longStem}.jpg` }))
    const stemPart = result.split(/-\d{8}T/)[0]
    expect(stemPart.length).toBeLessThanOrEqual(60)
  })
})

describe('beforeOperation filename strategy (runs before the upload pipeline)', () => {
  const run = async (operation: 'create' | 'update', opts: { regenerating?: boolean } = {}) => {
    const hook = createBeforeOperationHook(
      resolveConfig({ collections: { media: true }, generateFilename: ({ altText }) => `stem-${altText}` }),
      'media',
    )
    const req: any = {
      context: { imageOptimizer_regenerating: opts.regenerating },
      file: { name: 'IMG_1.JPG', mimetype: 'image/jpeg', size: 123 },
      payload: { findByID: () => Promise.resolve({ filename: 'old.webp' }) },
    }
    await hook({ args: { id: 1, data: { alt: 'cat' }, req }, operation } as any)
    return req
  }

  it('renames req.file before generateFileData and snapshots the original size', async () => {
    const req = await run('create')
    expect(req.file.name).toBe('stem-cat.JPG')
    expect(req.context.imageOptimizer_originalSize).toBe(123)
  })

  it('leaves the name alone during regeneration', async () => {
    const req = await run('update', { regenerating: true })
    expect(req.file.name).toBe('IMG_1.JPG')
  })
})
