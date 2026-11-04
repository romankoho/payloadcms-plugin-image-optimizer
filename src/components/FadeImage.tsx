'use client'

import React, { type ImgHTMLAttributes, useState } from 'react'

import type { ImageOptimizerProps } from '../utilities/getImageOptimizerProps.js'

export interface FadeImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  /** Duration of the fade animation in milliseconds. Defaults to `500`. */
  fadeDuration?: number
  /** Props returned by `getImageOptimizerProps()`. */
  optimizerProps: ImageOptimizerProps
}

/**
 * Framework-agnostic `<img>` with a ThumbHash blur placeholder and a smooth
 * blur-to-sharp fade on load. Use it when you call `getImageOptimizerProps()`
 * yourself instead of using `ImageBox`:
 *
 * ```tsx
 * import { FadeImage, getImageOptimizerProps, getResponsiveImageProps } from '@inoo-ch/payload-image-optimizer/frontend'
 *
 * <FadeImage {...getResponsiveImageProps(media)} alt="" optimizerProps={getImageOptimizerProps(media)} />
 * ```
 */
export const FadeImage: React.FC<FadeImageProps> = ({
  alt,
  fadeDuration = 500,
  onLoad,
  optimizerProps,
  style,
  ...props
}) => {
  const [loaded, setLoaded] = useState(false)
  const { blurDataURL, style: optimizerStyle } = optimizerProps

  return (
    <img
      alt={alt}
      decoding="async"
      loading="lazy"
      {...props}
      onLoad={(e) => {
        setLoaded(true)
        onLoad?.(e)
      }}
      style={{
        ...optimizerStyle,
        ...(blurDataURL && !loaded
          ? { backgroundImage: `url("${blurDataURL}")`, backgroundPosition: 'center', backgroundSize: 'cover' }
          : undefined),
        ...style,
        filter: loaded ? 'blur(0px)' : 'blur(20px)',
        transition: loaded ? `filter ${fadeDuration}ms ease-in-out` : undefined,
      }}
    />
  )
}
