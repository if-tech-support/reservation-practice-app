import { createFileRoute } from '@tanstack/react-router'
import { type FormEvent, useState } from 'react'
import { authClient } from '../lib/clients'

export const Route = createFileRoute('/login')({ component: LoginPage })

function LoginPage() {
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [unverifiedEmail, setUnverifiedEmail] = useState('')

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
    setNotice('')
    setUnverifiedEmail('')
    if (result.error) {
      // メール確認が済んでいないとき（確認メールの機能がある構成だけ）
      if (result.error.code === 'EMAIL_NOT_VERIFIED') {
        setUnverifiedEmail(email)
        setError('メールアドレスの確認がまだです。届いたメールのリンクを開いてください。')
        return
      }
      setError(result.error.message ?? 'ログインできませんでした')
      return
    }
    // 確認メールの機能がある構成では、登録してもログイン状態にならない（token が null）
    if (mode === 'signUp' && result.data && 'token' in result.data && result.data.token === null) {
      setNotice('確認メールを送りました。メールのリンクを開いてから、ログインしてください。')
      setMode('signIn')
      return
    }
    window.location.href = '/'
  }

  const resend = async () => {
    setBusy(true)
    const result = await authClient.sendVerificationEmail({ email: unverifiedEmail, callbackURL: '/' })
    setBusy(false)
    if (result.error) {
      setError(result.error.message ?? '確認メールを送れませんでした')
      return
    }
    setError('')
    setNotice('確認メールをもう一度送りました。')
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
        {notice && <p className="muted">{notice}</p>}
        {error && <p className="error">{error}</p>}
        {unverifiedEmail && (
          <button type="button" className="sub" disabled={busy} onClick={resend}>
            確認メールをもう一度送る
          </button>
        )}
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
