import { useEffect, useState } from "react";
import { Plus, Search, ShieldCheck, UserX, X } from "lucide-react";
import PageHeader from "../components/common/PageHeader.jsx";
import { api, getErrorMessage } from "../services/api.js";

const roles = ["super_admin", "directorate_admin", "research_coordinator", "college_coordinator", "department_coordinator", "principal_investigator", "co_researcher", "ethics_reviewer", "finance_officer", "management"];
const prettyRole = (role) => role.replaceAll("_", " ");

export default function Users() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    try {
      const { data } = await api.get("/users", { params: { search: search || undefined, limit: 100, includeInactive: true } });
      setUsers(data.items);
    } catch (requestError) { setError(getErrorMessage(requestError)); }
  }
  useEffect(() => { load(); }, [search]);
  async function create(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    try {
      await api.post("/users", values);
      setNotice("Account created.");
      setFormOpen(false);
      form.reset();
      await load();
    } catch (requestError) { setError(getErrorMessage(requestError)); }
    finally { setBusy(false); }
  }
  async function updateRole(user, role) {
    try {
      await api.patch(`/users/${user._id}`, { role });
      setNotice(`Updated access for ${user.name}.`);
      await load();
    } catch (requestError) { setError(getErrorMessage(requestError)); }
  }
  async function deactivate(user) {
    if (!window.confirm(`Deactivate ${user.name}'s account?`)) return;
    try {
      await api.delete(`/users/${user._id}`);
      setNotice(`Deactivated ${user.name}.`);
      await load();
    } catch (requestError) { setError(getErrorMessage(requestError)); }
  }
  return <div className="page-stack">
    <PageHeader
      eyebrow="ADMINISTRATION"
      title="User management"
      description="Provision accounts and assign role-based access."
      breadcrumbs={[{ label: "Home", to: "/app", current: false }, { label: "User management", to: "/app/users", current: true }]}
      actions={<button className="button button-primary" onClick={() => setFormOpen(!formOpen)}><Plus size={17} /> Add user</button>}
    />
    {error && <div className="alert alert-error">{error}<button onClick={() => setError("")}><X size={15} /></button></div>}
    {notice && <div className="alert alert-success">{notice}<button onClick={() => setNotice("")}><X size={15} /></button></div>}
    {formOpen && <form className="panel record-form" onSubmit={create}><div className="panel-heading"><div><h3>Create an account</h3><p className="muted">Use a temporary password and share it securely.</p></div><button type="button" className="icon-button" onClick={() => setFormOpen(false)}><X size={18} /></button></div><div className="form-grid"><label>Full name<input name="name" required minLength="2" maxLength="120" /></label><label>Email<input name="email" type="email" required /></label><label>Temporary password<input name="password" type="password" minLength="8" required /></label><label>Role<select name="role" required defaultValue="principal_investigator">{roles.map((role) => <option value={role} key={role}>{prettyRole(role)}</option>)}</select></label><label>Department<input name="department" maxLength="120" /></label><label>Phone<input name="phone" maxLength="40" /></label></div><div className="form-actions"><button type="button" className="button button-quiet" onClick={() => setFormOpen(false)}>Cancel</button><button className="button button-primary" disabled={busy}>{busy ? "Creating…" : "Create account"}</button></div></form>}
    <section className="panel table-panel"><div className="table-toolbar"><div><h3>University accounts</h3><span>{users.length} accounts</span></div><label className="searchbox"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search users…" /></label></div><div className="table-overflow"><table><thead><tr><th>Name</th><th>Email</th><th>Department</th><th>Role</th><th>Account</th><th>Actions</th></tr></thead><tbody>{users.map((user) => <tr key={user._id}><td>{user.name}</td><td>{user.email}</td><td>{user.department || "—"}</td><td><select className="role-select" value={user.role} onChange={(event) => updateRole(user, event.target.value)} aria-label={`Role for ${user.name}`}>{roles.map((role) => <option value={role} key={role}>{prettyRole(role)}</option>)}</select></td><td><span className={`status-badge ${user.isActive ? "status-active" : "status-rejected"}`}>{user.isActive ? "Active" : "Inactive"}</span></td><td><button className="icon-button danger-icon" aria-label={`Deactivate ${user.name}`} disabled={!user.isActive} onClick={() => deactivate(user)}><UserX size={16} /></button></td></tr>)}{users.length === 0 && <tr><td colSpan="6"><div className="empty-state">No users found.</div></td></tr>}</tbody></table></div></section>
    <p className="field-note"><ShieldCheck size={14} /> Passwords are hashed by the server; accounts self-registered through the public form receive Principal Investigator access.</p>
  </div>;
}
