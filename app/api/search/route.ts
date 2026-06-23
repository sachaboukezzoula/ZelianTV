import { NextRequest, NextResponse } from 'next/server'
import { searchMulti } from '@/lib/tmdb'

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q') ?? ''
  if (q.length < 2) return NextResponse.json([])
  try {
    const results = await searchMulti(q)
    return NextResponse.json(results.slice(0, 8))
  } catch {
    return NextResponse.json([], { status: 500 })
  }
}
