import { sharpTransformer } from '@payloadcms/transformer-sharp';
import { deepMergeSimple } from 'payload/shared';
import { buildSharpCollectionConfig, resolveCollectionConfig, resolveConfig } from './defaults.js';
import { createCancelHandler, createRegenerateHandler, createRegenerateStatusHandler } from './endpoints/regenerate.js';
import { getImageOptimizerField } from './fields/imageOptimizerField.js';
import { createBeforeChangeHook } from './hooks/beforeChange.js';
import { createBeforeOperationHook } from './hooks/beforeOperation.js';
import { createRegenerateDocumentHandler } from './tasks/regenerateDocument.js';
import { translations } from './translations/index.js';
export { defaultImageOptimizerFields } from './fields/imageOptimizerField.js';
export { seoFilename, timestampFilename, uuidFilename } from './utilities/filenameStrategies.js';
export { decodeThumbHashToDataURL, encodeImageToThumbHash } from './utilities/thumbhash.js';
/**
 * Recommended maxDuration for the Payload API route on Vercel.
 * Re-export this in your route file:
 *
 *   export { maxDuration } from '@inoo-ch/payload-image-optimizer'
 *
 * Set to 300 to match Vercel's current platform default (up from 60/90 in
 * earlier plans). Large-file regenerations routinely need more than 60s
 * between source download, sharp processing, and cloud-storage re-upload.
 * Consumers who want a tighter ceiling can set their own `export const
 * maxDuration = <n>` on the route file, which takes precedence.
 */ export const maxDuration = 300;
