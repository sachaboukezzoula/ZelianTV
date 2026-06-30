jest.mock('@/lib/supabase/server')
jest.mock('@/lib/supabase/admin')
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('next/headers', () => ({
  cookies: jest.fn().mockResolvedValue({
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  }),
}))

const mockUser = { id: 'user-uuid-123' }

beforeEach(() => {
  jest.resetModules()
  jest.clearAllMocks()
})

describe('getProfiles', () => {
  it('returns profiles for current user', async () => {
    const { createClient } = jest.requireMock('@/lib/supabase/server')
    const { createAdminClient } = jest.requireMock('@/lib/supabase/admin')

    const mockSupabase = {
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: mockUser } }) },
    }
    const mockAdmin = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: [{ id: 'p1', name: 'Lin', color: '#f97316', avatar_url: null }],
              error: null,
            }),
          }),
        }),
      }),
    }
    ;(createClient as jest.Mock).mockResolvedValue(mockSupabase)
    ;(createAdminClient as jest.Mock).mockReturnValue(mockAdmin)

    const { getProfiles } = await import('@/app/actions/profiles')
    const result = await getProfiles()
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Lin')
  })

  it('returns empty array when not logged in', async () => {
    const { createClient } = jest.requireMock('@/lib/supabase/server')

    const mockSupabase = {
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null } }) },
    }
    ;(createClient as jest.Mock).mockResolvedValue(mockSupabase)

    const { getProfiles } = await import('@/app/actions/profiles')
    const result = await getProfiles()
    expect(result).toEqual([])
  })
})

describe('createProfile', () => {
  it('returns error when max profiles reached', async () => {
    const { createClient } = jest.requireMock('@/lib/supabase/server')
    const { createAdminClient } = jest.requireMock('@/lib/supabase/admin')

    const mockSupabase = {
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: mockUser } }) },
    }
    const mockAdmin = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ count: 5, error: null }),
        }),
      }),
    }
    ;(createClient as jest.Mock).mockResolvedValue(mockSupabase)
    ;(createAdminClient as jest.Mock).mockReturnValue(mockAdmin)

    const { createProfile } = await import('@/app/actions/profiles')
    const result = await createProfile('Nouveau', null, '#f97316')
    expect(result).toEqual({ error: 'Maximum 5 profils par compte.' })
  })
})
