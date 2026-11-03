import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { Bell, BookOpen, Building2, ChartNoAxesCombined, ClipboardList, FileText, FolderKanban, LayoutDashboard, LogOut, Menu, UserRound, Users } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";

const navItems = [
  { to: "/app", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/app/proposals", label: "Proposals", icon: ClipboardList },
  { to: "/app/projects", label: "Projects", icon: FolderKanban },
  { to: "/app/researchers", label: "Researchers", icon: Users },
  { to: "/app/publications", label: "Publications", icon: BookOpen },
  { to: "/app/ethicsApplications", label: "Ethics review", icon: FileText },
  { to: "/app/budgets", label: "Budgets", icon: ChartNoAxesCombined, roles: ["super_admin", "directorate_admin", "research_coordinator", "finance_officer", "management"] },
  { to: "/app/campuses", label: "Campuses", icon: Building2 },
  { to: "/app/colleges", label: "Colleges", icon: Building2 },
  { to: "/app/departments", label: "Departments", icon: Building2 },
  { to: "/app/researchAreas", label: "Research areas", icon: BookOpen },
  { to: "/app/documents", label: "Documents", icon: FileText },
  { to: "/app/reports", label: "Reports", icon: ChartNoAxesCombined, roles: ["super_admin", "directorate_admin", "research_coordinator", "management", "finance_officer"] },
  { to: "/app/workflow", label: "Workflow settings", icon: ClipboardList, roles: ["super_admin"] },
  { to: "/app/progressReports", label: "Progress reports", icon: ClipboardList },
  { to: "/app/milestones", label: "Milestones", icon: ClipboardList },
  { to: "/app/expenditures", label: "Expenditures", icon: ChartNoAxesCombined, roles: ["super_admin", "directorate_admin", "research_coordinator", "finance_officer", "management"] },
  { to: "/app/collaborations", label: "Collaborations", icon: Users },
  { to: "/app/notifications", label: "Notifications", icon: Bell }
];

export default function Shell() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  async function signOut() {
    await logout();
    navigate("/");
  }
  return (
    <div className="app-shell">
      {open && <button className="mobile-backdrop" aria-label="Close menu" onClick={() => setOpen(false)} />}
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <Link to="/app" className="brand"><span className="brand-mark">M</span><span><b>MAU-RIMS</b><small>Research management</small></span></Link>
        <div className="side-label">WORKSPACE</div>
        <nav className="side-nav">
          {navItems.filter((item) => !item.roles || item.roles.includes(user?.role)).map(({ to, label, icon: Icon, exact }) => <NavLink key={to} to={to} end={exact} onClick={() => setOpen(false)} className={({ isActive }) => `nav-link ${isActive ? "nav-active" : ""}`}><Icon size={18} /><span>{label}</span></NavLink>)}
          {["super_admin", "directorate_admin"].includes(user?.role) && <NavLink to="/app/users" onClick={() => setOpen(false)} className={({ isActive }) => `nav-link ${isActive ? "nav-active" : ""}`}><Users size={18} /><span>User management</span></NavLink>}
        </nav>
        <div className="sidebar-bottom">
          <div className="user-chip"><span className="avatar">{user?.name?.slice(0, 1).toUpperCase()}</span><div className="user-meta"><b>{user?.name}</b><small>{user?.role?.replaceAll("_", " ")}</small></div></div>
          <NavLink to="/app/profile" onClick={() => setOpen(false)} className={({ isActive }) => `nav-link ${isActive ? "nav-active" : ""}`}><UserRound size={18} /><span>My profile</span></NavLink>
          <button className="nav-link signout" onClick={signOut}><LogOut size={18} /><span>Sign out</span></button>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={21} /></button>
          <div><span className="eyebrow">MEKDELA AMBA UNIVERSITY</span><h1>Research Information Management</h1></div>
          <Link className="top-user" to="/app/notifications"><Bell size={18} /><span>Notifications</span></Link>
        </header>
        <section className="page-content"><Outlet /></section>
      </main>
    </div>
  );
}
