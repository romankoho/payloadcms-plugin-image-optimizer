import type { MediaResource, MediaSizeVariant } from '../types.js'

type ImageLoaderProps = { quality?: number | undefined; src: string; width: number }
type ImageLoader = (props: ImageLoaderProps) => string

type ValidVariant = { url: string; width: number }

/**
 * Relative aspect-ratio tolerance for variant filtering.
 *
 * Sharp rounds variant dimensions to integers, so a source of 1700×1365 (ratio 1.2454)
 * can produce a 1400×1124 variant (ratio 1.2456) — an irreducible ~0.02% drift purely
 * from rounding. 3% gives small variants room to breathe while still excluding
 * anything that's actually a different aspect (e.g. a 1200×630 OG crop vs a 4:3 source).
 */
const ASPECT_RATIO_TOLERANCE = 0.03

/**
 * Decides whether a variant shares the source image's aspect ratio closely enough
 * to belong in a responsive `srcset`.
 *
 * Degrades gracefully: when either dimension is missing we can't compute a ratio,
 * so we keep the variant rather than nuking the whole srcset.
 */
function variantMatchesSourceAspect(
  variant: MediaSizeVariant,
  sourceAspect: null | number,
): boolean {
  if (sourceAspect === null) {return true}
  if (typeof variant.width !== 'number' || typeof variant.height !== 'number') {return true}
  if (variant.height === 0) {return true}

  const variantAspect = variant.width / variant.height
  const drift = Math.abs(variantAspect - sourceAspect) / sourceAspect
  return drift <= ASPECT_RATIO_TOLERANCE
}

/**
 * Extracts usable variants from a Payload media resource's `variants` field.
 *
 * Filters out entries missing url/width, excludes variants whose aspect ratio
 * doesn't match the source (within {@link ASPECT_RATIO_TOLERANCE}), and sorts
 * by width ascending. Aspect filtering prevents fixed-crop variants like
 * `og` (1200×630) or `square` (500×500) from polluting responsive srcsets.
 */
export function getValidVariants(media: MediaResource): ValidVariant[] {
  if (!media.variants) {return []}

  const sourceAspect =
    typeof media.width === 'number' &&
    typeof media.height === 'number' &&
    media.height > 0
      ? media.width / media.height
      : null

  return Object.values(media.variants)
    .filter((v): v is { url: string; width: number } & MediaSizeVariant =>
      v != null && typeof v.url === 'string' && typeof v.width === 'number',
    )
    .filter((v) => variantMatchesSourceAspect(v, sourceAspect))
    .sort((a, b) => a.width - b.width)
}

/**
 * Finds the best pre-generated variant for a requested width.
 *
 * Strategy:
 * 1. Pick the smallest variant with width >= requested (no quality loss from upscaling)
 * 2. If none is large enough, use the largest variant — but only if it covers >= 80%
 *    of the requested width (minor downscale is acceptable, large gap is not)
 * 3. Returns null when no suitable variant exists → caller should fall back to /_next/image
 */
export function findBestVariant(
  variants: ValidVariant[],
  requestedWidth: number,
): null | ValidVariant {
  if (variants.length === 0) {return null}

  // Smallest variant >= requested width
  const larger = variants.find((v) => v.width >= requestedWidth)
  if (larger) {return larger}

  // No variant large enough — use the largest if it's close
  const largest = variants[variants.length - 1]
  if (largest.width >= requestedWidth * 0.8) {return largest}

  return null
}

/**
 * Appends `v=<updatedAt>` so a re-processed file isn't served stale from
 * caches. URLs may already carry a query string (signed CDN URLs); append
 * with `&` in that case.
 */
