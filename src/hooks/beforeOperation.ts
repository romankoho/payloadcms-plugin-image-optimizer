import type { CollectionBeforeOperationHook, CollectionSlug } from 'payload'

import path from 'path'

import type { ResolvedImageOptimizerConfig } from '../types.js'

/**
 * Runs before Payload's `generateFileData()` touches the upload.
 *
 * 1. Captures the original (pre-pipeline) upload size into request context.
 *    `generateFileData()` replaces `req.file` with the transformed buffer
 *    before any `beforeChange` hook runs, so the original byte count is gone
 *    by then. `beforeChange` reads it back from `req.context`.
 *
 * 2. Applies the optional filename strategy. In Payload 4 the file paths to
 *    write are fixed inside `generateFileData()`, so the rename has to happen
 *    here — renaming in `beforeChange` would desync the stored filename from
 *    the file on disk / in cloud storage. Only the stem is chosen here; the
 *    pipeline swaps the extension to match the output bytes (e.g. `.webp`).
 */
export const createBeforeOperationHook = (
  resolvedConfig: ResolvedImageOptimizerConfig,
  collectionSlug: string,
): CollectionBeforeOperationHook => {
  return async ({ args, operation }) => {
    if (operation !== 'create' && operation !== 'update') {return args}
    const req = args.req
    const file = req?.file
    if (!file?.mimetype?.startsWith('image/')) {return args}

    if (typeof file.size === 'number') {
      req.context.imageOptimizer_originalSize = file.size
    }

    // The regeneration task re-uploads under the existing name on purpose.
    if (!resolvedConfig.generateFilename || req.context.imageOptimizer_regenerating) {return args}

    let existingFilename: string | undefined
    const id = (args as { id?: number | string }).id
    if (operation === 'update' && id != null) {
      const existing = await req.payload
        .findByID({
          id,
          collection: collectionSlug as CollectionSlug,
          depth: 0,
          overrideAccess: true,
          req,
          select: { filename: true },
        })
        .catch(() => null)
      existingFilename = (existing as { filename?: string } | null)?.filename ?? undefined
    }

    const data = args.data as Record<string, unknown> | undefined
    const stem = resolvedConfig.generateFilename({
      altText: typeof data?.alt === 'string' ? data.alt : undefined,
      collectionSlug,
      existingFilename,
      mimeType: file.mimetype,
      originalFilename: file.name,
    })
    file.name = `${stem}${path.extname(file.name)}`

    return args
  }
}
