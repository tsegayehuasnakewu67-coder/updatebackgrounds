import { useEffect, useState } from "react";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import PageHeader from "../components/common/PageHeader.jsx";
import { api, getErrorMessage } from "../services/api.js";

function exportCsv(data) {
  const rows = [
    ["Report", "Category", "Count"],
    ...data.proposalStatuses.map((row) => ["Proposals", row._id, row.count]),
    ...data.projectsByStatus.map((row) => ["Projects", row._id, row.count]),
    ...data.publicationYears.map((row) => ["Publications", row._id ?? "Unspecified year", row.count]),
    ["Budget", "Total allocated", data.budgetAllocated]
  ];
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "mau-rims-research-summary.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function Reports() {
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { api.get("/reports/summary").then(({ data }) => setReport(data)).catch((requestError) => setError(getErrorMessage(requestError))); }, []);
  async function downloadReport(format) {
    try {
      const { data } = await api.get(`/reports/export/${format}`, { responseType: "blob" });
      const url = URL.createObjectURL(data);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `mau-rims-research-report.${format}`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (requestError) { setError(getErrorMessage(requestError)); }
  }
  return <div className="page-stack"><PageHeader
      eyebrow="RESEARCH INSIGHTS"
      title="Reports"
      description="Institutional research totals from stored records."
      breadcrumbs={[{ label: "Home", to: "/app", current: false }, { label: "Reports", to: "/app/reports", current: true }]}
      actions={report ? <div className="report-actions"><button className="button button-outline" onClick={() => exportCsv(report)}><Download size={17} /> CSV</button><button className="button button-outline" onClick={() => downloadReport("pdf")}><FileText size={17} /> PDF</button><button className="button button-primary" onClick={() => downloadReport("xlsx")}><FileSpreadsheet size={17} /> Excel</button></div> : null}
    />
    {error && <div className="alert alert-error">{error}</div>}
    {!report ? <div className="loading-card">Loading report data…</div> : <><div className="stat-grid report-stats"><div className="stat-card static-card"><span className="stat-icon stat-tone-2"><FileSpreadsheet size={19} /></span><span className="stat-label">Total budget allocation</span><strong>{Number(report.budgetAllocated).toLocaleString()}</strong><small>Currency values as entered</small></div><div className="stat-card static-card"><span className="stat-icon stat-tone-0"><FileSpreadsheet size={19} /></span><span className="stat-label">Researchers</span><strong>{report.researcherCount}</strong><small>Researcher profiles</small></div><div className="stat-card static-card"><span className="stat-icon stat-tone-1"><FileSpreadsheet size={19} /></span><span className="stat-label">Active projects</span><strong>{report.activeProjects}</strong><small>{report.completedProjects} completed projects</small></div><div className="stat-card static-card"><span className="stat-icon stat-tone-3"><FileSpreadsheet size={19} /></span><span className="stat-label">Publications</span><strong>{report.publicationCount}</strong><small>Recorded research outputs</small></div></div>
    <div className="dashboard-grid"><ReportTable title="Proposal status" rows={report.proposalStatuses} /><ReportTable title="Project status" rows={report.projectsByStatus} /><ReportTable title="Ethics review status" rows={report.ethicsStatuses} /><ReportTable title="Publication year" rows={report.publicationYears} /><ReportTable title="Expenditure status" rows={report.expenditureStatuses} amount /></div></>}
  </div>;
}

function ReportTable({ title, rows, amount }) {
  return <section className="panel report-panel"><h3>{title}</h3>{rows.length ? rows.map((row) => <div className="report-row" key={`${row._id}-${title}`}><span>{row._id ?? "Unspecified"}</span><b>{row.count}{amount ? ` · ${Number(row.amount).toLocaleString()}` : ""}</b></div>) : <div className="empty-state">No data available.</div>}</section>;
}
