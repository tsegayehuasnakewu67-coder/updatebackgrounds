import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, RefreshCw, ShieldCheck } from 'lucide-react';
import api from '../../services/api';
import './AdminAuditLogs.css';

const RESOURCE_TYPES = ['user', 'attendance', 'leave', 'shift_settings', 'system'];

export default function AdminAuditLogs() {
  const [filters, setFilters] = useState({ action: '', resourceType: '', from: '', to: '' });
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [events, setEvents] = useState([]);
  const [eventSource, setEventSource] = useState('audit');
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadEvents = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const params = { page, limit: 25 };
      Object.entries(appliedFilters).forEach(([key, value]) => {
        if (eventSource === 'face-scans' && !['from', 'to'].includes(key)) return;
        if (value) params[key] = value;
      });
      const endpoint = eventSource === 'face-scans'
        ? '/admin/audit-logs/face-scans'
        : '/admin/audit-logs';
      const response = await api.get(endpoint, { params });
      setEvents(response.data?.data?.events || []);
      setPagination(response.data?.data?.pagination || { page, total: 0, totalPages: 0 });
    } catch (requestError) {
      setError(requestError.message || 'Unable to load security audit events.');
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, eventSource]);

  useEffect(() => { loadEvents(1); }, [loadEvents]);

  const applyFilters = event => {
    event.preventDefault();
    setAppliedFilters(filters);
  };

  return (
    <main className="admin-audit-page" aria-busy={loading}>
      <header className="admin-audit-heading">
        <span className="admin-audit-heading-icon"><ShieldCheck size={22} aria-hidden="true" /></span>
        <div>
          <p>ADMINISTRATION · SECURITY</p>
          <h1>Security &amp; Audit Logs</h1>
          <span>Review account, attendance, leave, and system changes recorded by the server.</span>
        </div>
        <button type="button" onClick={() => loadEvents(pagination.page)} disabled={loading}>
          <RefreshCw size={15} aria-hidden="true" className={loading ? 'admin-audit-spin' : ''} />
          Refresh
        </button>
      </header>

      <div className="admin-audit-source" role="group" aria-label="Security event source">
        <button type="button" className={eventSource === 'audit' ? 'is-active' : ''} onClick={() => setEventSource('audit')}>Administrative audit events</button>
        <button type="button" className={eventSource === 'face-scans' ? 'is-active' : ''} onClick={() => setEventSource('face-scans')}>Face verification failures</button>
      </div>

      <form className="admin-audit-filters" onSubmit={applyFilters}>
        {eventSource === 'audit' && <>
        <label>
          Action
          <input
            value={filters.action}
            onChange={event => setFilters(current => ({ ...current, action: event.target.value }))}
            placeholder="e.g. USER_DEACTIVATED"
            maxLength={80}
          />
        </label>
        <label>
          Resource
          <select value={filters.resourceType} onChange={event => setFilters(current => ({ ...current, resourceType: event.target.value }))}>
            <option value="">All resources</option>
            {RESOURCE_TYPES.map(type => <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>)}
          </select>
        </label>
        </>}
        <label>
          From
          <input type="date" value={filters.from} onChange={event => setFilters(current => ({ ...current, from: event.target.value }))} />
        </label>
        <label>
          To
          <input type="date" value={filters.to} onChange={event => setFilters(current => ({ ...current, to: event.target.value }))} />
        </label>
        <button type="submit" disabled={loading}>Apply filters</button>
      </form>

      {error && <div className="admin-audit-error" role="alert"><AlertCircle size={17} />{error}</div>}

      <section className="admin-audit-panel" aria-label="Audit events">
        <div className="admin-audit-panel-heading">
          <div><h2>Activity history</h2><p>          {pagination.total.toLocaleString()} {eventSource === 'face-scans' ? 'attempts' : 'events'}</p></div>
          <span>Page {pagination.page || 1} of {pagination.totalPages || 1}</span>
        </div>
        {loading && events.length === 0 ? (
          <p className="admin-audit-state" role="status">Loading audit events…</p>
        ) : events.length === 0 ? (
          <p className="admin-audit-state">No audit events match these filters.</p>
        ) : (
          <div className="admin-audit-table-scroll">
            <table className="admin-audit-table">
              <thead><tr><th>Time</th><th>Action</th><th>Actor</th><th>Resource</th><th>Activity details</th></tr></thead>
              <tbody>
                {events.map(event => (
                  <tr key={event._id}>
                    <td>{new Date(event.createdAt).toLocaleString()}</td>
                    <td><span className="admin-audit-action">{event.action}</span></td>
                    <td>{event.actor?.fullName || (event.actorRole === 'system' ? 'Public / system' : 'Deleted account')}<small>{event.actor?.employeeId || event.actorRole}</small></td>
                    <td>{event.resourceType.replaceAll('_', ' ')}<small>{event.resourceId || '—'}</small></td>
                    <td><span className="admin-audit-summary">{event.summary}</span><details><summary>View safe details</summary><pre>{JSON.stringify(event.details || {}, null, 2)}</pre></details></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="admin-audit-pagination">
          <button type="button" onClick={() => loadEvents(Math.max(1, pagination.page - 1))} disabled={loading || pagination.page <= 1}>Previous</button>
          <button type="button" onClick={() => loadEvents(pagination.page + 1)} disabled={loading || pagination.page >= pagination.totalPages}>Next</button>
        </div>
      </section>
    </main>
  );
}
