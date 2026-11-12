/// <reference types="vite/client" />
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { createRootRoute, HeadContent, Link, Outlet, Scripts } from '@tanstack/react-router'
import { type ReactNode, useState } from 'react'
import { authClient, trpc } from '../lib/clients'
import styles from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: '予約管理（練習用）' }
    ],
    links: [{ rel: 'stylesheet', href: styles }]
  }),
  shellComponent: RootDocument,
  component: RootLayout
})

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}

function RootLayout() {
  // QueryClient はブラウザのタブごと・サーバーのリクエストごとに1つ作る
  const [queryClient] = useState(() => new QueryClient())
  return (
    <QueryClientProvider client={queryClient}>
      <Header />
      <main>
        <Outlet />
      </main>
    </QueryClientProvider>
  )
}

function Header() {
  const me = useQuery({ queryKey: ['me'], queryFn: () => trpc.me.query() })
  const signOut = async () => {
    await authClient.signOut()
    window.location.href = '/login'
  }
  return (
    <header>
      <Link to="/">予約管理（練習用）</Link>
      {me.data?.isAdmin && <Link to="/admin">すべての予約</Link>}
      <span className="spacer" />
      {me.data?.user ? (
        <>
          <span>{me.data.user.name}</span>
          <button type="button" className="sub" onClick={signOut}>
            ログアウト
          </button>
        </>
      ) : (
        <Link to="/login">ログイン</Link>
      )}
    </header>
  )
}
