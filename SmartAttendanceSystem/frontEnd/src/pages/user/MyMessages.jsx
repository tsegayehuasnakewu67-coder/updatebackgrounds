import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, Loader2, Mail, MessageSquare, Send } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { contactMessageService } from '../../services/contactMessageService';
import { notificationService } from '../../services/notificationService';
import { formatEthiopianDateTime } from '../../utils/ethiopianDateTime';

const STATUS_LABELS = {
  pending: 'Pending',
  in_progress: 'In Progress',
  replied: 'Replied',
  closed: 'Closed',
};

const getError = (error, fallback) => error?.response?.data?.message || error.message || fallback;

export default function MyMessages() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [tickets, setTickets] = useState([]);
  const [selected, setSelected] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [form, setForm] = useState({ subject: '', message: '' });
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [unreadReplies, setUnreadReplies] = useState(0);
  const selectedTicketRef = useRef(null);
  const submitLock = useRef(false);
  const submissionId = useRef(null);
  selectedTicketRef.current = selected;

  const loadTickets = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const result = await contactMessageService.mine({ page, limit: 20 });
      setTickets(result.messages);
      setPagination(result.pagination);
      setSelected(current => current
        ? result.messages.find(ticket => ticket._id === current._id) || current
        : current);
    } catch (requestError) {
      setError(getError(requestError, 'Unable to load your tickets.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTickets(1); }, [loadTickets]);

  useEffect(() => {
    let active = true;
    const refreshUnread = async () => {
      try {
        const count = await notificationService.unreadCount('contact_reply');
        if (active) {
          setUnreadReplies(count);
          if (count > 0) {
            const result = await contactMessageService.mine({ page: 1, limit: 20 });
            if (!active) return;
            setTickets(result.messages);
            setPagination(result.pagination);
            if (selectedTicketRef.current) {
              const updated = await contactMessageService.getMine(selectedTicketRef.current._id);
              if (active) setSelected(updated);
            }
          }
        }
      } catch (requestError) {
        if (active) setError(getError(requestError, 'Unable to refresh reply notifications.'));
      }
    };
    refreshUnread();
    const interval = window.setInterval(refreshUnread, 30000);
    window.addEventListener('sat:notifications-updated', refreshUnread);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener('sat:notifications-updated', refreshUnread);
    };
  }, []);

  useEffect(() => {
    const ticketId = searchParams.get('ticket');
    const ticket = tickets.find(item => item._id === ticketId);
    if (ticket) void openTicket(ticket);
  }, [searchParams, tickets]);

  const openTicket = async ticket => {
    setSelected(ticket);
    setError('');
    try {
      setSelected(await contactMessageService.getMine(ticket._id));
    } catch (requestError) {
      setError(getError(requestError, 'Unable to open this ticket.'));
      return;
    }
    try {
      const notifications = await notificationService.list({ limit: 100 });
      const unreadTicketReplies = notifications.filter(item => (
        item.type === 'contact_reply'
        && !item.readAt
        && String(item.relatedMessageId) === String(ticket._id)
      ));
      await Promise.all(unreadTicketReplies.map(item => notificationService.markRead(item._id)));
      if (unreadTicketReplies.length) {
        setUnreadReplies(count => Math.max(0, count - unreadTicketReplies.length));
        window.dispatchEvent(new Event('sat:notifications-updated'));
      }
    } catch (requestError) {
      setError(getError(requestError, 'Ticket opened, but its reply notification could not be marked read.'));
    }
  };

  const submitTicket = async event => {
    event.preventDefault();
    if (submitLock.current) return;
    const subject = form.subject.trim();
    const message = form.message.trim();
    if (subject.length < 2 || subject.length > 160 || message.length < 5 || message.length > 10000) {
      setError('Enter a subject and a message of at least 5 characters.');
      return;
    }

    submitLock.current = true;
    submissionId.current = submissionId.current || globalThis.crypto.randomUUID();
    setSending(true);
    setError('');
    setNotice('');
    try {
      const result = await contactMessageService.submit({
        fullName: user.fullName,
        email: user.email,
        subject,
        message,
        submissionId: submissionId.current,
      });
      submissionId.current = null;
      setNotice(result.data.notificationError
        ? `Your ticket was saved (${result.data.ticketId}), but an administrator notification could not be delivered.`
        : `Your message was sent. Ticket ID: ${result.data.ticketId}`);
      setForm({ subject: '', message: '' });
      await loadTickets(1);
    } catch (requestError) {
      setError(getError(requestError, 'Unable to submit your message.'));
    } finally {
      submitLock.current = false;
      setSending(false);
    }
  };

  return (
    <main className="my-messages-page">
      <header className="my-messages-heading">
        <div>
          <p>EMPLOYEE SUPPORT</p>
          <h1>My Messages</h1>
          <span>View your contact tickets and administrator replies.</span>
        </div>
        <Link to="/me/notifications" className="my-messages-notifications">
          <Bell size={16} /> Notifications
          {unreadReplies > 0 && <span className="app-nav-badge" aria-label={`${unreadReplies} unread contact replies`}>{unreadReplies > 99 ? '99+' : unreadReplies}</span>}
        </Link>
      </header>

      {notice && <p className="auth-alert auth-alert--success" role="status">{notice}</p>}
      {error && <p className="auth-alert auth-alert--error" role="alert">{error}</p>}

      <section className="my-message-new">
        <h2><Mail size={18} /> Create a support ticket</h2>
        <p>Your ticket will be linked to your signed-in employee account. Replies will also appear in your notifications.</p>
        <form onSubmit={submitTicket}>
          <label>
            Full name
            <input autoComplete="name" readOnly value={user?.fullName || ''} />
          </label>
          <label>
            Email address
            <input autoComplete="email" readOnly type="email" value={user?.email || ''} />
          </label>
          <label className="my-message-wide">
            Subject
            <input maxLength={160} onChange={event => setForm(current => ({ ...current, subject: event.target.value }))} required value={form.subject} />
          </label>
          <label className="my-message-wide">
            Message
            <textarea maxLength={10000} onChange={event => setForm(current => ({ ...current, message: event.target.value }))} required rows={4} value={form.message} />
          </label>
          <button className="auth-button auth-button--primary" disabled={sending} type="submit">
            {sending ? <><Loader2 className="spin" size={16} /> Sending…</> : <><Send size={15} /> Send message</>}
          </button>
        </form>
      </section>

      <div className="my-messages-grid">
        <section className="my-ticket-list" aria-label="Your contact tickets">
          <header><h2>Your tickets</h2><span>{pagination.total}</span></header>
          {loading ? <div className="my-message-empty"><Loader2 className="spin" size={19} /> Loading tickets…</div>
            : tickets.length === 0 ? <div className="my-message-empty"><MessageSquare size={20} /> You have not submitted any tickets.</div>
              : tickets.map(ticket => (
                <button key={ticket._id} className={`my-ticket-row${selected?._id === ticket._id ? ' is-selected' : ''}`} onClick={() => openTicket(ticket)} type="button">
                  <strong>{ticket.subject}</strong>
                  <span>{ticket.ticketId}</span>
                  <small>{formatEthiopianDateTime(ticket.createdAt)}</small>
                  <span className={`admin-message-status status-${ticket.status}`}>{STATUS_LABELS[ticket.status] || ticket.status}</span>
                </button>
              ))}
          {!loading && pagination.totalPages > 1 && (
            <div className="admin-message-pagination">
              <span>Page {pagination.page} of {pagination.totalPages}</span>
              <div>
                <button disabled={pagination.page <= 1} onClick={() => loadTickets(pagination.page - 1)} type="button">Previous</button>
                <button disabled={pagination.page >= pagination.totalPages} onClick={() => loadTickets(pagination.page + 1)} type="button">Next</button>
              </div>
            </div>
          )}
        </section>

        <section className="my-ticket-detail" aria-label="Selected ticket details">
          {!selected ? <div className="my-message-empty"><MessageSquare size={21} /> Select a ticket to view its conversation.</div> : (
            <>
              <header>
                <div>
                  <small>{selected.ticketId}</small>
                  <h2>{selected.subject}</h2>
                </div>
                <span className={`admin-message-status status-${selected.status}`}>{STATUS_LABELS[selected.status] || selected.status}</span>
              </header>
              <p className="my-ticket-date">Submitted {formatEthiopianDateTime(selected.createdAt)}</p>
              <article className="my-ticket-original">
                <strong>Your message</strong>
                <p>{selected.message}</p>
              </article>
              <h3>Conversation</h3>
              <div className="admin-message-replies">
                {selected.replies.length === 0 ? <p>No replies yet.</p> : selected.replies.map(reply => (
                  <article key={reply._id}>
                    <header>
                      <strong>{reply.senderRole === 'admin' ? 'Administrator' : 'You'}</strong>
                      <time>{formatEthiopianDateTime(reply.createdAt)}</time>
                    </header>
                    <p>{reply.message}</p>
                  </article>
                ))}
              </div>
              {selected.lastRepliedAt && <p className="my-ticket-date">Latest reply {formatEthiopianDateTime(selected.lastRepliedAt)}</p>}
              <p className="my-ticket-follow-up">
                {selected.status === 'closed'
                  ? 'This ticket is closed. Contact the administrator to request that it be reopened.'
                  : 'Follow-up replies are not enabled for employee tickets. Reply to the administrator’s email or submit a new ticket if you need further help.'}
              </p>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
