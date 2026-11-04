import { withPayload } from '@payloadcms/tanstack-start'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))

// Dev app for the plugin, running Payload's admin on TanStack Start.
export default withPayload(undefined, {
  // CJS packages that break under the RSC plugin's CJS-to-ESM rewrite in dev.
  devServerExternalPackages: ['mongodb-memory-server'],
  payloadConfigPath: path.resolve(dirname, 'payload.config.ts'),
  srcDirectory: '.',
  vite: {
    root: dirname,
    server: { port: 3000 },
  },
})
