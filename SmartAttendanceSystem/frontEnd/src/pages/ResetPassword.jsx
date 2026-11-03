import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';
import api from '../services/api';
import PageBackButton from '../components/PageBackButton';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const legacyToken = searchParams.get('token') || '';
  const [resetGrant] = useState(() => legacyToken ? '' : sessionStorage.getItem('sat_reset_grant') || '');
  const [form, setForm] = useState({ newPassword: '', confirmPassword: '' });
  const [visible, setVisible] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const update = event => setForm(current => ({ ...current, [event.target.name]: event.target.value }));
  const submit = async event => {
    event.preventDefault();
    setError('');
    if (!legacyToken && !resetGrant) {
      setError('This reset link is invalid or expired. Request a new one.');
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    if (form.newPassword.length < 12 || !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/.test(form.newPassword)) {
      setError('Use at least 12 characters with uppercase, lowercase, a number, and a symbol.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { ...(resetGrant ? { resetToken: resetGrant } : { token: legacyToken }), ...form });
      sessionStorage.removeItem('sat_reset_grant');
      navigate('/login', { replace: true, state: { message: 'Password reset successfully. Sign in with your new password.' } });
    } catch (requestError) {
      setError(requestError.message || 'Unable to reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page min-h-screen px-4 py-10 flex items-center justify-center">
      <section className="auth-card w-full max-w-md p-6 sm:p-8">
        <PageBackButton fallback="/login" />
        <ShieldCheck className="mb-4 text-blue-900" size={28} />
        <h1 className="auth-title mb-2 text-xl font-bold">Set a new password</h1>
        <p className="auth-copy mb-6 text-sm">Choose a unique password that meets the security requirements.</p>
        <form className="space-y-4" onSubmit={submit}>
          {['newPassword', 'confirmPassword'].map((name, index) => {
            const label = index === 0 ? 'New password' : 'Confirm new password';
            return (
              <div key={name}>
                <label className="auth-label mb-1.5 block text-sm font-medium" htmlFor={name}>{label}</label>
                <div className="relative">
                  <input
                    autoComplete="new-password"
                    className="auth-field pr-11"
                    id={name}
                    name={name}
                    onChange={update}
                    required
                    type={visible[name] ? 'text' : 'password'}
                    value={form[name]}
                  />
                  <button
                    aria-label={visible[name] ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-900"
                    onClick={() => setVisible(current => ({ ...current, [name]: !current[name] }))}
                    type="button"
                  >
                    {visible[name] ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>
            );
          })}
          <p className="auth-copy text-xs leading-5">At least 12 characters with uppercase, lowercase, a number, and a symbol.</p>
          {error && <p className="auth-alert auth-alert--error" role="alert">{error}</p>}
          <button className="auth-button auth-button--cta w-full" disabled={loading} type="submit">
            {loading ? <><Loader2 className="animate-spin" size={17} /> Resetting…</> : 'Reset Password'}
          </button>
        </form>
        <Link className="auth-link mt-5 block text-center text-sm" to="/login">Back to sign in</Link>
      </section>
    </main>
  );
}
