import type { SharpCollectionConfig } from '@payloadcms/transformer-sharp';
import type { ImageOptimizerConfig, ResolvedCollectionOptimizerConfig, ResolvedImageOptimizerConfig, ResolvedLoggingConfig } from './types.js';
/**
 * Resolves the `logging` option against preset baselines.
 *
 * - `undefined` → `'silent'` preset (errors-only, no lifecycle noise).
 * - `LoggingMode` → matching preset.
 * - `LoggingConfig` → merged field-by-field over the `'silent'` preset, with
 *   `skips` accepting a boolean shorthand or the per-reason object.
 *
 * Errors default on in every preset but can still be explicitly disabled via
 * the object form (`{ errors: false }`) for consumers that route task-boundary
 * errors through a different log pipeline.
 */
export declare const resolveLogging: (value: ImageOptimizerConfig["logging"]) => ResolvedLoggingConfig;
export declare const resolveConfig: (config: ImageOptimizerConfig) => ResolvedImageOptimizerConfig;
export declare const resolveCollectionConfig: (resolvedConfig: ResolvedImageOptimizerConfig, collectionSlug: string) => ResolvedCollectionOptimizerConfig;
/**
 * Builds the `sharpTransformer({ collections })` entry for one collection:
 * the plugin's defaults (format conversion, max-dimension resize, metadata
 * policy, per-variant format) underneath the user's own `sharp` settings.
 */
export declare const buildSharpCollectionConfig: (resolvedConfig: ResolvedImageOptimizerConfig, collectionConfig: ResolvedCollectionOptimizerConfig) => SharpCollectionConfig;
