'use client'

import NextImage, { type ImageProps } from 'next/image'
import React, { useState } from 'react'

import type { ImageOptimizerProps } from '../../utilities/getImageOptimizerProps.js'

export interface FadeImageProps extends Omit<ImageProps, 'blurDataURL' | 'onLoad' | 'placeholder'> {
  /** Duration of the fade animation in milliseconds. Defaults to `500`. */
  fadeDuration?: number
  /** Props returned by `getImageOptimizerProps()`. */
  optimizerProps: ImageOptimizerProps
}

/**
 * A Next.js `<Image>` wrapper that applies ThumbHash blur placeholders with a
 * smooth blur-to-sharp fade transition on load.
 *
 * Use this when you call `getImageOptimizerProps()` manually instead of using `ImageBox`:
 *
 * ```tsx
 * import { FadeImage } from '@inoo-ch/payload-image-optimizer/next'
 * import { getImageOptimizerProps } from '@inoo-ch/payload-image-optimizer/frontend'
 *
 * const optimizerProps = getImageOptimizerProps(resource)
 * <FadeImage src={src} alt="" optimizerProps={optimizerProps} width={800} height={600} />
 * ```
 */
export const FadeImage: React.FC<FadeImageProps> = ({
  fadeDuration = 500,
  optimizerProps,
  style,
  ...props
}) => {
  const [loaded, setLoaded] = useState(false)

  const { blurDataURL, style: optimizerStyle } = optimizerProps

  return (
    <NextImage
      {...props}
      blurDataURL={blurDataURL}
      onLoad={() => setLoaded(true)}
      placeholder={blurDataURL ? 'blur' : 'empty'}
      style={{
        ...optimizerStyle,
        ...style,
        filter: loaded ? 'blur(0px)' : 'blur(20px)',
        transition: loaded ? `filter ${fadeDuration}ms ease-in-out` : undefined,
      }}
    />
  )
}