export const imageOptimizer = (pluginOptions)=>(config)=>{
        const resolvedConfig = resolveConfig(pluginOptions);
        const targetSlugs = Object.keys(resolvedConfig.collections);
        const sharpCollections = {};
        // Inject fields (and hooks when enabled) into targeted upload collections
        const collections = (config.collections || []).map((collection)=>{
            if (!targetSlugs.includes(collection.slug)) {
                return collection;
            }
            // Always inject fields for schema consistency (even when disabled)
            const fields = [
                ...collection.fields,
                getImageOptimizerField({
                    fieldsOverride: pluginOptions.fieldsOverride,
                    storeBlurDataURL: resolvedConfig.storeBlurDataURL
                })
            ];
            if (resolvedConfig.disabled) {
                // Keep the user's own Sharp settings (variants!) registered so the
                // schema doesn't change when the plugin is toggled off.
                if (collection.upload) {
                    sharpCollections[collection.slug] = resolveCollectionConfig(resolvedConfig, collection.slug).sharp;
                }
                return {
                    ...collection,
                    fields
                };
            }
            // ──────────────────────────────────────────────────────────────────────────
            // Config-injection. Payload 4 moved resize / format conversion / metadata
            // strip out of `collection.upload` into `@payloadcms/transformer-sharp`.
            // We collect the per-collection Sharp settings here and register one
            // `sharpTransformer` for all targeted collections below. The plugin only
            // owns ThumbHash, status tracking, optional filename strategy, and the
            // regeneration UI.
            //
            // Non-override rule: values the user set in `collections.<slug>.sharp`
            // (or on `collection.upload` for adminThumbnail / modifyResponseHeaders)
            // win over the plugin's defaults.
            // ──────────────────────────────────────────────────────────────────────────
            const hasUploadConfig = collection.upload != null && collection.upload !== false;
            const perCollectionConfig = resolveCollectionConfig(resolvedConfig, collection.slug);
            const userUpload = typeof collection.upload === 'object' && collection.upload !== null ? collection.upload : {};
            if (hasUploadConfig) {
                sharpCollections[collection.slug] = buildSharpCollectionConfig(resolvedConfig, perCollectionConfig);
            }
            const injectedUpload = {
                ...userUpload
            };
            // adminThumbnail — when the user hasn't already set one on the collection.
            // - 'auto' (default): function form that prefers the smallest
            //   pre-generated variant's URL from `doc.variants` (to avoid downloading the
            //   full parent file into a ~50px list row), falling back to Payload's
            //   canonical file URL from `doc.filename`. Surviving the v2
            //   parent-extension change.
            // - string / function: pass through.
            //
            // Note: Payload's `upload.staticDir` is a filesystem path, not a URL
            // prefix. The URL Payload serves files from is `/api/{slug}/file/{name}`
            // (see the per-variant `url` fields). We build that pattern here.
            if (userUpload.adminThumbnail === undefined) {
                const opt = resolvedConfig.adminThumbnail;
                if (opt === 'auto') {
                    const slug = collection.slug;
                    injectedUpload.adminThumbnail = ({ doc })=>{
                        const filename = doc.filename;
                        const variants = doc.variants;
                        if (variants) {
                            let smallest = null;
                            for (const v of Object.values(variants)){
                                if (!v) {
                                    continue;
                                }
                                if (typeof v.url !== 'string' || typeof v.width !== 'number') {
                                    continue;
                                }
                                if (!smallest || v.width < smallest.width) {
                                    smallest = {
                                        url: v.url,
                                        width: v.width
                                    };
                                }
                            }
                            if (smallest) {
                                return smallest.url;
                            }
                        }
                        if (!filename) {
                            return null;
                        }
                        return `/api/${slug}/file/${filename}`;
                    };
                } else if (typeof opt === 'string' || typeof opt === 'function') {
                    injectedUpload.adminThumbnail = opt;
                }
            }
            // responseHeaders — opt-in cache header policy for file responses.
            if (userUpload.modifyResponseHeaders === undefined) {
                const opt = resolvedConfig.responseHeaders;
                if (opt === 'immutable') {
                    // Long-lived immutable caching is only safe when filenames are stable
                    // (UUID / content-hashed). Without `generateFilename`, a re-uploaded
                    // file under the same name would be served stale by intermediaries
                    // for up to a year. Warn loudly at init rather than silently shipping
                    // a footgun.
                    if (!resolvedConfig.generateFilename) {
                        const logger = config.logger;
                        const msg = `[image-optimizer] responseHeaders: 'immutable' is enabled on collection "${collection.slug}" ` + `without a custom generateFilename. Re-uploads under the same filename will be cached as ` + `immutable for 1 year and served stale. Use generateFilename: uuidFilename (or seoFilename) ` + `to make filenames content-stable.`;
                        if (logger?.warn) {
                            logger.warn(msg);
                        } else {
                            // eslint-disable-next-line no-console
                            console.warn(msg);
                        }
                    }
                    injectedUpload.modifyResponseHeaders = ({ headers })=>{
                        headers.set('Cache-Control', 'public, max-age=31536000, immutable');
                        return headers;
                    };
                } else if (typeof opt === 'function') {
                    // Pass-through: adapt our (headers, args) signature to Payload's ({ headers })
                    // shape. Payload doesn't currently pass `doc`, so we emit a placeholder.
                    injectedUpload.modifyResponseHeaders = ({ headers })=>opt(headers, {
                            doc: undefined
                        }) ?? headers;
                }
            }
            return {
                ...collection,
                fields,
                ...hasUploadConfig ? {
                    upload: injectedUpload
                } : {},
                admin: {
                    ...collection.admin,
                    components: {
                        ...collection.admin?.components,
                        ...resolvedConfig.clientOptimization && !collection.admin?.components?.edit?.Upload ? {
                            edit: {
                                ...collection.admin?.components?.edit,
                                Upload: '@inoo-ch/payload-image-optimizer/client#UploadOptimizer'
                            }
                        } : {},
                        ...resolvedConfig.regenerateButton.enabled ? {
                            beforeListTable: [
                                ...collection.admin?.components?.beforeListTable || [],
                                '@inoo-ch/payload-image-optimizer/client#RegenerationButton'
                            ]
                        } : {}
                    }
                },
                hooks: {
                    ...collection.hooks,
                    beforeChange: [
                        ...collection.hooks?.beforeChange || [],
                        createBeforeChangeHook(resolvedConfig, collection.slug)
                    ],
                    beforeOperation: [
                        ...collection.hooks?.beforeOperation || [],
                        createBeforeOperationHook(resolvedConfig, collection.slug)
                    ]
                }
            };
        });
        const upload = Object.keys(sharpCollections).length ? {
            ...config.upload,
            transformers: [
                ...config.upload?.transformers ?? [],
                sharpTransformer({
                    slug: 'image-optimizer-sharp',
                    ...pluginOptions.transformer,
                    collections: sharpCollections
                })
            ]
        } : config.upload;
        const i18n = {
            ...config.i18n,
            translations: deepMergeSimple(translations, config.i18n?.translations ?? {})
        };
        // If disabled, return with fields injected but no tasks/endpoints
        if (resolvedConfig.disabled) {
            return {
                ...config,
                collections,
                i18n,
                upload
            };
        }
        return {
            ...config,
            collections,
            endpoints: [
                ...config.endpoints ?? [],
                {
                    handler: createRegenerateHandler(resolvedConfig),
                    method: 'post',
                    path: '/image-optimizer/regenerate'
                },
                {
                    handler: createRegenerateStatusHandler(resolvedConfig),
                    method: 'get',
                    path: '/image-optimizer/regenerate'
                },
                {
                    handler: createCancelHandler(resolvedConfig),
                    method: 'delete',
                    path: '/image-optimizer/regenerate'
                }
            ],
            globals: [
                ...config.globals || [],
                {
                    slug: 'image-optimizer-state',
                    // Plugin code accesses this with `overrideAccess: true`; over REST /
                    // GraphQL only logged-in users may read or change it.
                    access: {
                        read: ({ req })=>Boolean(req.user),
                        update: ({ req })=>Boolean(req.user)
                    },
                    admin: {
                        hidden: true
                    },
                    // Internal bookkeeping: no version history or authorship fields.
                    authorship: false,
                    fields: [
                        {
                            name: 'collections',
                            type: 'json'
                        }
                    ],
                    versions: false
                }
            ],
            i18n,
            jobs: {
                ...config.jobs,
                tasks: [
                    ...config.jobs?.tasks || [],
                    {
                        slug: 'imageOptimizer_regenerateDocument',
                        handler: createRegenerateDocumentHandler(resolvedConfig),
                        inputSchema: [
                            {
                                name: 'collectionSlug',
                                type: 'text',
                                required: true
                            },
                            {
                                name: 'docId',
                                type: 'text',
                                required: true
                            }
                        ],
                        outputSchema: [
                            {
                                name: 'status',
                                type: 'text'
                            },
                            {
                                name: 'reason',
                                type: 'text'
                            }
                        ],
                        retries: 2
                    }
                ]
            },
            upload
        };
    };

//# sourceMappingURL=index.js.map