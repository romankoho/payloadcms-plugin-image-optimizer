import {
  FadeImage,
  getImageOptimizerProps,
  getResponsiveImageProps,
  ImageBox,
} from '@inoo-ch/payload-image-optimizer/frontend'
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'

import type { Media } from '../../payload-types.js'

const getFirstMedia = createServerFn({ method: 'GET' }).handler(async () => {
  const { getPayload } = await import('payload')
  const payload = await getPayload({ config: (await import('@payload-config')).default })
  const { docs } = await payload.find({ collection: 'media', limit: 1, overrideAccess: true })
  return (docs[0] ?? null) as Media | null
})

export const Route = createFileRoute('/_frontend/frontend-test')({
  component: FrontendTestPage,
  loader: () => getFirstMedia(),
})

function FrontendTestPage() {
  const media = Route.useLoaderData()

  if (!media) {
    return (
      <main data-testid="frontend-test-root" style={{ fontFamily: 'system-ui', padding: 32 }}>
        <h1>Frontend Entry Point Test</h1>
        <p data-testid="no-media">No media found — upload an image at /admin first.</p>
      </main>
    )
  }

  const optimizerProps = getImageOptimizerProps(media)

  return (
    <main data-testid="frontend-test-root" style={{ fontFamily: 'system-ui', padding: 32 }}>
      <h1>Frontend Entry Point Test (TanStack Start)</h1>
      <p data-testid="import-source">
        Imported from: <code>@inoo-ch/payload-image-optimizer/frontend</code>
      </p>

      <section>
        <h2>ImageBox</h2>
        <div data-testid="imagebox-wrap" style={{ height: 400, position: 'relative', width: 600 }}>
          <ImageBox alt="ImageBox test" fill media={media} />
        </div>
      </section>

      <section>
        <h2>FadeImage + getImageOptimizerProps</h2>
        <div data-testid="fadeimage-wrap">
          <FadeImage
            {...getResponsiveImageProps(media)}
            alt="FadeImage test"
            height={400}
            optimizerProps={optimizerProps}
            sizes="600px"
            width={600}
          />
        </div>
      </section>

      <section>
        <h2>Optimizer props (debug)</h2>
        <pre data-testid="optimizer-props" style={{ background: '#f5f5f5', fontSize: 12, padding: 12 }}>
          {JSON.stringify(
            {
              hasBlur: Boolean(optimizerProps.blurDataURL),
              srcSet: getResponsiveImageProps(media).srcSet,
              style: optimizerProps.style,
            },
            null,
            2,
          )}
        </pre>
      </section>
    </main>
  )
}
