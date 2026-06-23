'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { getUserLists } from '@/app/actions/watchlist'

interface ListsContextValue {
  allLists: string[]
  addList: (name: string) => void
}

const ListsContext = createContext<ListsContextValue>({
  allLists: [],
  addList: () => {},
})

export function useListsContext() {
  return useContext(ListsContext)
}

export function ListsProvider({ children }: { children: ReactNode }) {
  const [allLists, setAllLists] = useState<string[]>([])

  useEffect(() => {
    getUserLists().then(setAllLists)
  }, [])

  const addList = useCallback((name: string) => {
    setAllLists(prev => prev.includes(name) ? prev : [...prev, name])
  }, [])

  return (
    <ListsContext.Provider value={{ allLists, addList }}>
      {children}
    </ListsContext.Provider>
  )
}
