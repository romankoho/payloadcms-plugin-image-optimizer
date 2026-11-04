/* THIS FILE WAS GENERATED AUTOMATICALLY BY PAYLOAD. MODIFY AT YOUR OWN RISK. */
import { payloadLayoutRoute } from '@payloadcms/tanstack-start/client'
import { createFileRoute } from '@tanstack/react-router'

import { getLayoutDataFn, serverFunctionHandler } from './_payload/server.functions.js'

export const Route = createFileRoute('/_payload')({
  head: () => ({
    links: [
      {
        href: 'https://fonts.googleapis.com',
        rel: 'preconnect',
      },
      {
        crossOrigin: 'anonymous',
        href: 'https://fonts.gstatic.com',
        rel: 'preconnect',
      },
      {
        href: 'https://fonts.googleapis.com/css2?family=Inter:wght@100..900&family=Roboto+Mono:wght@100..700&display=swap',
        rel: 'stylesheet',
      },
    ],
  }),
  ...payloadLayoutRoute({
    load: getLayoutDataFn,
    serverFunction: serverFunctionHandler,
  }),
})
