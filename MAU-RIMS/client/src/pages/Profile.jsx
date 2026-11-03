import { useState } from "react";
import { KeyRound, Save, UserRound } from "lucide-react";
import PageHeader from "../components/common/PageHeader.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { api, getErrorMessage } from "../services/api.js";

export default function Profile() {
  const { user, updateUser, logout } = useAuth();
  const [profileError, setProfileError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [profileNotice, setProfileNotice] = useState("");
  const [passwordNotice, setPasswordNotice] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  async function saveProfile(event) {
    event.preventDefault();
    setSavingProfile(true);
    setProfileError("");
    setProfileNotice("");
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    try {
      const { data } = await api.patch("/auth/profile", values);
      updateUser(data.user);
      setProfileNotice("Your profile has been updated.");
    } catch (error) { setProfileError(getErrorMessage(error)); }
    finally { setSavingProfile(false); }
  }
  async function changePassword(event) {
    event.preventDefault();
    setSavingPassword(true);
    setPasswordError("");
    setPasswordNotice("");
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    if (values.newPassword !== values.confirmPassword) {
      setPasswordError("The new passwords do not match.");
      setSavingPassword(false);
      return;
    }
    try {
      const { data } = await api.post("/auth/change-password", values);
      setPasswordNotice(data.message);
      form.reset();
      await logout();
    } catch (error) { setPasswordError(getErrorMessage(error)); }
    finally { setSavingPassword(false); }
  }
  return <div className="page-stack">
    <PageHeader
      eyebrow="ACCOUNT SETTINGS"
      title="My profile"
      description="Manage your personal information and account security."
      breadcrumbs={[{ label: "Home", to: "/app", current: false }, { label: "Profile", to: "/app/profile", current: true }]}
    />
    <section className="panel record-form">
      <div className="panel-heading"><div className="profile-title"><span className="stat-icon stat-tone-0"><UserRound size={19} /></span><div><h3>Personal information</h3><p className="muted">Account role: {user?.role?.replaceAll("_", " ")}</p></div></div></div>
      {profileError && <div className="alert alert-error">{profileError}</div>}{profileNotice && <div className="alert alert-success">{profileNotice}</div>}
      <form onSubmit={saveProfile}><div className="form-grid"><label>Full name<input name="name" required minLength="2" maxLength="120" defaultValue={user?.name || ""} /></label><label>Email address<input value={user?.email || ""} disabled /></label><label>Department<input name="department" maxLength="120" defaultValue={user?.department || ""} /></label><label>Phone<input name="phone" maxLength="40" defaultValue={user?.phone || ""} /></label></div><div className="form-actions"><button className="button button-primary" disabled={savingProfile}>{savingProfile ? "Saving…" : "Save profile"} <Save size={16} /></button></div></form>
    </section>
    <section className="panel record-form">
      <div className="panel-heading"><div className="profile-title"><span className="stat-icon stat-tone-2"><KeyRound size={19} /></span><div><h3>Change password</h3><p className="muted">Changing your password signs out all active sessions.</p></div></div></div>
      {passwordError && <div className="alert alert-error">{passwordError}</div>}{passwordNotice && <div className="alert alert-success">{passwordNotice}</div>}
      <form onSubmit={changePassword}><div className="form-grid"><label>Current password<input name="currentPassword" type="password" autoComplete="current-password" required /></label><label>New password<input name="newPassword" type="password" minLength="8" maxLength="200" autoComplete="new-password" required /></label><label>Confirm new password<input name="confirmPassword" type="password" minLength="8" maxLength="200" autoComplete="new-password" required /></label></div><div className="form-actions"><button className="button button-primary" disabled={savingPassword}>{savingPassword ? "Updating…" : "Change password"} <KeyRound size={16} /></button></div></form>
    </section>
  </div>;
}
