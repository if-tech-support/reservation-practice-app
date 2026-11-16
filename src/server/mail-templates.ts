// メールの本文。日本語のテキストと簡単な HTML

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

export const verificationMail = (input: { name: string; url: string; expiresInMinutes: number }) => {
  const { name, url, expiresInMinutes } = input
  const subject = '【予約管理（練習用）】メールアドレスの確認'
  const text = [
    `${name} さん`,
    '',
    '予約管理（練習用）にご登録ありがとうございます。',
    '次のリンクを開いて、メールアドレスの確認を完了してください。',
    '',
    url,
    '',
    `このリンクの有効期限は ${expiresInMinutes} 分です。期限が切れたら、ログイン画面から確認メールをもう一度送れます。`,
    '心当たりがない場合は、このメールを破棄してください。'
  ].join('\n')
  const html = `<p>${escapeHtml(name)} さん</p>
<p>予約管理（練習用）にご登録ありがとうございます。<br>次のリンクを開いて、メールアドレスの確認を完了してください。</p>
<p><a href="${escapeHtml(url)}">メールアドレスを確認する</a></p>
<p>このリンクの有効期限は ${expiresInMinutes} 分です。期限が切れたら、ログイン画面から確認メールをもう一度送れます。<br>心当たりがない場合は、このメールを破棄してください。</p>`
  return { subject, text, html }
}
