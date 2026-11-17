import { createMiddleware, createStart } from '@tanstack/react-start'
import { maintenanceResponse } from './server/maintenance'

// すべての要求の入口。メンテナンス中ならここで止める（機能が無効の構成では何もしない）
const maintenance = createMiddleware({ type: 'request' }).server(async ({ request, next }) => {
  const blocked = await maintenanceResponse(request)
  return blocked ?? next()
})

export const startInstance = createStart(() => ({ requestMiddleware: [maintenance] }))
