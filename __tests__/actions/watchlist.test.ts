import { removeFromList, deleteList } from '@/app/actions/watchlist'

// Mock Supabase admin client
const mockEq = jest.fn(() => ({ eq: mockEq, error: null }))
const mockFrom = jest.fn(() => ({ delete: () => ({ eq: mockEq }) }))

const mockCreateClient = jest.fn(() => ({
  auth: { getUser: async () => ({ data: { user: { id: 'user-123' } }, error: null }) },
}))

jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: mockFrom }),
}))
jest.mock('@/lib/supabase/server', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))

beforeEach(() => {
  jest.clearAllMocks()
  mockEq.mockReturnValue({ eq: mockEq, error: null })
  mockCreateClient.mockReturnValue({
    auth: { getUser: async () => ({ data: { user: { id: 'user-123' } }, error: null }) },
  })
})

describe('removeFromList', () => {
  it('returns error when user is not authenticated', async () => {
    mockCreateClient.mockReturnValueOnce({
      auth: { getUser: async () => ({ data: { user: null }, error: null }) },
    })
    const result = await removeFromList('item-abc')
    expect(result).toEqual({ error: 'Non connecté' })
  })

  it('calls delete on user_media_lists with correct id and user_id', async () => {
    await removeFromList('item-abc')
    expect(mockFrom).toHaveBeenCalledWith('user_media_lists')
    expect(mockEq).toHaveBeenCalledWith('id', 'item-abc')
    expect(mockEq).toHaveBeenCalledWith('user_id', 'user-123')
  })
})

describe('deleteList', () => {
  it('returns error when user is not authenticated', async () => {
    mockCreateClient.mockReturnValueOnce({
      auth: { getUser: async () => ({ data: { user: null }, error: null }) },
    })
    const result = await deleteList('ma-liste')
    expect(result).toEqual({ error: 'Non connecté' })
  })

  it('calls delete on user_media_lists filtering by user_id and list_type', async () => {
    await deleteList('ma-liste')
    expect(mockFrom).toHaveBeenCalledWith('user_media_lists')
    expect(mockEq).toHaveBeenCalledWith('user_id', 'user-123')
    expect(mockEq).toHaveBeenCalledWith('list_type', 'ma-liste')
  })
})
