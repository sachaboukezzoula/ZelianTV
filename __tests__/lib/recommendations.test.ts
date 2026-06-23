import { aggregateTopGenres, filterOutWatched } from '@/lib/recommendations'

describe('aggregateTopGenres', () => {
  it('returns top 3 genre ids by frequency', () => {
    const items = [
      { genres: [28, 12] },
      { genres: [28, 878] },
      { genres: [28, 12, 10751] },
      { genres: [878] },
    ]
    const result = aggregateTopGenres(items)
    expect(result).toEqual([28, 12, 878])
  })

  it('returns empty array for empty input', () => {
    expect(aggregateTopGenres([])).toEqual([])
  })
})

describe('filterOutWatched', () => {
  it('removes items whose ids are in the watched set', () => {
    const items = [{ id: 1 }, { id: 2 }, { id: 3 }]
    const result = filterOutWatched(items, new Set([2]))
    expect(result.map(i => i.id)).toEqual([1, 3])
  })
})
