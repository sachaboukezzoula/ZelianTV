import { render, screen, waitFor } from '@testing-library/react'
import { WatchlistButton } from '@/components/WatchlistButton'

const mockGetUser = jest.fn()
const mockFrom = jest.fn()

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}))

beforeEach(() => {
  jest.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: null } })
  mockFrom.mockReturnValue({
    select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ single: () => ({ data: null, error: null }) }) }) }) }),
    delete: () => ({ eq: () => ({ eq: () => ({ eq: () => Promise.resolve({}) }) }) }),
    upsert: () => Promise.resolve({}),
  })
})

it('renders null while loading', () => {
  const { container } = render(<WatchlistButton tmdbId={123} mediaType="movie" />)
  expect(container.firstChild).toBeNull()
})

it('renders both buttons after load when no user', async () => {
  render(<WatchlistButton tmdbId={123} mediaType="movie" />)
  await waitFor(() => {
    expect(screen.getByText('À voir')).toBeInTheDocument()
    expect(screen.getByText('Déjà vu')).toBeInTheDocument()
  })
})
