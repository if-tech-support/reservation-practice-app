import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { type FormEvent, useState } from 'react'
import { trpc } from '../lib/clients'

export const Route = createFileRoute('/')({ component: HomePage })

const formatDate = (value: string | Date) =>
  new Date(value).toLocaleString('ja-JP', { dateStyle: 'medium', timeStyle: 'short' })

function HomePage() {
  const queryClient = useQueryClient()
  const me = useQuery({ queryKey: ['me'], queryFn: () => trpc.me.query() })
  const signedIn = Boolean(me.data?.user)
  const list = useQuery({
    queryKey: ['reservations'],
    queryFn: () => trpc.reservation.list.query(),
    enabled: signedIn
  })
  const attachmentsOn = Boolean(me.data?.features.attachments)
  const attachments = useQuery({
    queryKey: ['attachments'],
    queryFn: () => trpc.attachment.list.query(),
    enabled: signedIn && attachmentsOn
  })
  const [uploadError, setUploadError] = useState('')
  const [uploadingId, setUploadingId] = useState('')
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['reservations'] })
    queryClient.invalidateQueries({ queryKey: ['attachments'] })
  }
  const removeAttachment = useMutation({
    mutationFn: (id: string) => trpc.attachment.remove.mutate({ id }),
    onSuccess: refresh
  })
  const upload = async (reservationId: string, file: File | undefined) => {
    if (!file) return
    setUploadError('')
    setUploadingId(reservationId)
    const body = new FormData()
    body.append('file', file)
    try {
      const response = await fetch(`/api/reservations/${reservationId}/attachments`, {
        method: 'POST',
        body
      })
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null
        setUploadError(data?.error ?? '添付できませんでした')
      } else {
        refresh()
      }
    } catch {
      setUploadError('添付できませんでした')
    }
    setUploadingId('')
  }
  const create = useMutation({
    mutationFn: (input: Parameters<typeof trpc.reservation.create.mutate>[0]) =>
      trpc.reservation.create.mutate(input),
    onSuccess: refresh
  })
  const cancel = useMutation({
    mutationFn: (id: string) => trpc.reservation.cancel.mutate({ id }),
    onSuccess: refresh
  })

  if (me.isPending) return <p className="muted">読み込み中…</p>
  if (!signedIn) {
    return (
      <div className="card">
        <h1>予約管理（練習用）</h1>
        <p>予約を登録するには、ログインしてください。</p>
        <Link to="/login">ログイン画面へ</Link>
      </div>
    )
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    create.mutate(
      {
        title: String(form.get('title')),
        startsAt: new Date(String(form.get('startsAt'))),
        partySize: Number(form.get('partySize')),
        note: String(form.get('note') ?? '')
      },
      { onSuccess: () => formElement.reset() }
    )
  }

  return (
    <>
      <div className="card">
        <h2>予約を登録する</h2>
        <form onSubmit={submit}>
          <label>
            予約の名前
            <input name="title" required maxLength={100} placeholder="例: 会議室A 定例" />
          </label>
          <label>
            日時
            <input name="startsAt" type="datetime-local" required />
          </label>
          <label>
            人数
            <input name="partySize" type="number" min={1} max={20} defaultValue={2} required />
          </label>
          <label>
            メモ
            <textarea name="note" maxLength={500} rows={2} />
          </label>
          {create.error && <p className="error">{create.error.message}</p>}
          <button type="submit" disabled={create.isPending}>
            登録する
          </button>
        </form>
      </div>
      <div className="card">
        <h2>自分の予約</h2>
        {list.isPending && <p className="muted">読み込み中…</p>}
        {list.data?.length === 0 && <p className="muted">まだ予約はありません。</p>}
        {attachmentsOn && (
          <p className="muted">PDF・PNG・JPEG を1件5MBまで、1つの予約に3件まで添付できます。</p>
        )}
        {uploadError && <p className="error">{uploadError}</p>}
        {list.data && list.data.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>日時</th>
                <th>名前</th>
                <th>人数</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.data.map((item) => (
                <tr key={item.id}>
                  <td>{formatDate(item.startsAt)}</td>
                  <td>
                    {item.title}
                    {attachments.data
                      ?.filter((file) => file.reservationId === item.id)
                      .map((file) => (
                        <div key={file.id} className="muted">
                          <a href={`/api/attachments/${file.id}`}>{file.filename}</a>{' '}
                          <button
                            type="button"
                            className="sub"
                            disabled={removeAttachment.isPending}
                            onClick={() => removeAttachment.mutate(file.id)}
                          >
                            削除
                          </button>
                        </div>
                      ))}
                  </td>
                  <td>{item.partySize}</td>
                  <td>
                    {attachmentsOn && (
                      <label className="sub-button">
                        <button
                          type="button"
                          className="sub"
                          disabled={uploadingId === item.id}
                          onClick={(event) =>
                            event.currentTarget.parentElement?.querySelector('input')?.click()
                          }
                        >
                          添付
                        </button>
                        <input
                          type="file"
                          hidden
                          accept="application/pdf,image/png,image/jpeg"
                          onChange={(event) => {
                            upload(item.id, event.target.files?.[0])
                            event.target.value = ''
                          }}
                        />
                      </label>
                    )}{' '}
                    <button
                      type="button"
                      className="sub"
                      disabled={cancel.isPending}
                      onClick={() => cancel.mutate(item.id)}
                    >
                      取り消す
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
