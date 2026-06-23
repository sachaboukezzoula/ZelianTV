'use client'

import { useState } from 'react'
import { LoginForm } from '@/components/auth/LoginForm'
import { SignupForm } from '@/components/auth/SignupForm'

export function AuthTabs() {
  const [tab, setTab] = useState<'login' | 'signup'>('login')

  return (
    <div className="max-w-sm mx-auto px-4 py-8">
      <h1 className="text-white text-lg font-medium mb-5">Mon profil</h1>

      <div className="flex border-b border-[#242424] mb-5">
        <button
          onClick={() => setTab('login')}
          className={`text-xs px-4 py-2.5 border-b-2 -mb-px transition-colors ${
            tab === 'login'
              ? 'text-[#f97316] border-[#f97316]'
              : 'text-[#444] border-transparent hover:text-[#666]'
          }`}
        >
          Se connecter
        </button>
        <button
          onClick={() => setTab('signup')}
          className={`text-xs px-4 py-2.5 border-b-2 -mb-px transition-colors ${
            tab === 'signup'
              ? 'text-[#f97316] border-[#f97316]'
              : 'text-[#444] border-transparent hover:text-[#666]'
          }`}
        >
          S&apos;inscrire
        </button>
      </div>

      {tab === 'login' ? <LoginForm /> : <SignupForm />}

      <div className="mt-6 bg-[#1a1a1a] border border-[#242424] rounded-lg p-3">
        <p className="text-[#444] text-[9px] uppercase tracking-wider mb-3">Après connexion</p>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-[#666] text-xs">
            <span className="text-[#f97316]">→</span> Listes — À voir / Déjà vus
          </div>
          <div className="flex items-center gap-2 text-[#666] text-xs">
            <span className="text-[#f97316]">→</span> Recommandations personnalisées
          </div>
          <div className="flex items-center gap-2 text-[#666] text-xs">
            <span className="text-[#f97316]">→</span> Préférences de genres
          </div>
        </div>
      </div>
    </div>
  )
}
