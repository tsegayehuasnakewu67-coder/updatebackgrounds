import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const roleHome = { admin: '/admin', hr: '/hr', employee: '/me' };

export default function ChangePassword() {
  const { user, changePassword, logout } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [visible, setVisible] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const update = event => setForm(current => ({ ...current, [event.target.name]: event.target.value }));
  const toggle = name => setVisible(current => ({ ...current, [name]: !current[name] }));

  const submit = async event => {
    event.preventDefault();
    setError('');
    if (form.newPassword !== form.confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    if (form.newPassword.length < 12 || !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/.test(form.newPassword)) {
      setError('Use at least 12 characters with uppercase, lowercase, a number, and a symbol.');
      return;
    }
    if (form.newPassword === form.currentPassword) {
      setError('New password must be different from your current password.');
      return;
    }

    setLoading(true);
    try {
      const updated = await changePassword(form);
      navigate(roleHome[updated.role] || '/', { replace: true });
    } catch (requestError) {
      setError(requestError.message || 'Unable to change password.');
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    ['currentPassword', 'Current password'],
    ['newPassword', 'New password'],
    ['confirmPassword', 'Confirm new password'],
  ];

  return (
    <main className="auth-page min-h-screen px-4 py-10 flex items-center justify-center">
      <section className="auth-card w-full max-w-lg p-6 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <ShieldCheck className="text-blue-900" size={26} />
          <div>
            <h1 className="auth-title text-xl font-bold">Change your password</h1>
            <p className="auth-copy text-sm">{user?.fullName || user?.employeeId}</p>
          </div>
        </div>
        <p role="status" className="auth-alert auth-alert--warning mb-6">
          For your account security, please change your default password before continuing.
        </p>
        <form className="space-y-4" onSubmit={submit}>
          {fields.map(([name, label]) => (
            <div key={name}>
              <label className="auth-label mb-1.5 block text-sm font-medium" htmlFor={name}>{label}</label>
              <div className="relative">
                <input
                  autoComplete={name === 'currentPassword' ? 'current-password' : 'new-password'}
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
                  onClick={() => toggle(name)}
                  type="button"
                >
                  {visible[name] ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>
          ))}
          <p className="auth-copy text-xs leading-5">
            Password requirements: at least 12 characters, including uppercase and lowercase letters, a number, and a symbol.
          </p>
          {error && <p className="auth-alert auth-alert--error" role="alert">{error}</p>}
          <button className="auth-button auth-button--cta w-full" disabled={loading} type="submit">
            {loading ? <><Loader2 className="animate-spin" size={17} /> Changing password…</> : 'Change Password'}
          </button>
          <button className="auth-button auth-button--secondary w-full" onClick={() => { logout(); navigate('/login', { replace: true }); }} type="button">
            Sign out
          </button>
        </form>
      </section>
    </main>
  );
}
