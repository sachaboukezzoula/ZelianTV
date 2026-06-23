'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function SignupForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) { setMessage(error.message) }
    else { setMessage('Email de confirmation envoyé. Vérifiez votre boîte mail ✓') }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSignup} className="flex flex-col gap-3">
      <div>
        <label className="text-[#666] text-[9px] uppercase tracking-wider mb-1 block">Email</label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="exemple@email.com"
          required
          className="w-full bg-[#1c1c1c] border border-[#2a2a2a] rounded-md px-3 py-2 text-sm text-white placeholder-[#444] focus:outline-none focus:border-[#f97316] transition-colors"
        />
      </div>
      <div>
        <label className="text-[#666] text-[9px] uppercase tracking-wider mb-1 block">Mot de passe</label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="••••••••"
          minLength={6}
          required
          className="w-full bg-[#1c1c1c] border border-[#2a2a2a] rounded-md px-3 py-2 text-sm text-white placeholder-[#444] focus:outline-none focus:border-[#f97316] transition-colors"
        />
      </div>
      {message && (
        <p className={`text-xs ${message.includes('✓') ? 'text-green-400' : 'text-red-400'}`}>
          {message}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-[#f97316] text-white py-2.5 rounded-md text-sm font-medium hover:bg-orange-600 transition-colors disabled:opacity-50"
      >
        {loading ? 'Inscription...' : "S'inscrire"}
      </button>
    </form>
  )
}
