import { useEffect, useState } from "react";
import { ArrowUpRight, BookOpen, Clock3, FileCheck2, FolderKanban, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import PageHeader from "../components/common/PageHeader.jsx";
import { api, getErrorMessage } from "../services/api.js";

const COLORS = ["#198754", "#e7a43a", "#4979b8", "#cf5f5f", "#7b6ab0", "#8ba6a1"];
const cardSpecs = [
  ["proposals", "Research proposals", FileCheck2, "/app/proposals"],
  ["pendingProposals", "Awaiting review", Clock3, "/app/proposals"],
  ["projects", "Research projects", FolderKanban, "/app/projects"],
  ["publications", "Publications", BookOpen, "/app/publications"]
];

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api.get("/dashboard").then(({ data: result }) => setData(result)).catch((requestError) => setError(getErrorMessage(requestError)));
  }, []);
  if (error) return <div className="alert alert-error">{error}</div>;
  if (!data) return <div className="loading-card">Loading your research overview…</div>;
  const chartData = data.proposalStatuses.map((row) => ({ name: row._id.replaceAll("_", " "), value: row.count }));
  return <div className="page-stack">
    <PageHeader
      eyebrow="YOUR WORKSPACE"
      title="Research overview"
      description="A live view of research activity you can access."
      breadcrumbs={[{ label: "Home", to: "/app", current: true }]}
      showBackToHome={false}
      actions={<Link to="/app/proposals" className="button button-primary">Open proposals <ArrowUpRight size={17} /></Link>}
    />
    <div className="stat-grid">
      {cardSpecs.map(([key, title, Icon, to], index) => <Link className="stat-card" to={to} key={key}><span className={`stat-icon stat-tone-${index}`}><Icon size={19} /></span><span className="stat-label">{title}</span><strong>{data.totals[key] ?? 0}</strong><span className="stat-link">View records <ArrowUpRight size={14} /></span></Link>)}
      <Link className="stat-card" to="/app/researchers"><span className="stat-icon stat-tone-4"><Users size={19} /></span><span className="stat-label">Researcher profiles</span><strong>{data.totals.researchers || 0}</strong><span className="stat-link">View researchers <ArrowUpRight size={14} /></span></Link>
    </div>
    <div className="dashboard-grid">
      <section className="panel chart-panel"><div className="panel-heading"><div><h3>Proposal pipeline</h3><p className="muted">Distribution by current status</p></div><Link to="/app/proposals" className="subtle-link">All proposals <ArrowUpRight size={14} /></Link></div>
        {chartData.length ? <div className="chart-wrap"><ResponsiveContainer width="100%" height={240}><PieChart><Pie data={chartData} dataKey="value" nameKey="name" innerRadius={66} outerRadius={94} paddingAngle={3}>{chartData.map((entry, index) => <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer><div className="chart-legend">{chartData.map((entry, index) => <span key={entry.name}><i style={{ background: COLORS[index % COLORS.length] }} />{entry.name}<b>{entry.value}</b></span>)}</div></div> : <div className="empty-chart"><span>No proposal activity yet</span><Link to="/app/proposals">Create your first proposal</Link></div>}
      </section>
      <section className="panel activity-panel"><div className="panel-heading"><div><h3>Recent activity</h3><p className="muted">Latest workspace updates</p></div></div>
        {data.recentActivity.length ? <div className="activity-list">{data.recentActivity.map((item) => <div className="activity-item" key={item._id}><span className="activity-mark"><FileCheck2 size={15} /></span><div><b>{item.action?.replaceAll(".", " ")}</b><p>{item.createdBy?.name || "System"} · {item.targetType || "record"}</p></div><time>{new Date(item.createdAt).toLocaleDateString()}</time></div>)}</div> : <div className="empty-state">Activity will appear here as records are created and reviewed.</div>}
      </section>
    </div>
  </div>;
}
