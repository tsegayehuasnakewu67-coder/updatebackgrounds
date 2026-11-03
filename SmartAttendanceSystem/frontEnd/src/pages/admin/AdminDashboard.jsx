import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Clock3,
  FileText,
  RefreshCw,
  UserCheck,
  UserPlus,
  UserRoundX,
  Users,
} from 'lucide-react';
import { attendanceService } from '../../services/attendanceService';
import { formatEthiopianDate, formatEthiopianTime, getAddisAbabaDateString } from '../../utils/ethiopianDateTime';
import './AdminDashboard.css';

const STATUS_COLORS = {
  Present: '#20A875',
  Late: '#E99A36',
  Absent: '#D9545D',
  Leave: '#5576B8',
};

const NUMBER_FORMAT = new Intl.NumberFormat();

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(() => getAddisAbabaDateString().slice(0, 7));
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const requestId = useRef(0);

  const loadDashboard = useCallback(async () => {
    const currentRequestId = ++requestId.current;
    setLoading(true);
    setError('');
    try {
      const result = await attendanceService.getDashboard({ month: selectedMonth });
      if (currentRequestId !== requestId.current) return;
      if (!result?.summary || typeof result.summary !== 'object') {
        throw new Error('The dashboard response was incomplete. Please try again.');
      }
      setData(result);
    } catch (requestError) {
      if (currentRequestId === requestId.current) {
        setError(requestError?.response?.data?.message || requestError.message || 'Unable to load dashboard data.');
      }
    } finally {
      if (currentRequestId === requestId.current) setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    loadDashboard();
    return () => { requestId.current += 1; };
  }, [loadDashboard]);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  if (loading) return <DashboardLoading />;
  if (error) return <DashboardError message={error} onRetry={loadDashboard} />;

  const summary = data.summary || {};
  const recentCheckIns = Array.isArray(data.recentCheckIns) ? data.recentCheckIns : [];
  const monthlyTrend = Array.isArray(data.monthlyTrend) ? data.monthlyTrend : [];
  const deptStats = Array.isArray(data.deptStats) ? data.deptStats : [];
  const counts = {
    total: Number(summary.totalEmployees) || 0,
    present: Number(summary.presentToday) || 0,
    late: Number(summary.lateToday) || 0,
    absent: Number(summary.absentToday) || 0,
    leave: Number(summary.leaveToday) || 0,
  };
  const donutTotal = counts.total;
  const chartData = monthlyTrend.map(item => ({
    ...item,
    date: item._id,
    present: Number(item.present) || 0,
    late: Number(item.late) || 0,
    absent: Number(item.absent) || 0,
  }));
  const monthLabel = formatEthiopianDate(
    `${selectedMonth}-01`,
    { month: 'long', year: 'numeric' },
  );

  return (
    <main className="admin-dashboard" aria-busy={false}>
      <header className="admin-dashboard-heading">
        <div>
          <p className="admin-dashboard-eyebrow">MEKDELA AMBA UNIVERSITY · SMART WORKFORCE</p>
          <h1>MAU Admin Control Center</h1>
          <p className="admin-dashboard-intro">
            Manage employees, monitor attendance, oversee departments, and generate accurate workforce reports.
          </p>
        </div>
        <div className="admin-dashboard-heading-meta">
          <span className="admin-current-date">
            <CalendarDays size={16} aria-hidden="true" />
            <span>
              {formatEthiopianDate(currentTime, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
              <small>{formatEthiopianTime(currentTime)}</small>
            </span>
          </span>
          <button className="admin-refresh-button" onClick={loadDashboard} type="button">
            <RefreshCw size={15} aria-hidden="true" /> Refresh
          </button>
        </div>
      </header>

      <section className="admin-kpi-grid" aria-label="Today's attendance summary">
        <KpiCard label="Total Employees" value={counts.total} icon={Users} tone="blue" detail="Active workforce" />
        <KpiCard label="Present Today" value={counts.present} icon={UserCheck} tone="green" detail="Checked in on time" />
        <KpiCard label="Late Today" value={counts.late} icon={Clock3} tone="amber" detail="Checked in late" />
        <KpiCard label="Absent Today" value={counts.absent} icon={UserRoundX} tone="red" detail="No check-in recorded" />
      </section>

      <section className="admin-chart-grid" aria-label="Attendance charts">
        <article className="admin-panel admin-trend-panel">
          <div className="admin-chart-heading-row">
            <PanelHeading
              icon={BarChart3}
              eyebrow={monthLabel}
              title="Monthly attendance trend"
              description="Attendance records grouped by day"
            />
            <label className="admin-month-picker">
              <span className="sr-only">Choose attendance month</span>
              <input
                aria-label="Attendance trend month"
                type="month"
                value={selectedMonth}
                onChange={event => setSelectedMonth(event.target.value)}
              />
            </label>
          </div>
          {chartData.length === 0 ? (
            <EmptyChart message="No attendance records are available for this month yet." />
          ) : (
            <>
              <div className="admin-chart-legend" aria-label="Chart legend">
                <LegendItem color={STATUS_COLORS.Present} label="Present" />
                <LegendItem color={STATUS_COLORS.Late} label="Late" />
                <LegendItem color={STATUS_COLORS.Absent} label="Absent" />
              </div>
              <div className="admin-trend-chart" role="img" aria-label={`Monthly attendance records for ${monthLabel}`}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 8, left: -18, bottom: 2 }} barGap={2}>
                    <CartesianGrid vertical={false} stroke="#E9EEF5" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#718096', fontSize: 11 }}
                      tickFormatter={formatDayTick}
                      interval={Math.max(0, Math.ceil(chartData.length / 8) - 1)}
                      minTickGap={20}
                    />
                    <YAxis
                      allowDecimals={false}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#718096', fontSize: 11 }}
                      width={38}
                      label={{ value: 'Records', angle: -90, position: 'insideLeft', fill: '#718096', fontSize: 10 }}
                    />
                    <Tooltip
                      contentStyle={{ border: '1px solid #E1E8F0', borderRadius: 10, boxShadow: '0 8px 24px rgba(22, 42, 74, .12)' }}
                      labelFormatter={formatChartDate}
                      formatter={(value, name) => [NUMBER_FORMAT.format(value), name]}
                      cursor={{ fill: 'rgba(35, 70, 155, .06)' }}
                    />
                    <Bar dataKey="present" name="Present" fill={STATUS_COLORS.Present} radius={[3, 3, 0, 0]} maxBarSize={18} />
                    <Bar dataKey="late" name="Late" fill={STATUS_COLORS.Late} radius={[3, 3, 0, 0]} maxBarSize={18} />
                    <Bar dataKey="absent" name="Absent" fill={STATUS_COLORS.Absent} radius={[3, 3, 0, 0]} maxBarSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="admin-chart-footnote">Absent trend includes records explicitly marked Absent.</p>
            </>
          )}
        </article>

        <article className="admin-panel admin-breakdown-panel">
          <PanelHeading
            icon={UserCheck}
            eyebrow="TODAY"
            title="Attendance breakdown"
            description="Active workforce status summary"
          />
          <div className="admin-donut-layout">
            <div className="admin-donut-wrap">
              {donutTotal > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Present', value: counts.present },
                        { name: 'Late', value: counts.late },
                        { name: 'Absent', value: counts.absent },
                        { name: 'On leave', value: counts.leave },
                      ]}
                      dataKey="value"
                      nameKey="name"
                      innerRadius="68%"
                      outerRadius="88%"
                      paddingAngle={2}
                      stroke="none"
                    >
                      {[STATUS_COLORS.Present, STATUS_COLORS.Late, STATUS_COLORS.Absent, STATUS_COLORS.Leave].map(color => (
                        <Cell key={color} fill={color} />
                      ))}
                    </Pie>
                    <Tooltip content={<DonutTooltip total={donutTotal} />} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="admin-donut-empty" aria-label="No attendance summary available">
                  <span>No records</span>
                </div>
              )}
              <div className="admin-donut-center" aria-live="polite">
                <strong>{NUMBER_FORMAT.format(donutTotal)}</strong>
                <span>employees</span>
              </div>
            </div>
            <div className="admin-donut-legend">
              <BreakdownItem label="Present" value={counts.present} total={donutTotal} color={STATUS_COLORS.Present} />
              <BreakdownItem label="Late" value={counts.late} total={donutTotal} color={STATUS_COLORS.Late} />
              <BreakdownItem label="Absent" value={counts.absent} total={donutTotal} color={STATUS_COLORS.Absent} />
              <BreakdownItem label="On leave" value={counts.leave} total={donutTotal} color={STATUS_COLORS.Leave} />
            </div>
          </div>
          <p className="admin-chart-footnote">Percentages are calculated from the total active workforce.</p>
        </article>
      </section>

      <section className="admin-detail-grid" aria-label="Department and recent attendance">
        <article className="admin-panel admin-department-panel">
          <PanelHeading
            icon={Users}
            eyebrow="TODAY"
            title="Attendance by department"
            description="Recorded attendance grouped by department"
          />
          {deptStats.length === 0 ? (
            <EmptyChart message="No department attendance records are available today." />
          ) : (
            <div className="admin-department-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deptStats} layout="vertical" margin={{ top: 2, right: 18, left: 6, bottom: 2 }}>
                  <CartesianGrid horizontal={false} stroke="#E9EEF5" strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#718096', fontSize: 10 }} />
                  <YAxis
                    dataKey="_id"
                    type="category"
                    width={116}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#536177', fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{ border: '1px solid #E1E8F0', borderRadius: 10, boxShadow: '0 8px 24px rgba(22, 42, 74, .12)' }}
                    formatter={value => [NUMBER_FORMAT.format(value), 'Attendance records']}
                  />
                  <Bar dataKey="count" name="Attendance records" fill="#23469B" radius={[0, 5, 5, 0]} maxBarSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </article>

        <article className="admin-panel admin-recent-panel">
          <div className="admin-recent-heading">
            <PanelHeading
              icon={Clock3}
              eyebrow="LATEST ACTIVITY"
              title="Recent check-ins"
              description="Today's latest attendance records"
            />
            <Link className="admin-text-link" to="/admin/reports" aria-label="View attendance reports">
              View reports <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
          {recentCheckIns.length === 0 ? (
            <EmptyChart message="No check-ins have been recorded today." />
          ) : (
            <ul className="admin-checkin-list">
              {recentCheckIns.map((record, index) => (
                <li className="admin-checkin-row" key={record._id || `${record.employeeId}-${index}`}>
                  <span className="admin-checkin-avatar" aria-hidden="true">{getInitials(record.fullName)}</span>
                  <span className="admin-checkin-person">
                    <strong>{record.fullName || 'Employee'}</strong>
                    <small>{record.department || 'Department not specified'}</small>
                  </span>
                  <span className="admin-checkin-time">{formatEthiopianTime(record.checkInTime)}</span>
                  <StatusBadge status={record.status} />
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      <section className="admin-quick-actions" aria-labelledby="admin-quick-actions-title">
        <div>
          <h2 id="admin-quick-actions-title">Quick actions</h2>
          <p>Common workforce administration tasks</p>
        </div>
        <div className="admin-quick-action-links">
          <Link to="/admin/register"><UserPlus size={17} aria-hidden="true" />Register employee</Link>
          <Link to="/admin/register-hr"><Users size={17} aria-hidden="true" />Register HR account</Link>
          <Link to="/admin/reports"><FileText size={17} aria-hidden="true" />Generate report</Link>
        </div>
      </section>
    </main>
  );
}

function KpiCard({ label, value, icon: Icon, tone, detail }) {
  return (
    <article className={`admin-kpi-card admin-kpi-${tone}`}>
      <div className="admin-kpi-top">
        <span>{label}</span>
        <span className="admin-kpi-icon"><Icon size={19} aria-hidden="true" /></span>
      </div>
      <strong className="admin-kpi-value">{NUMBER_FORMAT.format(value)}</strong>
      <span className="admin-kpi-detail">{detail}</span>
    </article>
  );
}

function PanelHeading({ icon: Icon, eyebrow, title, description }) {
  return (
    <div className="admin-panel-heading">
      <span className="admin-panel-icon"><Icon size={17} aria-hidden="true" /></span>
      <div>
        <span className="admin-panel-eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </div>
  );
}

function LegendItem({ color, label }) {
  return <span className="admin-chart-legend-item"><i style={{ backgroundColor: color }} />{label}</span>;
}

function BreakdownItem({ label, value, total, color }) {
  const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="admin-breakdown-item">
      <span className="admin-breakdown-label"><i style={{ backgroundColor: color }} />{label}</span>
      <strong>{NUMBER_FORMAT.format(value)}</strong>
      <span className="admin-breakdown-percent">{percentage}%</span>
    </div>
  );
}

function DonutTooltip({ active, payload, total }) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="admin-chart-tooltip">
      <strong>{name}</strong>
      <span>{NUMBER_FORMAT.format(value)} employees · {percentage}%</span>
    </div>
  );
}

function StatusBadge({ status }) {
  const knownStatus = ['Present', 'Late', 'Absent'].includes(status) ? status : 'Other';
  return <span className={`admin-status-badge admin-status-${knownStatus.toLowerCase()}`}>{status || 'Recorded'}</span>;
}

function EmptyChart({ message }) {
  return <div className="admin-empty-state"><BarChart3 size={22} aria-hidden="true" /><p>{message}</p></div>;
}

function DashboardLoading() {
  return (
    <main className="admin-dashboard admin-dashboard-loading" aria-busy="true" aria-label="Loading dashboard">
      <span className="admin-loading-spinner" />
      <p>Loading workforce data…</p>
    </main>
  );
}

function DashboardError({ message, onRetry }) {
  return (
    <main className="admin-dashboard">
      <section className="admin-error-state" role="alert">
        <h1>Dashboard data is unavailable</h1>
        <p>{message}</p>
        <button className="admin-refresh-button" onClick={onRetry} type="button">
          <RefreshCw size={15} aria-hidden="true" />Try again
        </button>
      </section>
    </main>
  );
}

function formatDayTick(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return String(Number(value.slice(-2)));
}

function formatChartDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return formatEthiopianDate(value, { month: 'short', day: 'numeric' });
}

function getInitials(value) {
  return value?.trim()?.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'U';
}
