import argon2 from 'argon2'
import { createHash, randomBytes } from 'node:crypto'

export function hashPassword(password: string) {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  })
}

export function verifyPassword(passwordHash: string, password: string) {
  return argon2.verify(passwordHash, password)
}

export function createSessionToken() {
  return randomBytes(32).toString('base64url')
}

export function hashSessionToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function avatarColorForUser(userId: string) {
  const colors = [
    '#2563eb', '#7c3aed', '#db2777', '#dc2626',
    '#ea580c', '#16a34a', '#0891b2', '#4f46e5',
  ]
  const index = createHash('sha256').update(userId).digest()[0] % colors.length
  return colors[index]
}
