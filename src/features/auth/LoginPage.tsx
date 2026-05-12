import { useState, type FormEvent } from 'react';

interface LoginPageProps {
  login: (username: string, password: string) => Promise<string | null>;
}

export default function LoginPage({ login }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    setLoading(true);
    setError(null);
    const err = await login(username.trim(), password);
    setLoading(false);
    if (err) setError(err);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Logo */}
        <div className="auth-logo">
          <span className="auth-logo__icon" aria-hidden="true">
            ✦
          </span>
          <h1 className="auth-logo__title">مهام اليوم</h1>
          <p className="auth-logo__sub">سجّل دخولك للمتابعة</p>
        </div>

        {/* Form */}
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="auth-field">
            <label htmlFor="auth-username" className="auth-label">
              اسم المستخدم
            </label>
            <input
              id="auth-username"
              type="text"
              className="auth-input"
              placeholder="أدخل اسم المستخدم"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              dir="auto"
              aria-required="true"
            />
          </div>

          <div className="auth-field">
            <label htmlFor="auth-password" className="auth-label">
              كلمة المرور
            </label>
            <input
              id="auth-password"
              type="password"
              className="auth-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              aria-required="true"
            />
          </div>

          {error && (
            <div className="auth-error" role="alert">
              ⚠️ {error}
            </div>
          )}

          <button
            type="submit"
            className="auth-btn"
            disabled={loading || !username.trim() || !password.trim()}
          >
            {loading ? (
              <>
                جاري التحقق
                <span className="auth-btn__spinner" aria-hidden="true" />
              </>
            ) : (
              'دخول ✦'
            )}
          </button>
        </form>

        <p className="auth-hint">تطبيق شخصي — لا يوجد تسجيل عام</p>
      </div>
    </div>
  );
}
