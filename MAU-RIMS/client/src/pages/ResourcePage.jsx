import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Check, ChevronLeft, ChevronRight, Plus, Search, Trash2, X } from "lucide-react";
import PageHeader from "../components/common/PageHeader.jsx";
import { api, getErrorMessage } from "../services/api.js";

const definitions = {
  proposals: { title: "Research proposals", description: "Prepare, submit, and track proposal reviews.", fields: [["title", "Proposal title", "text", true], ["researchArea", "Research area", "area", true], ["abstract", "Abstract", "textarea", false], ["requestedBudget", "Requested budget", "number", false]], columns: ["proposalNumber", "title", "researchArea", "status"], createRoles: ["principal_investigator", "research_coordinator", "directorate_admin", "super_admin"] },
  projects: { title: "Research projects", description: "Monitor approved research projects and progress.", fields: [["title", "Project title", "text", true], ["proposal", "Approved proposal", "approvedProposal", true], ["description", "Description", "textarea", false], ["objectives", "Project objectives (comma-separated)", "list", false], ["startDate", "Start date", "date", false], ["endDate", "End date", "date", false]], columns: ["title", "status", "progress", "startDate"], createRoles: ["principal_investigator", "research_coordinator", "directorate_admin", "super_admin"] },
  researchers: { title: "Researchers", description: "Researcher profiles and institutional affiliations.", fields: [["user", "User account", "user", true], ["department", "Department", "text", true], ["campus", "Campus", "text", false], ["orcid", "ORCID iD", "text", false], ["experience", "Research experience", "textarea", false]], columns: ["department", "campus", "orcid"], createRoles: ["research_coordinator", "directorate_admin", "super_admin"] },
  publications: { title: "Publications", description: "Record and discover university research outputs.", fields: [["title", "Publication title", "text", true], ["journal", "Journal", "text", false], ["year", "Publication year", "number", false], ["doi", "DOI", "text", false], ["abstract", "Abstract", "textarea", false]], columns: ["title", "journal", "year", "doi"], createRoles: ["principal_investigator", "co_researcher", "research_coordinator", "directorate_admin", "super_admin"] },
  ethicsApplications: { title: "Ethics applications", description: "Submit applications for ethics review and follow decisions.", fields: [["title", "Application title", "text", true], ["proposal", "Related proposal", "proposal", false], ["description", "Study summary", "textarea", true]], columns: ["title", "status", "certificateNumber"], createRoles: ["principal_investigator", "directorate_admin", "super_admin"] },
  budgets: { title: "Research budgets", description: "Track approved budget allocations by project and category.", fields: [["title", "Budget record", "text", true], ["project", "Project", "project", true], ["category", "Category", "text", true], ["amount", "Allocated amount", "number", true], ["fiscalYear", "Fiscal year", "text", false]], columns: ["title", "category", "amount", "fiscalYear"], createRoles: ["finance_officer", "directorate_admin", "super_admin"] },
  departments: { title: "Departments", description: "University departments and their college affiliations.", fields: [["name", "Department name", "text", true], ["college", "College", "text", true], ["campus", "Campus", "text", false]], columns: ["name", "college", "campus"], createRoles: ["directorate_admin", "super_admin"] },
  campuses: { title: "Campuses", description: "Manage university campuses.", fields: [["name", "Campus name", "text", true], ["location", "Location", "text", false]], columns: ["name", "location"], createRoles: ["directorate_admin", "super_admin"] },
  colleges: { title: "Colleges", description: "Manage colleges and their campus affiliations.", fields: [["name", "College name", "text", true], ["campus", "Campus", "text", true]], columns: ["name", "campus"], createRoles: ["directorate_admin", "super_admin"] },
  researchAreas: { title: "Research areas", description: "Configurable institutional research priorities.", fields: [["name", "Research area", "text", true]], columns: ["name", "active"], createRoles: ["research_coordinator", "directorate_admin", "super_admin"] },
  collaborations: { title: "Collaborations", description: "Research partners and collaborative projects.", fields: [["title", "Collaboration title", "text", true], ["partnerInstitution", "Partner institution", "text", true], ["contactEmail", "Contact email", "email", false]], columns: ["title", "partnerInstitution", "status"], createRoles: ["research_coordinator", "directorate_admin", "super_admin"] },
  progressReports: { title: "Progress reports", description: "Submit regular project progress reports.", fields: [["title", "Report title", "text", true], ["project", "Project", "project", true], ["period", "Reporting period", "text", true], ["progress", "Progress (%)", "number", true], ["accomplishments", "Accomplishments", "textarea", false], ["challenges", "Challenges", "textarea", false], ["nextSteps", "Next steps", "textarea", false]], columns: ["title", "period", "progress", "status"], createRoles: ["principal_investigator", "co_researcher", "research_coordinator", "directorate_admin", "super_admin"] },
  milestones: { title: "Project milestones", description: "Track planned and completed project deliverables.", fields: [["title", "Milestone", "text", true], ["project", "Project", "project", true], ["description", "Details", "textarea", false], ["dueDate", "Due date", "date", false]], columns: ["title", "dueDate", "status"], createRoles: ["principal_investigator", "research_coordinator", "directorate_admin", "super_admin"] },
  expenditures: { title: "Expenditures", description: "Record and track project expenditure requests.", fields: [["title", "Expense description", "text", true], ["project", "Project", "project", true], ["category", "Category", "text", true], ["amount", "Amount", "number", true], ["incurredAt", "Date incurred", "date", false]], columns: ["title", "category", "amount", "status"], createRoles: ["finance_officer", "directorate_admin", "super_admin"] },
  notifications: { title: "Notifications", description: "Updates and requests related to your research.", fields: [["recipient", "Recipient", "user", true], ["message", "Message", "textarea", true], ["link", "Related link", "text", false]], columns: ["message", "createdAt", "readAt"], createRoles: ["directorate_admin", "super_admin"] }
};

