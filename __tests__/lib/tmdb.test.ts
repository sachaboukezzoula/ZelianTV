import { posterUrl, backdropUrl, getTitle, getYear } from '@/lib/tmdb'

describe('tmdb helpers', () => {
  it('posterUrl returns full URL when path exists', () => {
    expect(posterUrl('/abc.jpg')).toBe('https://image.tmdb.org/t/p/w500/abc.jpg')
  })

  it('posterUrl returns null when path is null', () => {
    expect(posterUrl(null)).toBeNull()
  })

  it('backdropUrl returns w1280 URL', () => {
    expect(backdropUrl('/bg.jpg')).toBe('https://image.tmdb.org/t/p/w1280/bg.jpg')
  })

  it('getTitle returns title for movie', () => {
    expect(getTitle({ title: 'Dune', id: 1 } as any)).toBe('Dune')
  })

  it('getTitle returns name for tv', () => {
    expect(getTitle({ name: 'Breaking Bad', id: 2 } as any)).toBe('Breaking Bad')
  })

  it('getTitle returns fallback when both undefined', () => {
    expect(getTitle({ id: 3 } as any)).toBe('Titre inconnu')
  })

  it('getYear extracts year from release_date', () => {
    expect(getYear({ release_date: '2024-03-01' } as any)).toBe('2024')
  })

  it('getYear extracts year from first_air_date', () => {
    expect(getYear({ first_air_date: '2019-01-20' } as any)).toBe('2019')
  })

  it('getYear returns null when no date', () => {
    expect(getYear({} as any)).toBeNull()
  })
})
