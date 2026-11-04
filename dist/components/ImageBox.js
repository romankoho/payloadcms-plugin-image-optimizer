'use client';
import { jsx as _jsx } from "react/jsx-runtime";
import React, { useState } from 'react';
import { getImageOptimizerProps } from '../utilities/getImageOptimizerProps.js';
import { getDefaultSizes, getResponsiveImageProps } from '../utilities/responsiveImage.js';
export const fillStyle = {
    height: '100%',
    inset: 0,
    position: 'absolute',
    width: '100%'
};
/**
 * Framework-agnostic `<img>` for Payload media: responsive `srcSet` from the
 * pre-generated variants, ThumbHash blur placeholder, focal-point
 * positioning, and a blur-to-sharp fade. Works on TanStack Start and any
 * other React renderer. Next.js users who want `next/image` should import
 * `ImageBox` from `@inoo-ch/payload-image-optimizer/next` instead.
 */ export const ImageBox = ({ alt: altFromProps, fade = true, fadeDuration = 500, fill, height: heightFromProps, loading: loadingFromProps, media, onLoad, priority, sizes, style: styleFromProps, width: widthFromProps, ...props })=>{
    const [loaded, setLoaded] = useState(false);
    const isString = typeof media === 'string';
    const responsive = isString ? {
        src: media
    } : getResponsiveImageProps(media);
    const optimizerProps = getImageOptimizerProps(isString ? null : media);
    const alt = altFromProps ?? (isString ? '' : media.alt || media.filename || '');
    const blur = fade && !loaded ? optimizerProps.blurDataURL : undefined;
    return /*#__PURE__*/ _jsx("img", {
        ...props,
        alt: alt,
        decoding: "async",
        fetchPriority: priority ? 'high' : props.fetchPriority,
        height: fill ? undefined : heightFromProps ?? responsive.height,
        loading: priority ? 'eager' : loadingFromProps ?? 'lazy',
        onLoad: (e)=>{
            setLoaded(true);
            onLoad?.(e);
        },
        sizes: sizes ?? getDefaultSizes(fill) ?? (responsive.srcSet ? '100vw' : undefined),
        src: responsive.src,
        srcSet: responsive.srcSet,
        style: {
            objectFit: 'cover',
            ...optimizerProps.style,
            ...fill ? fillStyle : undefined,
            ...blur ? {
                backgroundImage: `url("${blur}")`,
                backgroundPosition: 'center',
                backgroundSize: 'cover'
            } : undefined,
            ...fade ? {
                filter: loaded ? 'blur(0px)' : 'blur(20px)',
                transition: loaded ? `filter ${fadeDuration}ms ease-in-out` : undefined
            } : undefined,
            ...styleFromProps
        },
        width: fill ? undefined : widthFromProps ?? responsive.width
    });
};

//# sourceMappingURL=ImageBox.js.map