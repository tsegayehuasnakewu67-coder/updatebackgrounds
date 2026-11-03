import { useCallback, useEffect, useState } from 'react';
import { Check, Loader2, Mail, MessageSquare, Search, Send, Trash2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { contactMessageService } from '../../services/contactMessageService';
import { formatEthiopianDateTime } from '../../utils/ethiopianDateTime';

const STATUS_LABELS = {
  pending: 'Pending',
  in_progress: 'In Progress',
  replied: 'Replied',
  closed: 'Closed',
};
const EMAIL_DELIVERY_LABELS = {
  not_required: 'In-app delivery; email not required',
  not_configured: 'Email is not configured; reply is saved in the inbox',
  pending: 'Email delivery pending',
  sent: 'Email delivered to the sender',
  failed: 'Email delivery failed; reply is saved in the inbox',
};

const getError = (error, fallback) => error?.response?.data?.message || error.message || fallback;

export default function AdminMessages() {
  const [searchParams] = useSearchParams();
  const [messages, setMessages] = useState([]);
  const [selected, setSelected] = useState(null);
  const [unread, setUnread] = useState(0);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [filters, setFilters] = useState({ search: '', status: '', read: '' });
  const [searchValue, setSearchValue] = useState('');
  const [replyText, setReplyText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [deliveryWarning, setDeliveryWarning] = useState('');

  const loadMessages = useCallback(async (page = 1, appliedFilters = filters) => {
    setLoading(true);
    setError('');
    try {
      const result = await contactMessageService.list({
        page,
        limit: 20,
        search: appliedFilters.search || undefined,
        status: appliedFilters.status || undefined,
        read: appliedFilters.read || undefined,
      });
      setMessages(result.messages);
      setUnread(result.unread);
      setPagination(result.pagination);
      setSelected(current => {
        if (!current) return current;
        return result.messages.find(message => message._id === current._id) || current;
      });
    } catch (requestError) {
      setError(getError(requestError, 'Unable to load messages.'));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { loadMessages(1); }, [loadMessages]);

  useEffect(() => {
    const ticketId = searchParams.get('ticket');
    if (ticketId) openMessage({ _id: ticketId });
  }, [searchParams]);

  const replaceMessage = message => {
    setSelected(message);
    setMessages(current => current.map(item => item._id === message._id ? message : item));
  };

  const openMessage = async item => {
    setSelected(item);
    setReplyText('');
    setNotice('');
    setDeliveryWarning('');
    setError('');
    try {
      let fullMessage = await contactMessageService.get(item._id);
      if (!fullMessage.isRead) {
        fullMessage = await contactMessageService.setRead(fullMessage._id, true);
        setUnread(count => Math.max(0, count - 1));
        window.dispatchEvent(new Event('sat:contact-messages-updated'));
      }
      replaceMessage(fullMessage);
    } catch (requestError) {
      setError(getError(requestError, 'Unable to open this message.'));
    }
  };

  const changeStatus = async status => {
    if (!selected) return;
    setUpdating(true);
    setError('');
    setNotice('');
    setDeliveryWarning('');
    try {
      const updated = await contactMessageService.setStatus(selected._id, status);
      replaceMessage(updated);
      setNotice('Ticket status updated.');
      await loadMessages(pagination.page);
    } catch (requestError) {
      setError(getError(requestError, 'Unable to update ticket status.'));
    } finally {
      setUpdating(false);
    }
  };

  const toggleReadState = async () => {
    if (!selected) return;
    setUpdating(true);
    setError('');
    try {
      const updated = await contactMessageService.setRead(selected._id, !selected.isRead);
      replaceMessage(updated);
      setUnread(count => Math.max(0, count + (updated.isRead ? -1 : 1)));
      window.dispatchEvent(new Event('sat:contact-messages-updated'));
    } catch (requestError) {
      setError(getError(requestError, 'Unable to update read state.'));
    } finally {
      setUpdating(false);
    }
  };

  const submitReply = async event => {
    event.preventDefault();
    if (!selected || !replyText.trim()) {
      setError('Enter a reply before sending.');
      return;
    }
    setSending(true);
    setError('');
    setNotice('');
    setDeliveryWarning('');
    try {
      const result = await contactMessageService.reply(selected._id, replyText.trim());
      if (result.success !== true || !result.data?.message) {
        throw new Error(result.message || 'The server could not confirm that the reply was saved.');
      }
      const updated = result.data.message;
      replaceMessage(updated);
      setReplyText('');
      const deliveryNotes = [
        result.data.emailError,
        result.data.notificationError,
      ].filter(Boolean);
      setNotice(result.message);
      setDeliveryWarning(deliveryNotes.join(' '));
      await loadMessages(pagination.page);
    } catch (requestError) {
      setError(getError(requestError, 'Unable to send reply.'));
    } finally {
      setSending(false);
    }
  };

  const deleteMessage = async () => {
    if (!selected || !window.confirm(`Delete ticket ${selected.ticketId}? This cannot be undone.`)) return;
    setUpdating(true);
    setError('');
    try {
      await contactMessageService.remove(selected._id);
      setSelected(null);
      setNotice('Ticket deleted.');
      window.dispatchEvent(new Event('sat:contact-messages-updated'));
      await loadMessages(pagination.page);
    } catch (requestError) {
      setError(getError(requestError, 'Unable to delete this ticket.'));
    } finally {
      setUpdating(false);
    }
  };

  const submitSearch = event => {
    event.preventDefault();
    const next = { ...filters, search: searchValue.trim() };
    setFilters(next);
  };

  const setFilter = (key, value) => {
    const next = { ...filters, [key]: value };
    setFilters(next);
  };

  return (
    <main className="admin-messages-page">
      <header className="admin-messages-heading">
        <div>
          <p>ADMINISTRATION</p>
          <h1>Contact messages</h1>
          <span>{pagination.total} tickets · {unread} unread</span>
        </div>
        <Mail size={24} aria-hidden="true" />
      </header>

      {notice && <p className="auth-alert auth-alert--success" role="status">{notice}</p>}
      {deliveryWarning && <p className="admin-message-delivery-warning" role="status">{deliveryWarning}</p>}
      {error && <p className="auth-alert auth-alert--error" role="alert">{error}</p>}

      <div className="admin-message-tools">
        <form onSubmit={submitSearch} className="admin-message-search">
          <Search size={17} aria-hidden="true" />
          <input aria-label="Search contact messages" onChange={event => setSearchValue(event.target.value)} placeholder="Search name, email, subject or ticket ID" value={searchValue} />
          <button type="submit">Search</button>
        </form>
        <label>Status
          <select onChange={event => setFilter('status', event.target.value)} value={filters.status}>
            <option value="">All statuses</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>Read state
          <select onChange={event => setFilter('read', event.target.value)} value={filters.read}>
            <option value="">All messages</option>
            <option value="false">Unread</option>
            <option value="true">Read</option>
          </select>
        </label>
      </div>

      <div className="admin-messages-grid">
        <section className="admin-message-list" aria-label="Contact message results">
          {loading ? <div className="admin-message-empty"><Loader2 className="spin" size={20} /> Loading messages…</div>
            : messages.length === 0 ? <div className="admin-message-empty"><MessageSquare size={21} /> No messages found.</div>
              : messages.map(message => (
                <button key={message._id} className={`admin-message-row${selected?._id === message._id ? ' is-selected' : ''}`} onClick={() => openMessage(message)} type="button">
                  <span className={`admin-message-unread${message.isRead ? ' is-read' : ''}`} aria-label={message.isRead ? 'Read' : 'Unread'} />
                  <span className="admin-message-row-copy">
                    <strong>{message.fullName}</strong>
                    <span>{message.subject}</span>
                    <small>{message.ticketId} · {message.email} · {formatEthiopianDateTime(message.createdAt)}</small>
                  </span>
                  <span className={`admin-message-status status-${message.status}`}>{STATUS_LABELS[message.status] || message.status}</span>
                </button>
              ))}
          {!loading && pagination.totalPages > 1 && (
            <div className="admin-message-pagination">
              <span>Page {pagination.page} of {pagination.totalPages}</span>
              <div>
                <button disabled={pagination.page <= 1} onClick={() => loadMessages(pagination.page - 1)} type="button">Previous</button>
                <button disabled={pagination.page >= pagination.totalPages} onClick={() => loadMessages(pagination.page + 1)} type="button">Next</button>
              </div>
            </div>
          )}
        </section>

        <section className="admin-message-detail" aria-label="Selected message">
          {!selected ? <div className="admin-message-empty"><MessageSquare size={22} /> Select a ticket to view details.</div> : (
            <>
              <div className="admin-message-detail-heading">
                <div>
                  <span>{selected.ticketId}</span>
                  <h2>{selected.subject}</h2>
                </div>
                <div className="admin-message-detail-actions">
                  <button className="admin-message-read-toggle" disabled={updating} onClick={toggleReadState} type="button">
                    <Check size={14} /> Mark {selected.isRead ? 'unread' : 'read'}
                  </button>
                  <button aria-label="Delete ticket" className="admin-message-delete" disabled={updating} onClick={deleteMessage} title="Delete ticket" type="button"><Trash2 size={17} /></button>
                </div>
              </div>
              <div className="admin-message-metadata">
                <strong>{selected.fullName}</strong>
                <a href={`mailto:${selected.email}`}>{selected.email}</a>
                <time>{formatEthiopianDateTime(selected.createdAt)}</time>
              </div>
              <p className="admin-message-body">{selected.message}</p>
              <label className="admin-message-status-control">Status
                <select disabled={updating} onChange={event => changeStatus(event.target.value)} value={selected.status}>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              {selected.lastRepliedAt && <p className="admin-message-last-replied">Last reply: {formatEthiopianDateTime(selected.lastRepliedAt)}</p>}
              {selected.replies.length > 0 && (
                <p className={`admin-message-delivery-status delivery-${selected.emailDeliveryStatus || 'not_required'}`} role="status">
                  {EMAIL_DELIVERY_LABELS[selected.emailDeliveryStatus || 'not_required']}
                </p>
              )}
              <h3>Reply history</h3>
              <div className="admin-message-replies">
                {selected.replies.length === 0 ? <p>No replies yet.</p> : selected.replies.map(reply => (
                  <article key={reply._id}>
                    <header><strong>{reply.senderName || (reply.senderRole === 'admin' ? 'Admin' : 'Employee')}</strong><time>{formatEthiopianDateTime(reply.createdAt)}</time></header>
                    <p>{reply.message}</p>
                  </article>
                ))}
              </div>
              <form className="admin-message-reply-form" onSubmit={submitReply}>
                <label htmlFor="contact-reply">Reply to sender</label>
                <textarea id="contact-reply" maxLength={10000} onChange={event => setReplyText(event.target.value)} required rows={4} value={replyText} />
                <button className="auth-button auth-button--primary" disabled={sending || !replyText.trim()} type="submit">
                  {sending ? <><Loader2 className="spin" size={16} /> Sending…</> : <><Send size={15} /> Send reply</>}
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
