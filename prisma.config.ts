import { defineConfig } from 'prisma/config'
import { config as loadEnv } from 'dotenv'
import path from 'path'

// Load .env.local so DATABASE_URL is available during local CLI commands.
// Next.js loads .env.local automatically at runtime, but the Prisma CLI does not.
// In CI, .env.local does not exist — DATABASE_URL is read from the environment.
loadEnv({ path: path.resolve(process.cwd(), '.env.local') })

// Local dev: use DATABASE_URL from .env.local.
// CI generate step: no URL needed — prisma generate only reads the schema.
// CI migrate/push step: URL must be provided via environment secret.
const dbUrl = process.env.DATABASE_URL

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  engine: 'classic',
  ...(dbUrl
    ? {
        datasource: {
          url: dbUrl,
        },
      }
    : {}),
})
