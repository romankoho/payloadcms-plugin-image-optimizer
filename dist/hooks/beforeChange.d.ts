import type { CollectionBeforeChangeHook } from 'payload';
import type { ResolvedImageOptimizerConfig } from '../types.js';
/**
 * Config-injection architecture.
 *
 * Payload's native `generateFileData()` pipeline (driven by the
 * `sharpTransformer` the plugin registers with `formatOptions`,
 * `resizeOptions`, `withMetadata`, and per-variant `formatOptions`) handles
 * all the actual image work — resize, format conversion, EXIF strip — before
 * this hook runs. By this point `req.file.data` is the optimized buffer Payload
 * will persist to disk / cloud storage.
 *
 * The filename strategy runs earlier, in `beforeOperation`.
 *
 * This hook only owns:
 *   • the early-bail when Payload is re-fetching its own file for a focal-point
 *     adjustment (no need to re-stamp anything)
 *   • the imageOptimizer status field (originalSize, optimizedSize, status,
 *     thumbHash)
 *
 * Status is always `complete` after this hook runs — no async handoff.
 */
export declare const createBeforeChangeHook: (resolvedConfig: ResolvedImageOptimizerConfig, _collectionSlug: string) => CollectionBeforeChangeHook;
