import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import Shell from "./components/Shell.jsx";
import Landing from "./pages/Landing.jsx";
import AuthPage from "./pages/AuthPage.jsx";
const Dashboard = lazy(() => import("./pages/Dashboard.jsx"));
const ResourcePage = lazy(() => import("./pages/ResourcePage.jsx"));
const Documents = lazy(() => import("./pages/Documents.jsx"));
const Reports = lazy(() => import("./pages/Reports.jsx"));
const Users = lazy(() => import("./pages/Users.jsx"));
const Profile = lazy(() => import("./pages/Profile.jsx"));
const WorkflowSettings = lazy(() => import("./pages/WorkflowSettings.jsx"));

function Page({ children }) {
  return <Suspense fallback={<div className="loading-card">Loading section…</div>}>{children}</Suspense>;
}

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen">Loading MAU-RIMS…</div>;
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<AuthPage />} />
      <Route path="/register" element={<AuthPage register />} />
      <Route path="/forgot-password" element={<AuthPage mode="forgot" />} />
      <Route path="/reset-password" element={<AuthPage mode="reset" />} />
      <Route path="/app" element={<Protected><Shell /></Protected>}>
        <Route index element={<Page><Dashboard /></Page>} />
        <Route path="documents" element={<Page><Documents /></Page>} />
        <Route path="reports" element={<Page><Reports /></Page>} />
        <Route path="users" element={<Page><Users /></Page>} />
        <Route path="profile" element={<Page><Profile /></Page>} />
        <Route path="workflow" element={<Page><WorkflowSettings /></Page>} />
        <Route path=":resource" element={<Page><ResourcePage /></Page>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
