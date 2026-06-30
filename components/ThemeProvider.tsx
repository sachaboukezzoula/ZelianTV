'use client'
import { createContext, useContext, useEffect, useState } from 'react'

export type Theme = 'orange' | 'blue' | 'violet'

const ThemeContext = createContext<{
  theme: Theme
  setTheme: (t: Theme) => void
}>({ theme: 'orange', setTheme: () => {} })

export const useTheme = () => useContext(ThemeContext)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('orange')

  useEffect(() => {
    const saved = localStorage.getItem('zelian-theme') as Theme | null
    if (saved === 'blue' || saved === 'violet' || saved === 'orange') {
      setThemeState(saved)
      applyThemeClass(saved)
    }
  }, [])

  function setTheme(t: Theme) {
    setThemeState(t)
    applyThemeClass(t)
    localStorage.setItem('zelian-theme', t)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

function applyThemeClass(t: Theme) {
  const root = document.documentElement
  root.classList.remove('theme-blue', 'theme-violet')
  if (t !== 'orange') root.classList.add(`theme-${t}`)
}
