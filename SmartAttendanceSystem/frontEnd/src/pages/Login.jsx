import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Camera,
  Eye,
  EyeOff,
  LockKeyhole,
  Loader2,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './Login.css';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({ identifier: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(form.identifier.trim(), form.password, rememberMe);
      navigate(user.mustChangePassword
        ? '/change-password'
        : (({ admin: '/admin', hr: '/hr', employee: '/me' })[user.role] || '/'), { replace: true });
    } catch (err) {
      const status = err?.response?.status;
      const errorCode = err?.response?.data?.error?.code;
      const retryAfter = Number(err?.response?.headers?.['retry-after']);
      const retryMessage = Number.isFinite(retryAfter) && retryAfter > 0
        ? ` Please wait about ${Math.ceil(retryAfter / 60)} minute${Math.ceil(retryAfter / 60) === 1 ? '' : 's'} before trying again.`
        : ' Please wait a few minutes before trying again.';
      setError(errorCode === 'LOGIN_RATE_LIMITED'
        ? `Too many sign-in attempts from this network.${retryMessage}`
        : errorCode === 'RATE_LIMITED'
          ? `This network has reached the general API request limit.${retryMessage}`
          : err?.response?.data?.message || (
            !err.response && ['ERR_NETWORK', 'ECONNABORTED'].includes(err.code)
              ? 'Unable to reach the login server. Confirm the backend is running and try again.'
              : status >= 500
                ? 'The server could not complete sign-in. Please try again shortly.'
                : err.message || 'Invalid credentials. Please try again.'
          ));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-root">
      <header className="login-university-brand">
        <img src="/mau-logo.png" alt="Mekdela Amba University logo" />
        <h1>Mekdela Amba University</h1>
        <p>SMART ATTENDANCE SYSTEM</p>
      </header>

      <div className="login-layout">
        <section className="login-panel" aria-label="Sign in">
          <div className="login-panel-content">
            <div className="login-card">
              <div className="login-card-heading">
                <h2>Welcome back</h2>
                <p>Sign in to access your attendance dashboard.</p>
              </div>

              {location.state?.message && (
                <div role="status" className="login-message login-success">
                  {location.state.message}
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate autoComplete="off">
                <div className="login-field">
                  <label htmlFor="login-identifier" className="login-label">
                    Employee ID or Email<span aria-hidden="true">*</span>
                  </label>
                  <div className="login-input-wrap">
                    <Mail className="login-input-icon" size={18} aria-hidden="true" />
                    <input
                      id="login-identifier"
                      name="login-identifier"
                      type="text"
                      autoComplete="username"
                      placeholder="Enter your employee ID or email"
                      required
                      value={form.identifier}
                      onChange={e => setForm(p => ({ ...p, identifier: e.target.value }))}
                      className="login-input"
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="login-field">
                  <label htmlFor="login-password" className="login-label">
                    Password<span aria-hidden="true">*</span>
                  </label>
                  <div className="login-input-wrap">
                    <LockKeyhole className="login-input-icon" size={18} aria-hidden="true" />
                    <input
                      id="login-password"
                      name="login-password"
                      type={showPw ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      required
                      value={form.password}
                      onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                      className="login-input login-input--password"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(v => !v)}
                      aria-label={showPw ? 'Hide password' : 'Show password'}
                      className="login-password-toggle"
                    >
                      {showPw
                        ? <EyeOff size={18} strokeWidth={2} />
                        : <Eye size={18} strokeWidth={2} />}
                    </button>
                  </div>
                </div>

                <div className="login-form-options">
                  <label className="login-remember">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={e => setRememberMe(e.target.checked)}
                    />
                    <span className="login-checkbox" aria-hidden="true" />
                    <span>Remember me</span>
                  </label>
                  <Link to="/forgot-password" className="login-forgot">
                    Forgot password?
                  </Link>
                </div>

                {error && (
                  <div role="alert" className="login-message login-error">
                    <span className="login-error-dot" aria-hidden="true" />
                    {error}
                  </div>
                )}

                <button type="submit" disabled={loading} className="login-btn">
                  {loading ? (
                    <><Loader2 size={17} className="login-spinner" /> Signing in…</>
                  ) : (
                    <>Sign in <ArrowRight size={19} strokeWidth={2.4} /></>
                  )}
                </button>
              </form>

              <div className="login-security">
                <span className="login-security-icon" aria-hidden="true">
                  <ShieldCheck size={19} strokeWidth={1.9} />
                </span>
                <span>
                  <strong>Your account is protected</strong>
                  <small>Secure access for the MAU community.</small>
                </span>
              </div>
            </div>

            <a href="/kiosk" className="kiosk-cta" aria-label="Go to face check-in to mark attendance">
              <span className="kiosk-cta-icon" aria-hidden="true">
                <Camera size={20} strokeWidth={1.8} />
              </span>
              <span className="kiosk-cta-text">
                <strong>Mark Attendance — Face Check-In</strong>
                <small>Use the camera to record your attendance</small>
              </span>
              <ArrowRight className="kiosk-cta-arrow" size={17} strokeWidth={2.2} aria-hidden="true" />
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
