import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [info, setInfo] = useState('')

  const handleSubmit = async () => {
    setError(''); setInfo(''); setLoading(true)
    const fn = mode === 'signin' ? signIn : signUp
    const { error } = await fn(email, password)
    setLoading(false)
    if (error) { setError(error.message); return }
    if (mode === 'signup') {
      setInfo('Đăng ký thành công. Nếu bật xác nhận email, hãy kiểm tra hộp thư. Sau đó đăng nhập.')
      setMode('signin')
      return
    }
    navigate('/')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,#fde6e9_0%,transparent_45%)]" />
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center">
          <img src="/logo-mark.png" alt="Yokool" className="h-10 w-auto" />
        </div>

        <div className="card p-8 animate-rise">
          <h1 className="font-display text-xl font-700 text-ink">
            {mode === 'signin' ? 'Đăng nhập' : 'Tạo tài khoản'}
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            Quản lý quan hệ khách hàng quà tặng công nghệ
          </p>

          <div className="mt-6 space-y-4">
            <div>
              <label className="label-field">Email</label>
              <input className="input-field" type="email" value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="ban@congty.com"
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()} />
            </div>
            <div>
              <label className="label-field">Mật khẩu</label>
              <input className="input-field" type="password" value={password}
                onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()} />
            </div>

            {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
            {info && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{info}</p>}

            <button className="btn-primary w-full" onClick={handleSubmit} disabled={loading}>
              {loading ? 'Đang xử lý...' : mode === 'signin' ? 'Đăng nhập' : 'Đăng ký'}
            </button>
          </div>

          <p className="mt-5 text-center text-sm text-ink-soft">
            {mode === 'signin' ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}{' '}
            <button
              className="font-semibold text-brand hover:underline"
              onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setInfo('') }}
            >
              {mode === 'signin' ? 'Đăng ký' : 'Đăng nhập'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
