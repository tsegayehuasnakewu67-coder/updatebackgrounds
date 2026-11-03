import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  RefreshCw,
  UserRoundX,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuth } from '../../context/AuthContext';
import { attendanceService } from '../../services/attendanceService';
import { leaveService } from '../../services/leaveService';
import { getRequestErrorMessage, getRetryDelaySeconds } from '../../services/requestErrors';
import { formatEthiopianDate, getAddisAbabaDateString } from '../../utils/ethiopianDateTime';
import './HRDashboard.css';

const NUMBER_FORMAT = new Intl.NumberFormat();
const TREND_COLORS = { Present: '#20A875', Late: '#E99A36', Absent: '#D9545D' };

const QUICK_LINKS = [
  {
    to: '/hr/employees',
    title: 'Employee Directory',
    text: 'Search employee records, review employee details, and view department assignments.',
    action: 'View Employees',
    icon: Users,
    tone: 'blue',
  },
  {
    to: '/hr/reports',
    title: 'Attendance Reports',
    text: 'Review attendance activity, analyze workforce trends, and export authorized reports.',
    action: 'View Reports',
    icon: ClipboardList,
    tone: 'green',
  },
  {
    to: '/hr/leaves',
    title: 'Leave Reviews',
    text: 'Review pending leave requests, examine request details, and record authorized decisions.',
    action: 'Review Requests',
    icon: CalendarDays,
    tone: 'sky',
  },
];

