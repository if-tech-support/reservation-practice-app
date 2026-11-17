import type { MaintenanceFlag } from '../types'

// KV のキー maintenance が on のときメンテナンス中。値の反映は KV の仕様で最大60秒ほど遅れる
export const createMaintenanceFlag = (kv: KVNamespace): MaintenanceFlag => ({
  async isOn() {
    try {
      return (await kv.get('maintenance')) === 'on'
    } catch (error) {
      // KV が読めないだけでサービス全体を止めない（メンテナンスなしとして扱う）
      console.error('[maintenance] KV read failed', error)
      return false
    }
  }
})