const labelFor = (key) => key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
const displayValue = (value) => {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) return new Date(value).toLocaleDateString();
  if (typeof value === "object") return value.name || value.email || value._id || JSON.stringify(value);
  return String(value);
};

export default function ResourcePage() {
  const { resource } = useParams();
  const config = definitions[resource];
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [busy, setBusy] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [relationOptions, setRelationOptions] = useState({});
  const [assignmentTarget, setAssignmentTarget] = useState(null);
  const [reviewerOptions, setReviewerOptions] = useState([]);
  const [selectedReviewerIds, setSelectedReviewerIds] = useState([]);
  const [assignmentBusy, setAssignmentBusy] = useState(false);
  const [teamTarget, setTeamTarget] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [directory, setDirectory] = useState([]);
  const [newMemberId, setNewMemberId] = useState("");
  const [teamBusy, setTeamBusy] = useState(false);

  useEffect(() => { api.get("/auth/me").then(({ data }) => setCurrentUser(data.user)).catch(() => setCurrentUser(null)); }, []);
  useEffect(() => {
    if (!formOpen || !config) return;
    const needed = [...new Set(config.fields.map(([, , type]) => type).filter((type) => ["project", "proposal", "approvedProposal", "user", "area"].includes(type)))];
    Promise.all(needed.map(async (type) => {
      const endpoint = type === "project" ? "/projects" : type === "user" ? "/users" : type === "area" ? "/researchAreas" : "/proposals";
      const params = { limit: 100 };
      if (type === "approvedProposal") params.status = "approved";
      const { data } = await api.get(endpoint, { params });
      return [type, data.items || []];
    })).then((entries) => {
      setRelationOptions(Object.fromEntries(entries));
    }).catch((requestError) => setError(getErrorMessage(requestError)));
  }, [formOpen, resource]);
  async function load() {
    if (!config) return;
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get(`/${resource}`, { params: { page, limit: 10, search: search || undefined } });
      setItems(data.items);
      setPages(data.pages || 1);
    } catch (requestError) { setError(getErrorMessage(requestError)); }
    finally { setLoading(false); }
  }
  async function openTeam(project) {
    try {
      const [membersResult, directoryResult] = await Promise.all([
        api.get(`/projects/${project._id}/members`),
        api.get("/researchers/directory")
      ]);
      setTeamMembers(membersResult.data.items);
      setDirectory(directoryResult.data.items);
      setNewMemberId("");
      setTeamTarget(project);
    } catch (requestError) { setError(getErrorMessage(requestError)); }
  }
  async function addTeamMember(event) {
    event.preventDefault();
    if (!teamTarget || !newMemberId) return;
    setTeamBusy(true);
    setError("");
    try {
      await api.post(`/projects/${teamTarget._id}/members`, { userId: newMemberId });
      await openTeam(teamTarget);
      setNotice("Researcher added to the project team.");
    } catch (requestError) { setError(getErrorMessage(requestError)); }
    finally { setTeamBusy(false); }
  }
  async function removeTeamMember(userId) {
    if (!teamTarget || !window.confirm("Remove this researcher from the project team?")) return;
    try {
      await api.delete(`/projects/${teamTarget._id}/members/${userId}`);
      await openTeam(teamTarget);
      setNotice("Researcher removed from the project team.");
    } catch (requestError) { setError(getErrorMessage(requestError)); }
  }
  useEffect(() => { const timer = setTimeout(load, 250); return () => clearTimeout(timer); }, [resource, page, search]);

  if (!config) return <div className="alert alert-error">This section is not available in the workspace.</div>;
  const canCreate = currentUser && config.createRoles.includes(currentUser.role);
  const canDelete = currentUser && config.createRoles.includes(currentUser.role)
    && ["super_admin", "directorate_admin", "research_coordinator", "principal_investigator"].includes(currentUser.role);
  const canEdit = currentUser && config.createRoles.includes(currentUser.role);
  async function createRecord(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    for (const [key, value] of Object.entries(values)) {
      const field = config.fields.find(([name]) => name === key);
      if (field?.[2] === "list") {
        values[key] = value.split(",").map((entry) => entry.trim()).filter(Boolean);
        continue;
      }
      if (value === "" && (!editingItem || ["number", "date", "project", "proposal", "approvedProposal", "user", "area"].includes(field?.[2]))) {
        delete values[key];
        continue;
      }
      if (field?.[2] === "number") values[key] = Number(value);
    }
    try {
      if (editingItem) {
        await api.put(`/${resource}/${editingItem._id}`, values);
        setNotice("Record updated successfully.");
      } else {
        await api.post(`/${resource}`, values);
        setNotice("Record created successfully.");
      }
      setFormOpen(false);
      setEditingItem(null);
      form.reset();
      await load();
    } catch (requestError) { setError(getErrorMessage(requestError)); }
    finally { setBusy(false); }
  }
  async function deleteItem(item) {
    if (!window.confirm(`Delete "${item.title || item.name || "this record"}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/${resource}/${item._id}`);
      setNotice("Record deleted.");
      await load();
    } catch (requestError) { setError(getErrorMessage(requestError)); }
  }
  async function submitProposal(item) {
    try {
      await api.post(`/proposals/${item._id}/submit`);
      setNotice("Proposal submitted for review.");
      await load();
    } catch (requestError) { setError(getErrorMessage(requestError)); }
  }
  async function reviewProposal(item, decision) {
    const comments = window.prompt(`Optional comments for ${decision}:`) || "";
    try {
      await api.post(`/proposals/${item._id}/review`, { decision, comments });
      setNotice(`Proposal ${decision === "revision" ? "returned for revision" : `${decision}d`}.`);
      await load();
    } catch (requestError) { setError(getErrorMessage(requestError)); }
  }
  async function assignReviewer(item) {
    try {
      const { data: workflow } = await api.get("/workflow/proposals");
      const roles = workflow.stageRoles[item.status] || [];
      const results = await Promise.all(roles.map((role) => api.get("/users", { params: { role, limit: 100 } })));
      const uniqueReviewers = new Map(results.flatMap((result) => result.data.items).map((reviewer) => [reviewer._id, reviewer]));
      setReviewerOptions([...uniqueReviewers.values()]);
      setSelectedReviewerIds(item.assignments?.filter((assignment) => assignment.stage === item.status).map((assignment) => assignment.reviewer) || []);
      setAssignmentTarget(item);
    } catch (requestError) { setError(getErrorMessage(requestError)); }
  }
  async function saveReviewers(event) {
    event.preventDefault();
    if (!assignmentTarget || selectedReviewerIds.length === 0) return;
    setAssignmentBusy(true);
    setError("");
    try {
      await api.post(`/proposals/${assignmentTarget._id}/assign`, { stage: assignmentTarget.status, reviewerIds: selectedReviewerIds });
      setNotice(`Assigned ${selectedReviewerIds.length} reviewer${selectedReviewerIds.length === 1 ? "" : "s"}.`);
      setAssignmentTarget(null);
      await load();
    } catch (requestError) { setError(getErrorMessage(requestError)); }
    finally { setAssignmentBusy(false); }
  }
  async function registerProject(proposal) {
    try {
      await api.post("/projects", { title: proposal.title, proposal: proposal._id, principalInvestigator: proposal.owner });
      setNotice("Project registered from the approved proposal.");
    } catch (requestError) { setError(getErrorMessage(requestError)); }
  }
  async function reviewEthics(item, decision) {
    const comments = window.prompt(`Optional comments for ${decision}:`) || "";
    try {
      await api.post(`/ethicsApplications/${item._id}/review`, { decision, comments });
      setNotice(`Ethics application ${decision === "revision" ? "returned for revision" : `${decision}d`}.`);
      await load();
    } catch (requestError) { setError(getErrorMessage(requestError)); }
  }
  async function reviewProgress(item) {
    const feedback = window.prompt("Enter coordinator feedback:");
    if (!feedback) return;
    try {
      await api.post(`/progressReports/${item._id}/review`, { decision: "reviewed", feedback });
      setNotice("Progress report reviewed.");
      await load();
    } catch (requestError) { setError(getErrorMessage(requestError)); }
  }
  async function reviewExpenditure(item, decision) {
    const comment = window.prompt(`Optional decision comment for ${decision}:`) || "";
    try {
      await api.post(`/expenditures/${item._id}/review`, { decision, comment });
      setNotice(`Expenditure ${decision}.`);
      await load();
    } catch (requestError) { setError(getErrorMessage(requestError)); }
  }
  async function markNotificationRead(item) {
    try {
      await api.patch(`/notifications/${item._id}/read`);
      await load();
    } catch (requestError) { setError(getErrorMessage(requestError)); }
  }

  const columns = config.columns;
  return <div className="page-stack">
    <PageHeader
      eyebrow="RESEARCH WORKSPACE"
      title={config.title}
      description={config.description}
      breadcrumbs={[{ label: "Home", to: "/app", current: false }, { label: config.title, to: `/app/${resource}`, current: true }]}
      actions={canCreate ? <button className="button button-primary" onClick={() => { setEditingItem(null); setFormOpen(!formOpen); }}><Plus size={17} /> New record</button> : null}
    />
    {notice && <div className="alert alert-success"><Check size={16} />{notice}<button onClick={() => setNotice("")} aria-label="Dismiss"><X size={15} /></button></div>}
    {error && <div className="alert alert-error">{error}<button onClick={() => setError("")} aria-label="Dismiss"><X size={15} /></button></div>}
    {assignmentTarget && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setAssignmentTarget(null); }}><section className="panel assignment-modal" role="dialog" aria-modal="true" aria-labelledby="assignment-title"><div className="panel-heading"><div><h3 id="assignment-title">Assign proposal reviewer</h3><p className="muted">{assignmentTarget.title} · {labelFor(assignmentTarget.status)}</p></div><button type="button" className="icon-button" onClick={() => setAssignmentTarget(null)} aria-label="Close dialog"><X size={18} /></button></div><form onSubmit={saveReviewers}><div className="reviewer-options">{reviewerOptions.map((reviewer) => <label className="reviewer-option" key={reviewer._id}><input type="checkbox" checked={selectedReviewerIds.includes(reviewer._id)} onChange={(event) => setSelectedReviewerIds((ids) => event.target.checked ? [...ids, reviewer._id] : ids.filter((id) => id !== reviewer._id))} /><span><b>{reviewer.name}</b><small>{reviewer.email} · {reviewer.department || "No department listed"}</small></span></label>)}{reviewerOptions.length === 0 && <div className="empty-state">No active reviewers are available for this stage. Ask an administrator to provision a coordinator account.</div>}</div><div className="form-actions"><button type="button" className="button button-quiet" onClick={() => setAssignmentTarget(null)}>Cancel</button><button className="button button-primary" disabled={assignmentBusy || selectedReviewerIds.length === 0}>{assignmentBusy ? "Assigning…" : "Assign reviewers"}</button></div></form></section></div>}
    {teamTarget && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setTeamTarget(null); }}><section className="panel assignment-modal" role="dialog" aria-modal="true" aria-labelledby="team-title"><div className="panel-heading"><div><h3 id="team-title">Project research team</h3><p className="muted">{teamTarget.title}</p></div><button type="button" className="icon-button" onClick={() => setTeamTarget(null)} aria-label="Close dialog"><X size={18} /></button></div><form className="team-add-form" onSubmit={addTeamMember}><label>Researcher<select value={newMemberId} onChange={(event) => setNewMemberId(event.target.value)} required><option value="">Select a researcher…</option>{directory.filter((person) => !teamMembers.some((member) => member.user?._id === person.userId)).map((person) => <option value={person.userId} key={person.userId}>{person.name} · {person.department || person.campus || "Researcher"}</option>)}</select></label><button className="button button-primary" disabled={teamBusy || !newMemberId}>{teamBusy ? "Adding…" : "Add member"}</button></form><div className="reviewer-options">{teamMembers.map((member) => <div className="reviewer-option" key={member._id}><span><b>{member.user?.name || "Researcher"}</b><small>{member.role?.replaceAll("_", " ")} · {member.user?.department || "No department listed"}</small></span><button className="text-action text-danger" onClick={() => removeTeamMember(member.user?._id)}>Remove</button></div>)}{teamMembers.length === 0 && <div className="empty-state">No co-researchers have been added to this project.</div>}</div></section></div>}
    {formOpen && <form key={editingItem?._id || "new"} className="panel record-form" onSubmit={createRecord}><div className="panel-heading"><div><h3>{editingItem ? "Edit record" : "Create a record"}</h3><p className="muted">Fields marked required must be filled in.</p></div><button type="button" className="icon-button" onClick={() => { setFormOpen(false); setEditingItem(null); }}><X size={18} /></button></div><div className="form-grid">{config.fields.map(([name, label, type, required]) => { const rawValue = editingItem?.[name]; const value = type === "date" && rawValue ? new Date(rawValue).toISOString().slice(0, 10) : rawValue?._id || rawValue || ""; const options = relationOptions[type] || []; return <label key={name} className={type === "textarea" ? "span-two" : ""}>{label}{required && <span className="required-mark"> *</span>}{type === "textarea" ? <textarea name={name} required={required} rows="4" maxLength="10000" defaultValue={value} /> : ["project", "proposal", "approvedProposal", "user", "area"].includes(type) ? <select name={name} required={required} defaultValue={value}><option value="">Select…</option>{options.filter((option) => type !== "area" || option.active).map((option) => <option value={type === "area" ? option.name : option._id} key={option._id}>{option.title || option.name || option.email || `${option.name} (${option.proposalNumber})`}</option>)}</select> : <input name={name} type={type} required={required} min={type === "number" ? 0 : undefined} max={name === "progress" ? 100 : undefined} defaultValue={value} />}</label>; })}</div><div className="form-actions"><button type="button" className="button button-quiet" onClick={() => { setFormOpen(false); setEditingItem(null); }}>Cancel</button><button className="button button-primary" disabled={busy}>{busy ? "Saving…" : editingItem ? "Save changes" : "Save record"}</button></div></form>}
    <section className="panel table-panel">
      <div className="table-toolbar"><div><h3>Records</h3><span>{loading ? "Updating…" : `${items.length} shown`}</span></div><label className="searchbox"><Search size={17} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search records…" /></label></div>
      <div className="table-overflow"><table><thead><tr>{columns.map((column) => <th key={column}>{labelFor(column)}</th>)}<th className="action-head">Actions</th></tr></thead><tbody>
        {items.map((item) => <tr key={item._id}>{columns.map((column) => <td key={column}>{column === "status" ? <span className={`status-badge status-${item[column]}`}>{labelFor(item[column] || "unknown")}</span> : displayValue(item[column])}</td>)}<td><div className="row-actions">
          {resource === "proposals" && ["draft", "revision_required"].includes(item.status) && (item.owner === currentUser?.id || ["super_admin", "directorate_admin"].includes(currentUser?.role)) && <button className="text-action" onClick={() => submitProposal(item)}>Submit</button>}
          {resource === "proposals" && item.status === "approved" && (item.owner === currentUser?.id || ["super_admin", "directorate_admin", "research_coordinator"].includes(currentUser?.role)) && <button className="text-action" onClick={() => registerProject(item)}>Register project</button>}
          {resource === "ethicsApplications" && ["draft", "revision_required"].includes(item.status) && (item.owner === currentUser?.id || ["super_admin", "directorate_admin"].includes(currentUser?.role)) && <button className="text-action" onClick={async () => { try { await api.post(`/ethicsApplications/${item._id}/submit`); setNotice("Ethics application submitted."); await load(); } catch (requestError) { setError(getErrorMessage(requestError)); } }}>Submit</button>}
          {resource === "ethicsApplications" && ["submitted", "under_review", "revision_required"].includes(item.status) && ["ethics_reviewer", "directorate_admin", "super_admin"].includes(currentUser?.role) && <><button className="text-action" onClick={() => reviewEthics(item, "approve")}>Approve</button><button className="text-action text-danger" onClick={() => reviewEthics(item, "revision")}>Revise</button></>}
          {resource === "progressReports" && item.status === "submitted" && ["research_coordinator", "directorate_admin", "super_admin"].includes(currentUser?.role) && <button className="text-action" onClick={() => reviewProgress(item)}>Review report</button>}
          {resource === "expenditures" && item.status === "pending" && ["directorate_admin", "super_admin"].includes(currentUser?.role) && <><button className="text-action" onClick={() => reviewExpenditure(item, "approved")}>Approve</button><button className="text-action text-danger" onClick={() => reviewExpenditure(item, "rejected")}>Reject</button></>}
          {resource === "notifications" && !item.readAt && <button className="text-action" onClick={() => markNotificationRead(item)}>Mark read</button>}
          {resource === "projects" && (item.principalInvestigator === currentUser?.id || ["super_admin", "directorate_admin", "research_coordinator"].includes(currentUser?.role)) && <button className="text-action" onClick={() => openTeam(item)}>Team</button>}
          {canEdit && resource !== "notifications" && <button className="text-action" onClick={() => { setEditingItem(item); setFormOpen(true); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Edit</button>}
          {resource === "proposals" && ((item.status === "submitted" && ["department_coordinator", "super_admin", "directorate_admin"].includes(currentUser?.role)) || (item.status === "department_screening" && ["college_coordinator", "super_admin", "directorate_admin"].includes(currentUser?.role)) || (item.status === "college_review" && ["research_coordinator", "super_admin", "directorate_admin"].includes(currentUser?.role)) || (item.status === "directorate_review" && ["directorate_admin", "super_admin"].includes(currentUser?.role))) && <><button className="text-action" onClick={() => reviewProposal(item, "approve")}>{item.status === "directorate_review" ? "Final approve" : "Approve stage"}</button><button className="text-action text-danger" onClick={() => reviewProposal(item, "revision")}>Revise</button></>}
          {resource === "proposals" && ["submitted", "department_screening", "college_review", "directorate_review"].includes(item.status) && ["super_admin", "directorate_admin"].includes(currentUser?.role) && <button className="text-action" onClick={() => assignReviewer(item)}>Assign reviewer</button>}
          {canDelete && <button className="icon-button danger-icon" aria-label="Delete record" onClick={() => deleteItem(item)}><Trash2 size={16} /></button>}
        </div></td></tr>)}
        {!loading && items.length === 0 && <tr><td colSpan={columns.length + 1}><div className="empty-state">{search ? "No records match your search." : "There are no records yet."}</div></td></tr>}
      </tbody></table></div>
      <div className="pagination"><span>Page {page} of {pages}</span><div><button className="icon-button" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft size={18} /></button><button className="icon-button" aria-label="Next page" disabled={page >= pages} onClick={() => setPage(page + 1)}><ChevronRight size={18} /></button></div></div>
    </section>
  </div>;
}
