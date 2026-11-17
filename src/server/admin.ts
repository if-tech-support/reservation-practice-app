import { config, features } from '#platform'

// 管理者（ADMIN_EMAIL と同じメールアドレスの人）か。
// メール確認が有効なとき（mailer があるとき）は、確認済みの人だけを管理者とみなす。
// 確認なしで登録できると、他人の ADMIN_EMAIL で先に登録して管理者になれてしまうため。
// 無効なとき（AWS・手元）は今までどおり、メールアドレスだけで判定する
export const isAdminUser = (user: { email: string; emailVerified?: boolean }) => {
  if (!config.adminEmail || user.email !== config.adminEmail) return false
  return features.mailer ? user.emailVerified === true : true
}
