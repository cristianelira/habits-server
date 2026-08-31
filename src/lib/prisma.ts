import { PrismaLibSql } from '@prisma/adapter-libsql'
import { PrismaClient } from '../generated/prisma/client.js'

/**
 * `authToken` só é necessário para bancos libSQL remotos (ex. Turso) e é
 * omitido para um `DATABASE_URL` local (`file:./dev.db`).
 */
const { TURSO_AUTH_TOKEN } = process.env
const adapter = new PrismaLibSql({
    url: process.env.DATABASE_URL!,
    ...(TURSO_AUTH_TOKEN ? { authToken: TURSO_AUTH_TOKEN } : {}),
})
export const prisma = new PrismaClient({ adapter })