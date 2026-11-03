import { useEffect, useState } from "react";
import { Download, FileText, Trash2, Upload } from "lucide-react";
import PageHeader from "../components/common/PageHeader.jsx";
import { api, getErrorMessage } from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function Documents() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [file, setFile] = useState(null);
  const [category, setCategory] = useState("");
  const [projectId, setProjectId] = useState("");
  const [access, setAccess] = useState("private");
  const [previousVersionId, setPreviousVersionId] = useState("");
  const [search, setSearch] = useState("");
  const [versions, setVersions] = useState([]);
  const [versionError, setVersionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function load() {
    try { const { data } = await api.get("/documents", { params: { search: search || undefined, limit: 100 } }); setDocuments(data.items); }
    catch (requestError) { setError(getErrorMessage(requestError)); }
  }
  useEffect(() => { load(); }, [search]);
  async function uploadFile(event) {
    event.preventDefault();
    if (!file) return;
    const form = event.currentTarget;
    setBusy(true);
    setError("");
    const body = new FormData();
    body.append("file", file);
    body.append("category", category);
    if (projectId) {
      body.append("relatedType", "Project");
      body.append("relatedId", projectId);
    }
    body.append("access", access);
    if (previousVersionId) body.append("previousVersionId", previousVersionId);
    try {
      await api.post("/documents", body, { headers: { "Content-Type": "multipart/form-data" } });
      setFile(null);
      setPreviousVersionId("");
      form.reset();
      setNotice("Document uploaded.");
      await load();
    } catch (requestError) { setError(getErrorMessage(requestError)); }
    finally { setBusy(false); }
  }
  async function download(item) {
    try {
      const { data } = await api.get(`/documents/${item._id}/download`, { responseType: "blob" });
      const url = URL.createObjectURL(data);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = item.originalName;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (requestError) { setError(getErrorMessage(requestError)); }
  }
  async function remove(item) {
    if (!window.confirm(`Delete ${item.originalName}?`)) return;
    try { await api.delete(`/documents/${item._id}`); await load(); }
    catch (requestError) { setError(getErrorMessage(requestError)); }
  }
  async function showVersions(item) {
    try {
      const { data } = await api.get(`/documents/${item._id}/versions`);
      setVersions(data.items);
      setVersionError("");
    } catch (requestError) { setVersionError(getErrorMessage(requestError)); }
  }
  function startNewVersion(item) {
    setPreviousVersionId(item._id);
    setCategory(item.category || "");
    setProjectId(item.relatedType === "Project" ? item.relatedId : "");
    setAccess(item.access || "private");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  return <div className="page-stack">
    <PageHeader
      eyebrow="RESEARCH WORKSPACE"
      title="Documents"
      description="Securely store and retrieve research documents."
      breadcrumbs={[{ label: "Home", to: "/app", current: false }, { label: "Documents", to: "/app/documents", current: true }]}
    />
    {error && <div className="alert alert-error">{error}</div>}{notice && <div className="alert alert-success">{notice}</div>}
    <form className="panel upload-panel" onSubmit={uploadFile}><div><span className="stat-icon stat-tone-2"><Upload size={19} /></span><h3>{previousVersionId ? "Upload a new version" : "Upload a document"}</h3><p className="muted">PDF, DOC, or DOCX · maximum 10 MB</p></div><div className="upload-controls"><label>Document category<input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="e.g. Proposal, ethics form" maxLength="100" /></label><label>Related project ID<input value={projectId} onChange={(event) => setProjectId(event.target.value)} placeholder="Optional" /></label><label>Access<select value={access} onChange={(event) => setAccess(event.target.value)}><option value="private">Private to me</option><option value="project">Project team</option></select></label><label className="file-picker"><span>{file?.name || "Choose a file"}</span><input type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => setFile(event.target.files?.[0] || null)} required /></label><button className="button button-primary" disabled={busy || !file}>{busy ? "Uploading…" : previousVersionId ? "Upload new version" : "Upload file"} <Upload size={16} /></button>{previousVersionId && <button className="button button-quiet" type="button" onClick={() => setPreviousVersionId("")}>Cancel version</button>}</div></form>
    {versionError && <div className="alert alert-error">{versionError}</div>}
    {versions.length > 0 && <section className="panel table-panel"><div className="table-toolbar"><div><h3>Document version history</h3><span>{versions.length} versions</span></div></div><div className="document-list">{versions.map((item) => <article className="document-row" key={item._id}><span className="document-icon"><FileText size={20} /></span><div className="document-meta"><b>{item.originalName} · v{item.version}</b><small>{(item.size / 1024 / 1024).toFixed(2)} MB · {new Date(item.createdAt).toLocaleDateString()}</small></div><button className="icon-button" aria-label={`Download version ${item.version}`} onClick={() => download(item)}><Download size={17} /></button></article>)}</div></section>}
    <section className="panel table-panel"><div className="table-toolbar"><div><h3>Documents</h3><span>{documents.length} current files</span></div><label className="searchbox"><FileText size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search documents…" /></label></div><div className="document-list">{documents.map((item) => <article className="document-row" key={item._id}><span className="document-icon"><FileText size={20} /></span><div className="document-meta"><b>{item.originalName}{item.version > 1 ? ` · v${item.version}` : ""}</b><small>{item.category || "Uncategorized"} · {item.access} · {(item.size / 1024 / 1024).toFixed(2)} MB · {new Date(item.createdAt).toLocaleDateString()}</small></div><button className="text-action" onClick={() => showVersions(item)}>Versions</button>{String(item.owner) === String(user?.id) && <button className="text-action" onClick={() => startNewVersion(item)}>New version</button>}<button className="icon-button" aria-label={`Download ${item.originalName}`} onClick={() => download(item)}><Download size={17} /></button><button className="icon-button danger-icon" aria-label={`Delete ${item.originalName}`} onClick={() => remove(item)}><Trash2 size={17} /></button></article>)}{documents.length === 0 && <div className="empty-state">Uploaded documents will be listed here.</div>}</div></section>
  </div>;
}
