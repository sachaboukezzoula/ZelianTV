// __tests__/lib/profile.test.ts
import { getActiveProfileId } from '@/lib/profile'

// Mock next/headers
jest.mock('next/headers', () => ({
  headers: jest.fn(),
  cookies: jest.fn(),
}))

import { headers, cookies } from 'next/headers'

describe('getActiveProfileId', () => {
  it('returns profile id from x-profile-id header', async () => {
    const mockHeaders = { get: jest.fn().mockReturnValue('profile-uuid-123') }
    ;(headers as jest.Mock).mockResolvedValue(mockHeaders)

    const id = await getActiveProfileId()
    expect(id).toBe('profile-uuid-123')
  })

  it('returns null when header is absent', async () => {
    const mockHeaders = { get: jest.fn().mockReturnValue(null) }
    ;(headers as jest.Mock).mockResolvedValue(mockHeaders)

    const id = await getActiveProfileId()
    expect(id).toBeNull()
  })
})

describe('getActiveProfileIdFromCookie', () => {
  it('returns profile id from cookie', async () => {
    const mockCookies = { get: jest.fn().mockReturnValue({ value: 'profile-uuid-456' }) }
    ;(cookies as jest.Mock).mockResolvedValue(mockCookies)

    const { getActiveProfileIdFromCookie } = await import('@/lib/profile')
    const id = await getActiveProfileIdFromCookie()
    expect(id).toBe('profile-uuid-456')
  })

  it('returns null when cookie is absent', async () => {
    const mockCookies = { get: jest.fn().mockReturnValue(undefined) }
    ;(cookies as jest.Mock).mockResolvedValue(mockCookies)

    const { getActiveProfileIdFromCookie } = await import('@/lib/profile')
    const id = await getActiveProfileIdFromCookie()
    expect(id).toBeNull()
  })
})
