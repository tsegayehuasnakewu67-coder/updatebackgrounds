import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import PageHeader from "../components/common/PageHeader.jsx";
import { api, getErrorMessage } from "../services/api.js";

const stages = [
  ["submitted", "Department screening"],
  ["department_screening", "College review"],
  ["college_review", "Directorate review"],
  ["directorate_review", "Final approval"]
];
const roles = ["department_coordinator", "college_coordinator", "research_coordinator", "directorate_admin", "super_admin"];
const label = (role) => role.replaceAll("_", " ");

export default function WorkflowSettings() {
  const [stageRoles, setStageRoles] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.get("/workflow/proposals").then(({ data }) => setStageRoles(data.stageRoles)).catch((requestError) => setError(getErrorMessage(requestError)));
  }, []);
  function toggle(stage, role, checked) {
    setStageRoles((current) => ({
      ...current,
      [stage]: checked ? [...current[stage], role] : current[stage].filter((value) => value !== role)
    }));
  }
  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { data } = await api.put("/workflow/proposals", { stageRoles });
      setStageRoles(data.stageRoles);
      setNotice("Proposal review roles have been saved.");
    } catch (requestError) { setError(getErrorMessage(requestError)); }
    finally { setBusy(false); }
  }
  if (!stageRoles) return <div className={error ? "alert alert-error" : "loading-card"}>{error || "Loading workflow settings…"}</div>;
  return <div className="page-stack">
    <PageHeader
      eyebrow="SYSTEM ADMINISTRATION"
      title="Proposal workflow"
      description="Choose which roles may review proposals at each configured stage."
      breadcrumbs={[{ label: "Home", to: "/app", current: false }, { label: "Workflow settings", to: "/app/workflow", current: true }]}
    />
    <div className="alert alert-success">Super Administrators and Directorate Administrators can always review proposals as emergency approvers.</div>
    {error && <div className="alert alert-error">{error}</div>}{notice && <div className="alert alert-success">{notice}</div>}
    <form className="workflow-settings" onSubmit={save}>{stages.map(([stage, stageName], index) => <section className="panel workflow-stage" key={stage}><div className="workflow-stage-heading"><span className="workflow-step">{index + 1}</span><div><h3>{stageName}</h3><p className="muted">Proposal state: {stage.replaceAll("_", " ")}</p></div></div><div className="workflow-role-grid">{roles.map((role) => <label className="workflow-role" key={role}><input type="checkbox" checked={stageRoles[stage].includes(role)} onChange={(event) => toggle(stage, role, event.target.checked)} /><span>{label(role)}</span></label>)}</div>{stageRoles[stage].length === 0 && <p className="required-mark">Select at least one reviewer role.</p>}</section>)}<div className="form-actions"><button className="button button-primary" disabled={busy || stages.some(([stage]) => stageRoles[stage].length === 0)}>{busy ? "Saving…" : "Save workflow"} <Save size={16} /></button></div></form>
  </div>;
}
