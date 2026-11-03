import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Loader2, Mail, ShieldCheck } from 'lucide-react';
import PageBackButton from '../components/PageBackButton';
import api from '../services/api';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState('email');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!cooldown) return undefined;
    const timer = window.setTimeout(() => setCooldown(value => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const requestCode = async (event, resend = false) => {
    event.preventDefault();
    setMessage('');
    setError('');
    setLoading(true);
    try {
      const response = await api.post(resend ? '/auth/resend-reset-code' : '/auth/forgot-password', { email: email.trim() });
      setMessage(response.data.message);
      if (response.data.success && response.data.data?.nextStep === 'verify') {
        setStage('code');
        setCooldown(60);
      } else {
        setError('The reset request could not be confirmed. Please try again.');
      }
    } catch (requestError) {
      setError(requestError.message || 'Unable to request a verification code.');
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async event => {
    event.preventDefault();
    setMessage('');
    setError('');
    setLoading(true);
    try {
      const response = await api.post('/auth/verify-reset-code', { email: email.trim(), code });
      sessionStorage.setItem('sat_reset_grant', response.data.data.resetToken);
      navigate('/reset-password', { replace: true });
    } catch (requestError) {
      setError(requestError.message || 'The verification code is invalid or expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page min-h-screen px-4 py-10 flex items-center justify-center">
      <section className="auth-card w-full max-w-md p-6 sm:p-8">
        <PageBackButton fallback="/login" />
        {stage === 'email' ? <Mail className="mb-4 text-blue-900" size={28} /> : <ShieldCheck className="mb-4 text-blue-900" size={28} />}
        <h1 className="auth-title text-xl font-bold">{stage === 'email' ? 'Forgot password?' : 'Verify your email'}</h1>
        <p className="auth-copy mb-6 mt-2 text-sm leading-6">
          {stage === 'email'
            ? 'Enter the email registered to your account. If an account exists, a verification code will be sent.'
            : `Enter the six-digit code sent to ${email}.`}
        </p>
        {stage === 'email' ? (
          <form className="space-y-4" onSubmit={event => requestCode(event)}>
            <label className="auth-label block text-sm font-medium" htmlFor="reset-email">Email address</label>
            <input autoComplete="email" className="auth-field" id="reset-email" maxLength={254} onChange={event => setEmail(event.target.value)} required type="email" value={email} />
            {error && <p className="auth-alert auth-alert--error" role="alert">{error}</p>}
            <button className="auth-button auth-button--primary w-full" disabled={loading} type="submit">
              {loading ? <><Loader2 className="animate-spin" size={17} /> Sending…</> : 'Send Verification Code'}
            </button>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={verifyCode}>
            <label className="auth-label block text-sm font-medium" htmlFor="reset-code">Six-digit verification code</label>
            <input autoComplete="one-time-code" className="auth-field reset-code-input" id="reset-code" inputMode="numeric" maxLength={6} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} pattern="[0-9]{6}" required value={code} />
            {message && <p className="auth-alert auth-alert--success" role="status">{message}</p>}
            {error && <p className="auth-alert auth-alert--error" role="alert">{error}</p>}
            <button className="auth-button auth-button--primary w-full" disabled={loading || code.length !== 6} type="submit">
              {loading ? <><Loader2 className="animate-spin" size={17} /> Verifying…</> : <>Verify Code <ArrowRight size={16} /></>}
            </button>
            <div className="reset-code-actions">
              <button className="auth-button auth-button--secondary" disabled={loading || cooldown > 0} onClick={event => requestCode(event, true)} type="button">
                {cooldown ? `Resend in ${cooldown}s` : 'Resend Code'}
              </button>
              <button className="auth-link reset-change-email" onClick={() => { setStage('email'); setCode(''); setError(''); setMessage(''); }} type="button">Change email</button>
            </div>
          </form>
        )}
        <Link className="auth-link mt-5 block text-center text-sm" to="/login">Back to sign in</Link>
      </section>
    </main>
  );
}
