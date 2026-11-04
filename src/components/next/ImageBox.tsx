'use client'

import NextImage, { type ImageProps } from 'next/image'
import React, { useMemo, useState } from 'react'

import type { MediaResource } from '../../types.js'

import { getImageOptimizerProps } from '../../utilities/getImageOptimizerProps.js'
import { createVariantLoader, getDefaultSizes } from '../../utilities/responsiveImage.js'

export interface ImageBoxProps extends Omit<ImageProps, 'alt' | 'src'> {
  alt?: string
  /** Enable smooth blur-to-sharp fade transition on load. Defaults to `true`. */
  fade?: boolean
  /** Duration of the fade animation in milliseconds. Defaults to `500`. */
  fadeDuration?: number
  media: MediaResource | string
}

export const ImageBox: React.FC<ImageBoxProps> = ({
  alt: altFromProps,
  fade = true,
  fadeDuration = 500,
  fill,
  loading: loadingFromProps,
  media,
  priority,
  sizes,
  style: styleFromProps,
  ...props
}) => {
  const [loaded, setLoaded] = useState(false)
  const loading = priority ? undefined : (loadingFromProps ?? 'lazy')
  // Hooks must run before the string-src early return.
  const variantLoader = useMemo(
    () => (typeof media === 'string' ? undefined : createVariantLoader(media)),
    [media],
  )

  const fadeStyle = fade
    ? {
        filter: loaded ? 'blur(0px)' : 'blur(20px)',
        transition: loaded ? `filter ${fadeDuration}ms ease-in-out` : undefined,
      }
    : undefined

  if (typeof media === 'string') {
    return (
      <NextImage
        {...props}
        alt={altFromProps || ''}
        fill={fill}
        loading={loading}
        onLoad={fade ? () => setLoaded(true) : undefined}
        priority={priority}
        quality={80}
        sizes={sizes ?? getDefaultSizes(fill)}
        src={media}
        style={{ objectFit: 'cover', objectPosition: 'center', ...fadeStyle, ...styleFromProps }}
      />
    )
  }

  const width = media.width ?? undefined
  const height = media.height ?? undefined
  const alt = altFromProps || (media as any).alt || media.filename || ''
  const src = media.url ? `${media.url}${media.updatedAt ? `?${media.updatedAt}` : ''}` : ''

  const optimizerProps = getImageOptimizerProps(media)

  return (
    <NextImage
      {...props}
      alt={alt}
      blurDataURL={optimizerProps.blurDataURL}
      fill={fill}
      height={!fill ? height : undefined}
      loader={variantLoader}
      loading={loading}
      onLoad={fade ? () => setLoaded(true) : undefined}
      placeholder={optimizerProps.placeholder}
      priority={priority}
      quality={80}
      sizes={sizes ?? getDefaultSizes(fill)}
      src={src}
      style={{ objectFit: 'cover', ...optimizerProps.style, ...fadeStyle, ...styleFromProps }}
      width={!fill ? width : undefined}
    />
  )
}
