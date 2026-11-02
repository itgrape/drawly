import { createApp } from './app'
import { env } from './config/env'

const app = await createApp()
await app.listen({ host: '0.0.0.0', port: env.port })
