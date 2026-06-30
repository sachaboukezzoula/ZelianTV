import { reorderItems, moveToList } from '@/app/actions/watchlist'

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: jest.fn() }))
jest.mock('@/lib/profile', () => ({ getActiveProfileIdFromCookie: jest.fn() }))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveProfileIdFromCookie } from '@/lib/profile'

const mockCreateClient = createClient as jest.Mock
const mockCreateAdminClient = createAdminClient as jest.Mock
const mockGetProfileId = getActiveProfileIdFromCookie as jest.Mock

function makeAuthMock() {
  mockCreateClient.mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
  })
  mockGetProfileId.mockResolvedValue('p1')
}

function makeUnauthMock() {
  mockCreateClient.mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null } }) },
  })
}

describe('reorderItems', () => {
  beforeEach(() => { jest.clearAllMocks(); makeAuthMock() })

  it('should return error when not authenticated', async () => {
    makeUnauthMock()
    const result = await reorderItems('watchlist', ['a', 'b'])
    expect(result).toEqual({ error: 'Non connecté' })
  })

  it('should update sort_order for each id and return {}', async () => {
    const mockEqFinal = jest.fn().mockResolvedValue({ error: null })
    const mockEqId = jest.fn().mockReturnValue({ eq: mockEqFinal })
    const mockUpdate = jest.fn().mockReturnValue({ eq: mockEqId })
    const mockAdmin = { from: jest.fn().mockReturnValue({ update: mockUpdate }) }
    mockCreateAdminClient.mockReturnValue(mockAdmin)

    const result = await reorderItems('watchlist', ['id-1', 'id-2'])

    expect(result).toEqual({})
    expect(mockUpdate).toHaveBeenCalledWith({ sort_order: 0 })
    expect(mockUpdate).toHaveBeenCalledWith({ sort_order: 1 })
    expect(mockEqId).toHaveBeenCalledWith('id', 'id-1')
    expect(mockEqId).toHaveBeenCalledWith('id', 'id-2')
  })

  it('should return error when a DB update fails', async () => {
    const mockEqFinal = jest.fn().mockResolvedValue({ error: { message: 'DB error' } })
    const mockEqId = jest.fn().mockReturnValue({ eq: mockEqFinal })
    const mockAdmin = {
      from: jest.fn().mockReturnValue({ update: jest.fn().mockReturnValue({ eq: mockEqId }) }),
    }
    mockCreateAdminClient.mockReturnValue(mockAdmin)

    const result = await reorderItems('watchlist', ['id-1'])
    expect(result).toEqual({ error: 'DB error' })
  })
})

describe('moveToList', () => {
  beforeEach(() => { jest.clearAllMocks(); makeAuthMock() })

  it('should return error when not authenticated', async () => {
    makeUnauthMock()
    const result = await moveToList('item-1', 'watched')
    expect(result).toEqual({ error: 'Non connecté' })
  })

  it('should move item to target list at sort_order = max + 1', async () => {
    const mockMaybeSingle = jest.fn().mockResolvedValue({ data: { sort_order: 3 }, error: null })
    const mockLimit = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle })
    const mockOrder = jest.fn().mockReturnValue({ limit: mockLimit })
    const mockEqList = jest.fn().mockReturnValue({ order: mockOrder })
    const mockEqProfile = jest.fn().mockReturnValue({ eq: mockEqList })
    const mockSelect = jest.fn().mockReturnValue({ eq: mockEqProfile })

    const mockEqFinalUpdate = jest.fn().mockResolvedValue({ error: null })
    const mockEqIdUpdate = jest.fn().mockReturnValue({ eq: mockEqFinalUpdate })
    const mockUpdate = jest.fn().mockReturnValue({ eq: mockEqIdUpdate })

    let callCount = 0
    const mockAdmin = {
      from: jest.fn().mockImplementation(() => {
        callCount++
        return callCount === 1
          ? { select: mockSelect }
          : { update: mockUpdate }
      }),
    }
    mockCreateAdminClient.mockReturnValue(mockAdmin)

    const result = await moveToList('item-1', 'watched')
    expect(result).toEqual({})
    expect(mockUpdate).toHaveBeenCalledWith({ list_type: 'watched', sort_order: 4 })
  })

  it('should use sort_order 0 when target list is empty', async () => {
    const mockMaybeSingle = jest.fn().mockResolvedValue({ data: null, error: null })
    const mockLimit = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle })
    const mockOrder = jest.fn().mockReturnValue({ limit: mockLimit })
    const mockEqList = jest.fn().mockReturnValue({ order: mockOrder })
    const mockEqProfile = jest.fn().mockReturnValue({ eq: mockEqList })
    const mockSelect = jest.fn().mockReturnValue({ eq: mockEqProfile })

    const mockEqFinalUpdate = jest.fn().mockResolvedValue({ error: null })
    const mockUpdate = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({ eq: mockEqFinalUpdate }),
    })

    let callCount = 0
    const mockAdmin = {
      from: jest.fn().mockImplementation(() => {
        callCount++
        return callCount === 1 ? { select: mockSelect } : { update: mockUpdate }
      }),
    }
    mockCreateAdminClient.mockReturnValue(mockAdmin)

    const result = await moveToList('item-1', 'watched')
    expect(result).toEqual({})
    expect(mockUpdate).toHaveBeenCalledWith({ list_type: 'watched', sort_order: 0 })
  })
})
