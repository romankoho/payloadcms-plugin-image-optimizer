import { describe, expect, test } from 'vitest'

import type { ImageOptimizerConfig } from '../src/types.js'

import { buildSharpCollectionConfig, resolveCollectionConfig, resolveConfig } from '../src/defaults.js'
import { imageOptimizer } from '../src/index.js'

const build = (opts: ImageOptimizerConfig, slug = 'media') => {
  const resolved = resolveConfig(opts)
  return buildSharpCollectionConfig(resolved, resolveCollectionConfig(resolved, slug))
}

describe('sharpTransformer collection config (Payload 4)', () => {
  test('defaults: webp q80, 2560 inside resize without enlargement, metadata stripped', () => {
    const sharp = build({ collections: { media: true } })
    expect(sharp.formatOptions).toEqual({ format: 'webp', options: { quality: 80 } })
    expect(sharp.resizeOptions).toEqual({
      fit: 'inside',
      height: 2560,
      width: 2560,
      withoutEnlargement: true,
    })
    expect(sharp.withMetadata).toBe(false)
  })

  test('format: null disables format conversion', () => {
    expect(build({ collections: { media: true }, format: null }).formatOptions).toBeUndefined()
  })

  test('per-collection format and maxDimensions win over globals', () => {
    const sharp = build({
      collections: { avatars: { format: { format: 'avif', quality: 50 }, maxDimensions: { height: 256, width: 256 } } },
    }, 'avatars')
    expect(sharp.formatOptions).toEqual({ format: 'avif', options: { quality: 50 } })
    expect(sharp.resizeOptions).toMatchObject({ height: 256, width: 256 })
  })

  test('variants inherit the parent format unless they set their own', () => {
    const own = { format: 'png' as const }
    const sharp = build({
      collections: {
        media: { sharp: { variants: [{ name: 'thumb', width: 300 }, { name: 'raw', formatOptions: own, width: 600 }] } },
      },
    })
    expect(sharp.variants?.[0]?.formatOptions).toEqual({ format: 'webp', options: { quality: 80 } })
    expect(sharp.variants?.[1]?.formatOptions).toBe(own)
  })

  test('non-override: user sharp settings win over plugin defaults', () => {
    const resizeOptions = { width: 100 }
    const formatOptions = { format: 'jpeg' as const }
    const sharp = build({
      collections: { media: { sharp: { formatOptions, resizeOptions, trimOptions: { threshold: 5 }, withMetadata: true } } },
    })
    expect(sharp.resizeOptions).toBe(resizeOptions)
    expect(sharp.formatOptions).toBe(formatOptions)
    expect(sharp.withMetadata).toBe(true)
    expect(sharp.trimOptions).toEqual({ threshold: 5 })
  })

  test('stripMetadata=false leaves withMetadata undefined (Sharp default)', () => {
    expect(build({ collections: { media: true }, stripMetadata: false }).withMetadata).toBeUndefined()
  })

  test('metadataPolicy wins over stripMetadata and is forwarded to Sharp', async () => {
    const sharp = build({
      collections: { media: true },
      metadataPolicy: ({ metadata }) => metadata?.format === 'jpeg',
      stripMetadata: true,
    })
    expect(typeof sharp.withMetadata).toBe('function')
    const fn = sharp.withMetadata as (args: any) => Promise<boolean>
    await expect(fn({ metadata: { format: 'jpeg' }, req: {} })).resolves.toBe(true)
    await expect(fn({ metadata: { format: 'png' }, req: {} })).resolves.toBe(false)
  })
})

describe('plugin registers a sharpTransformer', () => {
  const config = () =>
    ({
      collections: [
        { slug: 'media', fields: [], upload: { staticDir: 'media' } },
        { slug: 'posts', fields: [] },
      ],
    }) as any

  test('appends one transformer with the plugin slug, after existing ones', () => {
    const existing = { slug: 'other', mimeTypes: ['text/plain'] }
    const result = imageOptimizer({ collections: { media: true } })({
      ...config(),
      upload: { transformers: [existing] },
    })
    const transformers = result.upload?.transformers ?? []
    expect(transformers).toHaveLength(2)
    expect(transformers[0]).toBe(existing)
    expect(transformers[1]?.slug).toBe('image-optimizer-sharp')
  })

  test('transformer.slug override is honored', () => {
    const result = imageOptimizer({ collections: { media: true }, transformer: { slug: 'my-sharp' } })(config())
    expect(result.upload?.transformers?.[0]?.slug).toBe('my-sharp')
  })

  test('no upload collection targeted: no transformer registered', () => {
    const result = imageOptimizer({ collections: { posts: true } })(config())
    expect(result.upload?.transformers).toBeUndefined()
  })

  test('disabled: transformer still registered so user variants keep the schema stable', () => {
    const result = imageOptimizer({ collections: { media: true }, disabled: true })(config())
    expect(result.upload?.transformers?.[0]?.slug).toBe('image-optimizer-sharp')
  })
})