export function appendCacheBust(url: string, updatedAt: null | string | undefined): string {
  if (!updatedAt || !url) {return url}
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}v=${encodeURIComponent(String(updatedAt))}`
}

/**
 * Framework-agnostic responsive attributes for a plain `<img>`: `src` plus a
 * width-descriptor `srcSet` built from the pre-generated, aspect-matched
 * variants. The main file is appended as the widest candidate when it is
 * wider than every variant. Works on TanStack Start, Vite, Remix, Astro, or
 * anything else that renders HTML — no image optimizer route required.
 *
 * ```tsx
 * import { getResponsiveImageProps } from '@inoo-ch/payload-image-optimizer/frontend'
 *
 * <img {...getResponsiveImageProps(media)} sizes="100vw" alt={media.alt ?? ''} />
 * ```
 */
export function getResponsiveImageProps(media: MediaResource): {
  height?: number
  src: string
  srcSet?: string
  width?: number
} {
  const src = appendCacheBust(media.url ?? '', media.updatedAt)
  const variants = getValidVariants(media)
  const candidates = variants.map((v) => `${appendCacheBust(v.url, media.updatedAt)} ${v.width}w`)

  const width = typeof media.width === 'number' ? media.width : undefined
  const largest = variants[variants.length - 1]
  if (src && width && candidates.length > 0 && (!largest || width > largest.width)) {
    candidates.push(`${src} ${width}w`)
  }

  return {
    height: typeof media.height === 'number' ? media.height : undefined,
    src,
    srcSet: candidates.length > 0 ? candidates.join(', ') : undefined,
    width,
  }
}

/**
 * Creates a Next.js Image `loader` that maps requested widths to pre-generated
 * Payload size variants when a close match exists, falling back to the default
 * `/_next/image` optimization pipeline when no suitable variant is available.
 *
 * Returns `undefined` when the media has no usable size variants (i.e. no custom
 * loader needed — let next/image use its default behavior).
 *
 * ```tsx
 * import { createVariantLoader } from '@inoo-ch/payload-image-optimizer/frontend'
 *
 * const loader = createVariantLoader(media)
 * <NextImage loader={loader} src={media.url} ... />
 * ```
 */
export function createVariantLoader(media: MediaResource): ImageLoader | undefined {
  const variants = getValidVariants(media)
  if (variants.length === 0) {return undefined}

  // Pre-resolve the largest valid variant once; closure-captured for the
  // saturation check on each loader invocation. `getValidVariants` already
  // sorted ascending, so the last entry is the widest aspect-matched variant
  // (cover crops like `og`/`square` are filtered out — see v1.11.1).
  const largestVariant = variants[variants.length - 1]
  const sourceWidth = typeof media.width === 'number' ? media.width : null

  const withCacheBust = (url: string): string => appendCacheBust(url, media.updatedAt)

  return ({ quality, src, width }) => {
    const match = findBestVariant(variants, width)
    if (match) {return withCacheBust(match.url)}

    // Saturation: when the source has no more pixels than our largest
    // variant, returning the largest variant URL is strictly better than
    // routing through `/_next/image`. Next.js would re-derive the same
    // pixels from the (already-saturated) parent file and add a network
    // hop — same bytes, slower delivery. The condition `sourceWidth <=
    // largestWidth` is the precise trigger: it means "no extra resolution
    // exists anywhere." When the source is wider than the largest variant
    // (the common case for fresh uploads above maxDimensions), `/_next/image`
    // legitimately has more pixels to work with and we keep the fallback.
    if (sourceWidth != null && largestVariant && sourceWidth <= largestVariant.width) {
      return withCacheBust(largestVariant.url)
    }

    // Fall back to next/image optimization for unmatched widths. Pass through
    // the consumer's explicit `quality` prop, but omit `q` entirely when they
    // haven't supplied one — Next.js then applies its server-side default
    // (75, which is always present in `images.qualities`). Hardcoding a
    // fallback of 80 here was a footgun: any consumer whose `next.config`
    // qualities array didn't list 80 got `400` from `/_next/image` with no
    // hint that the loader was the cause.
    const q = quality ? `&q=${quality}` : ''
    return `/_next/image?url=${encodeURIComponent(src)}&w=${width}${q}`
  }
}

/**
 * Returns a sensible default `sizes` attribute for responsive images.
 *
 * For `fill` mode images without an explicit `sizes` prop, this prevents the
 * browser from assuming `100vw` (which causes it to always download the
 * largest srcSet variant regardless of actual display area).
 */
export function getDefaultSizes(fill: boolean | undefined): string | undefined {
  if (!fill) {return undefined}
  return '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw'
}
