'use client'

import React, { type CSSProperties, type ImgHTMLAttributes, useState } from 'react'

import type { MediaResource } from '../types.js'

import { getImageOptimizerProps } from '../utilities/getImageOptimizerProps.js'
import { getDefaultSizes, getResponsiveImageProps } from '../utilities/responsiveImage.js'

export interface ImageBoxProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'alt' | 'src' | 'srcSet'> {
  alt?: string
  /** Enable smooth blur-to-sharp fade transition on load. Defaults to `true`. */
  fade?: boolean
  /** Duration of the fade animation in milliseconds. Defaults to `500`. */
  fadeDuration?: number
  /** Stretch the image over its (positioned) parent, like `next/image`'s `fill`. */
  fill?: boolean
  media: MediaResource | string
  /** Load eagerly with high fetch priority (above-the-fold / LCP images). */
  priority?: boolean
}

export const fillStyle: CSSProperties = {
  height: '100%',
  inset: 0,
  position: 'absolute',
  width: '100%',
}

/**
 * Framework-agnostic `<img>` for Payload media: responsive `srcSet` from the
 * pre-generated variants, ThumbHash blur placeholder, focal-point
 * positioning, and a blur-to-sharp fade. Works on TanStack Start and any
 * other React renderer. Next.js users who want `next/image` should import
 * `ImageBox` from `@inoo-ch/payload-image-optimizer/next` instead.
 */
export const ImageBox: React.FC<ImageBoxProps> = ({
  alt: altFromProps,
  fade = true,
  fadeDuration = 500,
  fill,
  height: heightFromProps,
  loading: loadingFromProps,
  media,
  onLoad,
  priority,
  sizes,
  style: styleFromProps,
  width: widthFromProps,
  ...props
}) => {
  const [loaded, setLoaded] = useState(false)

  const isString = typeof media === 'string'
  const responsive = isString ? { src: media } : getResponsiveImageProps(media)
  const optimizerProps = getImageOptimizerProps(isString ? null : media)
  const alt = altFromProps ?? (isString ? '' : media.alt || media.filename || '')
  const blur = fade && !loaded ? optimizerProps.blurDataURL : undefined

  return (
    <img
      {...props}
      alt={alt}
      decoding="async"
      fetchPriority={priority ? 'high' : props.fetchPriority}
      height={fill ? undefined : (heightFromProps ?? responsive.height)}
      loading={priority ? 'eager' : (loadingFromProps ?? 'lazy')}
      onLoad={(e) => {
        setLoaded(true)
        onLoad?.(e)
      }}
      sizes={sizes ?? getDefaultSizes(fill) ?? (responsive.srcSet ? '100vw' : undefined)}
      src={responsive.src}
      srcSet={responsive.srcSet}
      style={{
        objectFit: 'cover',
        ...optimizerProps.style,
        ...(fill ? fillStyle : undefined),
        ...(blur
          ? { backgroundImage: `url("${blur}")`, backgroundPosition: 'center', backgroundSize: 'cover' }
          : undefined),
        ...(fade
          ? {
              filter: loaded ? 'blur(0px)' : 'blur(20px)',
              transition: loaded ? `filter ${fadeDuration}ms ease-in-out` : undefined,
            }
          : undefined),
        ...styleFromProps,
      }}
      width={fill ? undefined : (widthFromProps ?? responsive.width)}
    />
  )
}
