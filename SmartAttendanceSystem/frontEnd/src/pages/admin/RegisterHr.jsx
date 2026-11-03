import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  Copy,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import { authService } from '../../services/authService';

const DEPARTMENTS = [
  'Human Resources',
  'Information Technology',
  'Finance',
  'Administration',
  'Operations',
  'Marketing',
  'Customer Service',
];

const POSITIONS = [
  'HR Manager',
  'HR Officer',
  'HR Assistant',
  'HR Specialist',
  'Recruitment Officer',
  'Payroll Officer',
];

const INITIAL_FORM = {
  fullName: '',
  employeeId: '',
  email: '',
  department: '',
  position: '',
  password: '',
  confirmPassword: '',
};

const PASSWORD_GROUPS = [
  'ABCDEFGHJKLMNPQRSTUVWXYZ',
  'abcdefghijkmnopqrstuvwxyz',
  '23456789',
  '!@#$%^&*()-_=+',
];
const PASSWORD_CHARACTERS = PASSWORD_GROUPS.join('');

const getError = error => error?.response?.data?.message || error.message || 'Unable to create the HR account.';

function generateTemporaryPassword() {
  const secureCrypto = globalThis.crypto;
  if (!secureCrypto?.getRandomValues) {
    throw new Error('Secure password generation is unavailable in this browser. Please use an up-to-date browser.');
  }

  const randomIndex = max => secureCrypto.getRandomValues(new Uint32Array(1))[0] % max;
  const password = PASSWORD_GROUPS.map(group => group[randomIndex(group.length)]);
  while (password.length < 20) {
    password.push(PASSWORD_CHARACTERS[randomIndex(PASSWORD_CHARACTERS.length)]);
  }
  for (let index = password.length - 1; index > 0; index -= 1) {
    const swapIndex = randomIndex(index + 1);
    [password[index], password[swapIndex]] = [password[swapIndex], password[index]];
  }
  return password.join('');
}

