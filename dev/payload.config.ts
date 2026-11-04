import { imageOptimizer } from '@inoo-ch/payload-image-optimizer'
import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import path from 'path'
import { buildConfig } from 'payload'
import { loadEnv } from 'payload/node'
import { fileURLToPath } from 'url'

import { testEmailAdapter } from './helpers/testEmailAdapter.js'
import { seed } from './seed.js'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// Vite (unlike Next.js) doesn't load `.env` into the server environment.
loadEnv(dirname)

if (!process.env.ROOT_DIR) {
  process.env.ROOT_DIR = dirname
}

const buildConfigWithMemoryDB = async () => {
  // In-memory MongoDB for tests, and for `pnpm dev` when no DATABASE_URL is set.
  if (process.env.NODE_ENV === 'test' || !process.env.DATABASE_URL) {
    const memoryDB = await MongoMemoryReplSet.create({
      replSet: {
        count: 3,
        dbName: 'payloadmemory',
      },
    })

    process.env.DATABASE_URL = `${memoryDB.getUri()}&retryWrites=true`
  }

  return buildConfig({
    admin: {
      importMap: {
        baseDir: path.resolve(dirname),
        importMapFile: path.resolve(dirname, 'app', '_payload', 'importMap.js'),
      },
    },
    collections: [
      {
        slug: 'posts',
        fields: [],
        versions: false,
      },
      {
        slug: 'media',
        access: { read: () => true },
        fields: [],
        upload: {
          staticDir: path.resolve(dirname, 'media'),
        },
      },
      {
        slug: 'avatars',
        fields: [],
        upload: {
          staticDir: path.resolve(dirname, 'avatars'),
        },
      },
    ],
    db: mongooseAdapter({
      ensureIndexes: true,
      url: process.env.DATABASE_URL || '',
    }),
    editor: lexicalEditor(),
    email: testEmailAdapter,
    onInit: async (payload) => {
      await seed(payload)
    },
    plugins: [
      imageOptimizer({
        clientOptimization: true,
        collections: {
          avatars: {
            format: { format: 'webp', quality: 90 },
            maxDimensions: { height: 256, width: 256 },
          },
          media: {
            sharp: {
              // Regression harness for the aspect-ratio srcset filter (v1.11.1).
              // `og` and `square` are intentionally fixed-aspect variants that
              // should be excluded from `createVariantLoader`'s srcset output
              // when the source image does not share their aspect ratio.
              variants: [
                { name: 'thumbnail', fit: 'inside', height: undefined, width: 300 },
                { name: 'small', fit: 'inside', height: undefined, width: 600 },
                { name: 'medium', fit: 'inside', height: undefined, width: 900 },
                { name: 'large', fit: 'inside', height: undefined, width: 1400 },
                { name: 'og', fit: 'cover', height: 630, position: 'center', width: 1200 },
                { name: 'square', fit: 'cover', height: 500, position: 'center', width: 500 },
              ],
            },
          },
        },
        format: { format: 'webp', quality: 80 },
        generateThumbHash: true,
        maxDimensions: { height: 2560, width: 2560 },
        storeBlurDataURL: true,
        stripMetadata: true,
        // generateFilename: uuidFilename,
      }),
    ],
    secret: process.env.PAYLOAD_SECRET || 'test-secret_key',
    typescript: {
      outputFile: path.resolve(dirname, 'payload-types.ts'),
    },
  })
}

export default buildConfigWithMemoryDB()
