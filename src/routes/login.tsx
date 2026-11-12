import { createFileRoute } from '@tanstack/react-router'
import { type FormEvent, useState } from 'react'
import { authClient } from '../lib/clients'

export const Route = createFileRoute('/login')({ component: LoginPage })

function LoginPage() {
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email'))
    const password = String(form.get('password'))
    setBusy(true)
    setError('')
    const result =
      mode === 'signUp'
        ? await authClient.signUp.email({ email, password, name: String(form.get('name')) })
        : await authClient.signIn.email({ email, password })
    setBusy(false)
    if (result.error) {
      setError(result.error.message ?? 'ログインできませんでした')
      return
    }
    window.location.href = '/'
  }

  return (
    <div className="card">
      <h1>{mode === 'signIn' ? 'ログイン' : 'アカウントを作る'}</h1>
      <form onSubmit={submit}>
        {mode === 'signUp' && (
          <label>
            名前
            <input name="name" required maxLength={50} />
          </label>
        )}
        <label>
          メールアドレス
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <label>
          パスワード（8文字以上）
          <input name="password" type="password" required minLength={8} />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={busy}>
          {mode === 'signIn' ? 'ログイン' : '登録する'}
        </button>
      </form>
      <p className="muted">
        <button
          type="button"
          className="sub"
          onClick={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')}
        >
          {mode === 'signIn' ? 'はじめての方はこちら' : 'ログインに戻る'}
        </button>
      </p>
    </div>
  )
}