export default function RegisterHr() {
  const navigate = useNavigate();
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const update = event => {
    const { name, value } = event.target;
    setForm(current => ({ ...current, [name]: value }));
    setCopied(false);
    setError('');
  };

  const createPassword = () => {
    try {
      const password = generateTemporaryPassword();
      setForm(current => ({ ...current, password, confirmPassword: password }));
      setCopied(false);
      setError('');
    } catch (generationError) {
      setError(generationError.message);
    }
  };

  const copyPassword = async () => {
    if (!form.password) {
      setError('Generate a temporary password before copying it.');
      return;
    }
    try {
      await navigator.clipboard.writeText(form.password);
      setCopied(true);
      setError('');
    } catch {
      setCopied(false);
      setError('Could not access the clipboard. Select and copy the password manually.');
    }
  };

  const submit = async event => {
    event.preventDefault();
    setError('');
    setSuccess('');
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (form.password.length < 12
      || !/[a-z]/.test(form.password)
      || !/[A-Z]/.test(form.password)
      || !/\d/.test(form.password)
      || !/[^A-Za-z0-9]/.test(form.password)) {
      setError('Password must be at least 12 characters and include uppercase, lowercase, a number, and a symbol.');
      return;
    }

    setSaving(true);
    try {
      const result = await authService.registerHr({
        fullName: form.fullName.trim(),
        employeeId: form.employeeId.trim(),
        email: form.email.trim(),
        department: form.department,
        position: form.position,
        password: form.password,
        confirmPassword: form.confirmPassword,
      });
      const createdName = result.user?.fullName;
      setSuccess(`${createdName || 'HR account'} created. The account will require a password change at first sign-in.`);
      setForm(INITIAL_FORM);
      setCopied(false);
      window.setTimeout(() => navigate('/admin/users'), 1400);
    } catch (requestError) {
      setError(getError(requestError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="admin-hr-register-page">
      <Link className="admin-hr-register-back" to="/admin/register">
        <ArrowLeft size={16} /> Back to employee registration
      </Link>
      <header>
        <p>ADMINISTRATION</p>
        <h1><UserPlus size={23} /> Create HR account</h1>
        <span>Only an authenticated Admin can create an account. The server assigns the HR role.</span>
      </header>

      {error && <p className="auth-alert auth-alert--error" role="alert">{error}</p>}
      {success && <p className="auth-alert auth-alert--success" role="status">{success}</p>}

      <form className="admin-hr-register-form" onSubmit={submit}>
        <label className="admin-hr-register-field">
          Full name
          <input autoComplete="name" maxLength={120} name="fullName" onChange={update} required value={form.fullName} />
        </label>
        <label className="admin-hr-register-field">
          Employee ID
          <input autoComplete="off" maxLength={64} name="employeeId" onChange={update} required value={form.employeeId} />
        </label>
        <label className="admin-hr-register-field">
          Email address
          <input autoComplete="email" maxLength={254} name="email" onChange={update} required type="email" value={form.email} />
        </label>
        <label className="admin-hr-register-field">
          Department
          <select name="department" onChange={update} required value={form.department}>
            <option disabled value="">Select a department</option>
            {DEPARTMENTS.map(department => <option key={department} value={department}>{department}</option>)}
          </select>
        </label>
        <label className="admin-hr-register-field">
          Position / Job Title
          <select name="position" onChange={update} required value={form.position}>
            <option disabled value="">Select a position</option>
            {POSITIONS.map(position => <option key={position} value={position}>{position}</option>)}
          </select>
        </label>

        <div className="admin-hr-register-password-section">
          <div className="admin-hr-register-password-heading">
            <label htmlFor="hr-account-password">Password</label>
            <button className="admin-hr-register-generate" disabled={saving} onClick={createPassword} type="button">
              <ShieldCheck size={15} /> Generate secure temporary password
            </button>
          </div>
          <div className="admin-hr-password-control">
            <input
              autoComplete="new-password"
              id="hr-account-password"
              maxLength={128}
              minLength={12}
              name="password"
              onChange={update}
              required
              type={showPasswords ? 'text' : 'password'}
              value={form.password}
            />
            <button
              aria-label={showPasswords ? 'Hide password' : 'Show password'}
              aria-pressed={showPasswords}
              className="admin-hr-password-icon"
              onClick={() => setShowPasswords(current => !current)}
              type="button"
            >
              {showPasswords ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
            <button
              aria-label={copied ? 'Password copied' : 'Copy generated password'}
              className="admin-hr-password-icon"
              disabled={!form.password || saving}
              onClick={copyPassword}
              type="button"
            >
              {copied ? <Check size={17} /> : <Copy size={17} />}
            </button>
          </div>
          <small className="admin-hr-register-password-note">
            Minimum 12 characters with uppercase, lowercase, number, and symbol. Copy it before creating the account;
            the API never returns the plaintext password.
          </small>
          {import.meta.env.DEV && (
            <button className="admin-hr-register-dev-helper" disabled={saving} onClick={createPassword} type="button">
              Development-only demo password helper
            </button>
          )}
        </div>

        <label className="admin-hr-register-field">
          Confirm password
          <input
            autoComplete="new-password"
            maxLength={128}
            minLength={12}
            name="confirmPassword"
            onChange={update}
            required
            type={showPasswords ? 'text' : 'password'}
            value={form.confirmPassword}
          />
        </label>

        <p className="admin-hr-register-security-note">
          The password is securely hashed by the backend. HR users must change this temporary password at first sign-in;
          deliver it only through an approved secure channel.
        </p>

        <div className="admin-hr-register-actions">
          <button className="auth-button auth-button--primary" disabled={saving} type="submit">
            {saving ? <><Loader2 className="spin" size={16} /> Creating account…</> : <><UserPlus size={16} /> Create HR account</>}
          </button>
          <button className="admin-hr-register-cancel" disabled={saving} onClick={() => navigate('/admin/users')} type="button">
            Cancel
          </button>
        </div>
      </form>
    </main>
  );
}
