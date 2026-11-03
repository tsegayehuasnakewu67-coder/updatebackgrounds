import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, LockKeyhole } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { api, getErrorMessage } from "../services/api.js";

export default function AuthPage({ register = false, mode }) {
  const { user, login, register: createAccount } = useAuth();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const flow = mode || (register ? "register" : "login");
  if (user && flow !== "reset" && flow !== "forgot") return <Navigate to="/app" replace />;
  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const values = Object.fromEntries(form.entries());
    try {
      if (flow === "register") {
        await createAccount(values);
        navigate("/app");
      } else if (flow === "forgot") {
        const { data } = await api.post("/auth/forgot-password", values);
        setNotice(data.message);
      } else if (flow === "reset") {
        const { data } = await api.post("/auth/reset-password", { token: searchParams.get("token"), password: values.password });
        setNotice(data.message);
      } else {
        await login(values);
        navigate("/app");
      }
    } catch (requestError) { setError(getErrorMessage(requestError)); }
    finally { setBusy(false); }
  }
  return (
    <main className="auth-page">
      <section className="auth-brand-panel"><Link to="/" className="brand brand-light"><span className="brand-mark">M</span><span><b>MAU-RIMS</b><small>Mekdela Amba University</small></span></Link><div><span className="pill pill-light">RESEARCH WITH PURPOSE</span><h1>Bringing university research into focus.</h1><p>A secure workspace for the people, proposals, and projects shaping our future.</p></div><div className="auth-decoration"><i /><i /><i /><i /></div></section>
      <section className="auth-form-panel"><Link to="/" className="back-link"><ArrowLeft size={16} /> Back to home</Link><div className="auth-form-wrap"><span className="auth-icon"><LockKeyhole size={21} /></span><span className="eyebrow">{flow === "register" ? "JOIN THE RESEARCH COMMUNITY" : flow === "login" ? "WELCOME BACK" : "ACCOUNT SECURITY"}</span><h2>{flow === "register" ? "Create your account" : flow === "login" ? "Sign in to your account" : flow === "forgot" ? "Reset your password" : "Choose a new password"}</h2><p className="muted">{flow === "register" ? "Create an account to submit and manage your research." : flow === "login" ? "Use your university account to continue." : flow === "forgot" ? "We’ll email a secure reset link if the account is registered." : "Choose a new password for your account."}</p>
        <form className="form-stack" onSubmit={submit}>
          {flow === "register" && <label>Full name<input name="name" required minLength="2" maxLength="120" autoComplete="name" placeholder="Your full name" /></label>}
          {["register", "login", "forgot"].includes(flow) && <label>Email address<input name="email" type="email" required autoComplete="email" placeholder="name@university.edu" /></label>}
          {flow === "register" && <label>Department <span className="optional">OPTIONAL</span><input name="department" maxLength="120" placeholder="Your department" /></label>}
          {["register", "login", "reset"].includes(flow) && <label>{flow === "reset" ? "New password" : "Password"}<input name="password" type="password" required minLength={flow === "login" ? 1 : 8} autoComplete={flow === "login" ? "current-password" : "new-password"} placeholder={flow === "reset" ? "At least 8 characters" : "Enter your password"} /></label>}
          {flow === "register" && <p className="field-note">New accounts are registered as Principal Investigators. An administrator can update your role.</p>}
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          {notice && <div className="alert alert-success" role="status">{notice}</div>}
          <button className="button button-primary button-full" disabled={busy || (flow === "reset" && !searchParams.get("token"))}>{busy ? "Please wait…" : flow === "register" ? "Create account" : flow === "forgot" ? "Send reset link" : flow === "reset" ? "Update password" : "Sign in"} <ArrowRight size={17} /></button>
        </form>
        {flow === "login" && <p className="auth-switch"><Link to="/forgot-password">Forgot your password?</Link></p>}
        {flow === "reset" && notice && <p className="auth-switch"><Link to="/login">Return to sign in</Link></p>}
        {["register", "login"].includes(flow) && <p className="auth-switch">{flow === "register" ? "Already registered?" : "New to MAU-RIMS?"} <Link to={flow === "register" ? "/login" : "/register"}>{flow === "register" ? "Sign in" : "Create an account"}</Link></p>}
      </div></section>
    </main>
  );
}