export default function HRDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [pendingLeaveCount, setPendingLeaveCount] = useState(null);
  const [leaveError, setLeaveError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryAt, setRetryAt] = useState(0);
  const [clock, setClock] = useState(Date.now());
  const inFlight = useRef(false);
  const retryAtRef = useRef(0);
  const retryAttempt = useRef(0);

  const loadDashboard = useCallback(async () => {
    if (inFlight.current || Date.now() < retryAtRef.current) return;
    inFlight.current = true;
    setLoading(true);
    setError('');
    setLeaveError('');
    try {
      const [dashboardResult, leaveResult] = await Promise.allSettled([
        attendanceService.getDashboard(),
        leaveService.list({ status: 'pending' }),
      ]);

      if (dashboardResult.status === 'fulfilled') {
        const dashboard = dashboardResult.value;
        if (!dashboard?.summary || typeof dashboard.summary !== 'object') {
          setError('The workforce summary was incomplete. Please try again.');
        } else {
          setData(dashboard);
        }
      } else {
        setError(getRequestErrorMessage(dashboardResult.reason, 'Attendance data'));
      }

      if (leaveResult.status === 'fulfilled' && Array.isArray(leaveResult.value)) {
        setPendingLeaveCount(leaveResult.value.length);
      } else if (leaveResult.status === 'rejected') {
        setLeaveError(getRequestErrorMessage(leaveResult.reason, 'Pending leave requests'));
      } else {
        setLeaveError('The pending leave response was incomplete.');
      }

      const rateLimitedRequest = [dashboardResult, leaveResult]
        .find(result => result.status === 'rejected' && result.reason?.response?.status === 429);
      if (rateLimitedRequest) {
        const delaySeconds = getRetryDelaySeconds(rateLimitedRequest.reason, retryAttempt.current);
        retryAttempt.current += 1;
        retryAtRef.current = Date.now() + delaySeconds * 1000;
        setRetryAt(retryAtRef.current);
      } else {
        retryAttempt.current = 0;
        retryAtRef.current = 0;
        setRetryAt(0);
      }
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (!retryAt || retryAt <= Date.now()) return undefined;
    const timer = window.setInterval(() => {
      const now = Date.now();
      setClock(now);
      if (now >= retryAt) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [retryAt]);

  const retrySeconds = Math.max(0, Math.ceil((retryAt - clock) / 1000));

  if (loading && !data) return <DashboardLoading />;
  if (error && !data) {
    return (
      <DashboardError
        message={error}
        onRetry={loadDashboard}
        loading={loading}
        retrySeconds={retrySeconds}
      />
    );
  }

  const summary = data?.summary || {};
  const counts = [
    { label: 'Total Employees', value: summary.totalEmployees, detail: 'Active workforce', icon: Users, tone: 'blue' },
    { label: 'Present Today', value: summary.presentToday, detail: 'Checked in on time', icon: CheckCircle2, tone: 'green' },
    { label: 'Late Today', value: summary.lateToday, detail: 'Checked in after start', icon: Clock3, tone: 'amber' },
    { label: 'Absent Today', value: summary.absentToday, detail: 'Per attendance rules', icon: UserRoundX, tone: 'red' },
  ];
  const weeklyRecords = Array.isArray(data?.weeklyTrend) ? data.weeklyTrend : [];
  const trendData = getLastSevenDays(weeklyRecords);
  const departmentData = Array.isArray(data?.deptStats) ? data.deptStats : [];
  const displayName = user?.fullName?.trim().split(/\s+/)[0];
  const today = getAddisAbabaDateString();

  return (
    <main className="hr-dashboard" aria-busy={loading}>
      <header className="hr-dashboard-heading">
        <div>
          <p className="hr-dashboard-eyebrow">HUMAN RESOURCES · SMART WORKFORCE</p>
          <h1>Workforce Overview</h1>
          <p className="hr-dashboard-intro">
            Monitor employee attendance, manage workforce records, and review leave requests.
          </p>
        </div>
        <div className="hr-dashboard-heading-meta">
          {displayName && <span className="hr-welcome">Welcome back, {displayName}</span>}
          <span className="hr-current-date">
            <CalendarDays size={16} aria-hidden="true" />
            {formatEthiopianDate(today, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
          <button className="hr-refresh-button" onClick={loadDashboard} type="button" disabled={loading || retrySeconds > 0}>
            <RefreshCw size={15} aria-hidden="true" className={loading ? 'is-spinning' : ''} />
            {loading ? 'Refreshing' : retrySeconds > 0 ? `Retry in ${retrySeconds}s` : 'Refresh'}
          </button>
        </div>
      </header>

      {error && <div className="hr-inline-error" role="alert">{error}</div>}

      <section className="hr-kpi-grid" aria-label="Today's attendance summary">
        {counts.map(metric => (
          <KpiCard
            key={metric.label}
            {...metric}
            value={metric.value}
            loading={loading}
          />
        ))}
      </section>

      <section className="hr-quick-links" aria-label="HR workspace">
        {QUICK_LINKS.map(({ to, title, text, action, icon: Icon, tone }) => (
          <Link className={`hr-quick-card hr-quick-${tone}`} key={to} to={to}>
            <span className="hr-quick-icon"><Icon size={20} aria-hidden="true" /></span>
            <h2>{title}</h2>
            <p>{text}</p>
            <span className="hr-quick-action">{action}<ArrowRight size={16} aria-hidden="true" /></span>
          </Link>
        ))}
      </section>

      <section className="hr-insights-grid" aria-label="Workforce insights">
        <article className="hr-panel hr-trend-panel">
          <PanelHeading
            icon={BarChart3}
            eyebrow="LAST 7 DAYS"
            title="Attendance activity"
            description="Recorded attendance by day"
          />
          {weeklyRecords.length === 0 ? (
            <EmptyState message="There are no attendance records for this week yet." />
          ) : (
            <>
              <div className="hr-chart-legend" aria-label="Chart legend">
                {Object.entries(TREND_COLORS).map(([label, color]) => (
                  <span key={label}><i style={{ backgroundColor: color }} />{label}</span>
                ))}
              </div>
              <div className="hr-trend-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trendData} margin={{ top: 8, right: 4, left: -20, bottom: 0 }} barGap={2}>
                    <CartesianGrid vertical={false} stroke="#E9EEF5" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#718096', fontSize: 10 }}
                      tickFormatter={formatDayTick}
                      minTickGap={14}
                    />
                    <YAxis
                      allowDecimals={false}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#718096', fontSize: 10 }}
                      width={38}
                    />
                    <Tooltip
                      contentStyle={{ border: '1px solid #E1E8F0', borderRadius: 10, boxShadow: '0 8px 24px rgba(22, 42, 74, .12)' }}
                      labelFormatter={value => formatEthiopianDate(value, { month: 'short', day: 'numeric' })}
                      formatter={(value, name) => [NUMBER_FORMAT.format(value), name]}
                      cursor={{ fill: 'rgba(35, 70, 155, .06)' }}
                    />
                    <Bar dataKey="present" name="Present" fill={TREND_COLORS.Present} radius={[3, 3, 0, 0]} maxBarSize={16} />
                    <Bar dataKey="late" name="Late" fill={TREND_COLORS.Late} radius={[3, 3, 0, 0]} maxBarSize={16} />
                    <Bar dataKey="absent" name="Absent" fill={TREND_COLORS.Absent} radius={[3, 3, 0, 0]} maxBarSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="hr-chart-note">Absence trend counts records explicitly marked Absent.</p>
            </>
          )}
        </article>

        <article className="hr-panel hr-department-panel">
          <PanelHeading
            icon={Users}
            eyebrow="TODAY"
            title="Department summary"
            description="Recorded attendance grouped by department"
          />
          {departmentData.length === 0 ? (
            <EmptyState message="No department attendance records are available today." />
          ) : (
            <div className="hr-department-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={departmentData} layout="vertical" margin={{ top: 2, right: 16, left: 4, bottom: 2 }}>
                  <CartesianGrid horizontal={false} stroke="#E9EEF5" strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#718096', fontSize: 10 }} />
                  <YAxis dataKey="_id" type="category" width={105} axisLine={false} tickLine={false} tick={{ fill: '#536177', fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ border: '1px solid #E1E8F0', borderRadius: 10, boxShadow: '0 8px 24px rgba(22, 42, 74, .12)' }}
                    formatter={value => [NUMBER_FORMAT.format(value), 'Attendance records']}
                  />
                  <Bar dataKey="count" name="Attendance records" fill="#23469B" radius={[0, 5, 5, 0]} maxBarSize={19} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </article>

        <Link className="hr-panel hr-leave-insight" to="/hr/leaves">
          <span className="hr-leave-icon"><CalendarDays size={19} aria-hidden="true" /></span>
          <span className="hr-leave-copy">
            <span className="hr-panel-eyebrow">LEAVE MANAGEMENT</span>
            <strong>Pending leave requests</strong>
            <small>{pendingLeaveCount === null ? 'Review the leave queue for updates' : `${pendingLeaveCount === 1 ? 'Request' : 'Requests'} awaiting review`}</small>
          </span>
          <strong className="hr-leave-count">
            {pendingLeaveCount === null ? <ArrowRight size={19} aria-label="Open leave reviews" /> : NUMBER_FORMAT.format(pendingLeaveCount)}
          </strong>
          {leaveError && <span className="hr-leave-error" role="status">{leaveError}</span>}
        </Link>
      </section>
    </main>
  );
}

function KpiCard({ label, value, detail, icon: Icon, tone, loading }) {
  return (
    <article className={`hr-kpi-card hr-kpi-${tone}`} aria-busy={loading}>
      <div className="hr-kpi-top">
        <span>{label}</span>
        <span className="hr-kpi-icon"><Icon size={19} aria-hidden="true" /></span>
      </div>
      {loading ? (
        <span className="hr-kpi-skeleton" aria-label={`Loading ${label.toLowerCase()}`} />
      ) : (
        <strong className="hr-kpi-value">{formatCount(value)}</strong>
      )}
      <span className="hr-kpi-detail">{detail}</span>
    </article>
  );
}

function formatCount(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
  return NUMBER_FORMAT.format(Number(value));
}

function PanelHeading({ icon: Icon, eyebrow, title, description }) {
  return (
    <div className="hr-panel-heading">
      <span className="hr-panel-icon"><Icon size={17} aria-hidden="true" /></span>
      <div>
        <span className="hr-panel-eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="hr-empty-state">
      <BarChart3 size={22} aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}

function DashboardLoading() {
  return (
    <main className="hr-dashboard hr-dashboard-loading" aria-busy="true" aria-label="Loading workforce overview">
      <span className="hr-loading-spinner" />
      <p>Loading workforce overview…</p>
      <div className="hr-kpi-grid" aria-hidden="true">
        {[1, 2, 3, 4].map(item => <span className="hr-loading-card" key={item} />)}
      </div>
    </main>
  );
}

function DashboardError({ message, onRetry, loading, retrySeconds }) {
  return (
    <main className="hr-dashboard">
      <section className="hr-error-state" role="alert">
        <h1>Workforce data is unavailable</h1>
        <p>{message}</p>
        <button className="hr-refresh-button" onClick={onRetry} type="button" disabled={loading || retrySeconds > 0}>
          <RefreshCw size={15} aria-hidden="true" className={loading ? 'is-spinning' : ''} />
          {loading ? 'Retrying' : retrySeconds > 0 ? `Retry in ${retrySeconds}s` : 'Try again'}
        </button>
      </section>
    </main>
  );
}

function getLastSevenDays(monthlyTrend) {
  const byDate = new Map(monthlyTrend.map(item => [item._id, item]));
  const today = getAddisAbabaDateString();
  const [year, month, day] = today.split('-').map(Number);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1, day - (6 - index))).toISOString().slice(0, 10);
    const record = byDate.get(date) || {};
    return {
      date,
      present: Number(record.present) || 0,
      late: Number(record.late) || 0,
      absent: Number(record.absent) || 0,
    };
  });
}

function formatDayTick(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? String(Number(value.slice(-2)))
    : value;
}
