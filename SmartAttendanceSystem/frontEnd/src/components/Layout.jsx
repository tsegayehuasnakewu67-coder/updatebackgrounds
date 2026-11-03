import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  Building2,
  CalendarDays,
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareText,
  Search,
  ShieldCheck,
  Settings,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatEthiopianDate, formatEthiopianDateTime } from '../utils/ethiopianDateTime';
import { contactMessageService } from '../services/contactMessageService';
import { notificationService } from '../services/notificationService';
import { getRequestErrorMessage, getRetryDelaySeconds } from '../services/requestErrors';
import PageBackButton from './PageBackButton';

const WORKSPACE_BACKGROUND_IMAGES = [
  'mau7.jfif',
  'mau1.jfif',
  'mau2.jfif',
  'mau3.jfif',
  'mau4.jfif',
  'mau5.jfif',
  'mau6.jfif',
];

const adminNav = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/users', icon: Users, label: 'Employees' },
  { to: '/admin/reports', icon: ClipboardList, label: 'Reports' },
  { to: '/admin/audit-logs', icon: ShieldCheck, label: 'Security & Audit Logs' },
  { to: '/admin/register', icon: UserPlus, label: 'Register Employee' },
  { to: '/admin/register-hr', icon: UserPlus, label: 'Register HR Account' },
  { to: '/admin/settings', icon: Settings, label: 'System Settings' },
  { to: '/admin/messages', icon: MessageSquareText, label: 'Contact Inbox' },
  { to: '/admin/notifications', icon: Bell, label: 'Messages & Warnings' },
  { to: '/admin/leaves', icon: CalendarDays, label: 'Leave Management' },
];

const employeeNav = [
  { to: '/me', icon: LayoutDashboard, label: 'My Dashboard' },
  { to: '/me/messages', icon: MessageSquareText, label: 'My Messages' },
  { to: '/me/notifications', icon: Bell, label: 'My Notifications' },
  { to: '/me/leaves', icon: CalendarDays, label: 'My Leave Requests' },
];

const hrNav = [
  { to: '/hr', icon: LayoutDashboard, label: 'HR Dashboard' },
  { to: '/hr/employees', icon: Users, label: 'Employee Directory' },
  { to: '/hr/reports', icon: ClipboardList, label: 'Attendance Reports' },
  { to: '/hr/leaves', icon: CalendarDays, label: 'Leave Reviews' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const contentRef = useRef(null);
  const profileMenuRef = useRef(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationError, setNotificationError] = useState('');
  const [adminSearch, setAdminSearch] = useState('');
  const notificationRetryAt = useRef(0);
  const notificationRetryAttempt = useRef(0);
  const nav = user?.role === 'admin' ? adminNav : user?.role === 'hr' ? hrNav : employeeNav;

  useEffect(() => {
    if (user?.role !== 'admin') {
      setUnreadMessages(0);
      return;
    }
    const refreshUnread = () => {
      contactMessageService.list({ limit: 1 })
        .then(result => setUnreadMessages(result.unread || 0))
        .catch(() => {});
    };
    refreshUnread();
    window.addEventListener('sat:contact-messages-updated', refreshUnread);
    return () => window.removeEventListener('sat:contact-messages-updated', refreshUnread);
  }, [user?.role]);

  useEffect(() => {
    if (!user?._id) return undefined;
    let active = true;
    notificationRetryAt.current = 0;
    notificationRetryAttempt.current = 0;
    const refreshNotifications = async () => {
      if (Date.now() < notificationRetryAt.current) return;
      try {
        const { notifications: items, unreadCount } = await notificationService.summary({ limit: 8 });
        if (active) {
          setNotifications(items);
          setUnreadNotificationCount(unreadCount);
          setNotificationError('');
          notificationRetryAt.current = 0;
          notificationRetryAttempt.current = 0;
        }
      } catch (error) {
        if (active) {
          if (error?.response?.status === 429) {
            const delaySeconds = getRetryDelaySeconds(error, notificationRetryAttempt.current);
            notificationRetryAttempt.current += 1;
            notificationRetryAt.current = Date.now() + delaySeconds * 1000;
            setNotificationError(`Notifications are rate limited. Try again in about ${delaySeconds} seconds.`);
          } else {
            setNotificationError(getRequestErrorMessage(error, 'Notifications'));
          }
        }
      }
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refreshNotifications();
    };
    refreshNotifications();
    window.addEventListener('sat:notifications-updated', refreshNotifications);
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      active = false;
      window.removeEventListener('sat:notifications-updated', refreshNotifications);
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [user?._id]);

  useLayoutEffect(() => {
    contentRef.current?.scrollTo(0, 0);
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    setAdminSearch(new URLSearchParams(location.search).get('search') || '');
  }, [location.search]);

  useEffect(() => {
    if (!profileOpen) return undefined;
    const closeProfileMenu = event => {
      if (event.type === 'keydown' && event.key !== 'Escape') return;
      if (event.type === 'pointerdown' && profileMenuRef.current?.contains(event.target)) return;
      setProfileOpen(false);
    };
    document.addEventListener('pointerdown', closeProfileMenu);
    document.addEventListener('keydown', closeProfileMenu);
    return () => {
      document.removeEventListener('pointerdown', closeProfileMenu);
      document.removeEventListener('keydown', closeProfileMenu);
    };
  }, [profileOpen]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const handleAdminSearch = event => {
    event.preventDefault();
    const search = adminSearch.trim();
    navigate(search ? `/admin/users?search=${encodeURIComponent(search)}` : '/admin/users');
  };

  const openNotification = async notification => {
    setNotificationError('');
    try {
      if (!notification.readAt) {
        const updated = await notificationService.markRead(notification._id);
        setNotifications(current => current.map(item => item._id === updated._id ? updated : item));
        setUnreadNotificationCount(count => Math.max(0, count - 1));
      }
      window.dispatchEvent(new Event('sat:notifications-updated'));
      setNotificationsOpen(false);
      if (notification.relatedMessageId && notification.type === 'contact_message' && user?.role === 'admin') {
        navigate(`/admin/messages?ticket=${encodeURIComponent(notification.relatedMessageId)}`);
      } else if (notification.relatedMessageId && notification.type === 'contact_reply' && user?.role === 'employee') {
        navigate(`/me/messages?ticket=${encodeURIComponent(notification.relatedMessageId)}`);
      } else if (user?.role === 'admin') {
        navigate('/admin/notifications');
      } else if (user?.role === 'employee') {
        navigate('/me/notifications');
      } else {
        navigate('/hr');
      }
    } catch (error) {
      setNotificationError(error.message || 'Unable to open this notification.');
    }
  };

  const initials = user?.fullName?.trim()?.charAt(0)?.toUpperCase() || 'U';
  const showWorkspaceBackground = user?.role === 'admin' || user?.role === 'employee' || user?.role === 'hr';
  const workspacePage = {
    '/admin': 'admin-dashboard',
    '/admin/audit-logs': 'admin-audit',
    '/admin/users': 'admin-directory',
    '/admin/reports': 'admin-reports',
    '/admin/register': 'admin-register',
    '/admin/register-hr': 'admin-register',
    '/admin/settings': 'admin-settings',
    '/admin/messages': 'admin-messages',
    '/admin/notifications': 'admin-notifications',
    '/admin/leaves': 'admin-leaves',
    '/hr': 'hr-dashboard',
    '/hr/employees': 'hr-directory',
    '/hr/reports': 'hr-reports',
    '/hr/leaves': 'hr-leaves',
    '/me': 'employee-dashboard',
    '/me/messages': 'employee-messages',
    '/me/notifications': 'employee-notifications',
    '/me/leaves': 'employee-leaves',
  }[location.pathname] || 'workspace';

  return (
    <div
      className={`app-shell${collapsed ? ' app-shell--collapsed' : ''}${showWorkspaceBackground ? ' app-shell--workspace-background' : ''}${user?.role === 'admin' ? ' app-shell--admin' : ''}${user?.role === 'hr' ? ' app-shell--hr' : ''}`}
      data-workspace-page={workspacePage}
      data-user-role={user?.role}
    >
      {showWorkspaceBackground && (
        <div className="app-background" aria-hidden="true">
          {WORKSPACE_BACKGROUND_IMAGES.map((image, index) => (
            <img
              key={image}
              src={`/login-backgrounds/${image}`}
              alt=""
              style={{ animationDelay: `-${index * 6}s` }}
            />
          ))}
        </div>
      )}
      {mobileOpen && (
        <button
          aria-label="Close navigation"
          className="app-sidebar-scrim"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={`app-sidebar${mobileOpen ? ' app-sidebar--open' : ''}`}>
        <div className="app-brand">
          <div className="app-brand-mark" aria-hidden="true">
            {user?.role === 'admin' || user?.role === 'hr'
              ? <img className="app-brand-logo" src="/mau-logo.png" alt="" />
              : <Building2 size={20} />}
          </div>
          <div className="app-brand-copy">
            <strong>{user?.role === 'admin' || user?.role === 'hr' ? 'Mekdela Amba University' : 'Smart Attendance'}</strong>
            <span>{user?.role === 'admin' || user?.role === 'hr' ? 'SMART WORKFORCE' : 'Workforce management'}</span>
          </div>
          <button
            aria-label="Close navigation"
            className="app-icon-button app-mobile-close"
            onClick={() => setMobileOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        <div className="app-nav-caption">WORKSPACE</div>
        <nav className="app-nav" aria-label="Main navigation">
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/admin' || to === '/hr' || to === '/me'}
              className={({ isActive }) => `app-nav-link${isActive ? ' is-active' : ''}`}
              title={collapsed ? label : undefined}
            >
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
              {to === '/admin/messages' && unreadMessages > 0 && (
                <span className="app-nav-badge" aria-label={`${unreadMessages} unread contact messages`}>
                  {unreadMessages > 99 ? '99+' : unreadMessages}
                </span>
              )}
              {(to === '/admin/notifications' || to === '/me/notifications') && unreadNotificationCount > 0 && (
                <span className="app-nav-badge" aria-label={`${unreadNotificationCount} unread notifications`}>
                  {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                </span>
              )}
              <ChevronRight className="app-nav-chevron" size={15} aria-hidden="true" />
            </NavLink>
          ))}
          <div className="app-nav-divider" />
          <NavLink
            to="/kiosk"
            className={({ isActive }) => `app-nav-link${isActive ? ' is-active' : ''}`}
            title={collapsed ? 'Attendance station' : undefined}
          >
            <Camera size={18} aria-hidden="true" />
            <span>Attendance station</span>
            <ChevronRight className="app-nav-chevron" size={15} aria-hidden="true" />
          </NavLink>
        </nav>

        <div className="app-sidebar-footer">
          <div className="app-user">
            <div className="app-user-avatar" aria-hidden="true">{initials}</div>
            <div className="app-user-copy">
              <strong title={user?.fullName}>{user?.fullName}</strong>
              <span title={user?.role === 'admin' ? 'System Administrator' : user?.department}>
                {user?.role === 'admin' ? 'System Administrator' : user?.department || user?.role}
              </span>
            </div>
          </div>
          <button className="app-signout" onClick={handleLogout}>
            <LogOut size={17} aria-hidden="true" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <main className="app-main">
        <header className="app-topbar">
          <div className="app-topbar-start">
            <button
              aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
              aria-expanded={mobileOpen}
              className="app-icon-button app-menu-button"
              onClick={() => setMobileOpen(value => !value)}
            >
              {mobileOpen ? <X size={19} /> : <Menu size={19} />}
            </button>
            <button
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-expanded={!collapsed}
              className="app-icon-button app-collapse-button"
              onClick={() => setCollapsed(value => !value)}
            >
              {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
            <span className="app-today">
              {formatEthiopianDate(new Date(), user?.role === 'admin' || user?.role === 'hr'
                ? { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }
                : { weekday: 'long' })}
            </span>
          </div>
          {user?.role === 'admin' && (
            <form className="app-topbar-search" onSubmit={handleAdminSearch} role="search">
              <Search size={17} aria-hidden="true" />
              <input
                aria-label="Search employees"
                onChange={event => setAdminSearch(event.target.value)}
                placeholder="Search employees"
                value={adminSearch}
              />
              <button type="submit">Search</button>
            </form>
          )}
          <div className="app-topbar-user">
            <div className="app-notification-menu">
              <button
                aria-expanded={notificationsOpen}
                aria-label={`Notifications${unreadNotificationCount ? `, ${unreadNotificationCount} unread` : ''}`}
                className="app-icon-button app-notification-toggle"
                onClick={() => {
                  setProfileOpen(false);
                  setNotificationsOpen(open => !open);
                }}
                type="button"
              >
                <Bell size={18} aria-hidden="true" />
                {unreadNotificationCount > 0 && <span className="app-notification-count">{unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}</span>}
              </button>
              {notificationsOpen && (
                <section className="app-notification-popover" aria-label="Recent notifications">
                  <header>
                    <strong>Notifications</strong>
                    <span>{unreadNotificationCount} unread</span>
                  </header>
                  {notificationError && <p className="app-notification-error" role="alert">{notificationError}</p>}
                  {notifications.length === 0 ? <p className="app-notification-empty">No notifications yet.</p> : notifications.map(notification => (
                    <button
                      className={`app-notification-item${notification.readAt ? ' is-read' : ''}`}
                      key={notification._id}
                      onClick={() => openNotification(notification)}
                      type="button"
                    >
                      <strong>{notification.title || notification.subject}</strong>
                      <span>{notification.message}</span>
                      <small>{formatEthiopianDateTime(notification.createdAt)}</small>
                    </button>
                  ))}
                  <button
                    className="app-notification-view-all"
                    onClick={() => {
                      setNotificationsOpen(false);
                      navigate(user?.role === 'admin' ? '/admin/notifications' : user?.role === 'employee' ? '/me/notifications' : '/hr');
                    }}
                    type="button"
                  >
                  {user?.role === 'hr' ? 'Return to HR dashboard' : 'View all notifications'}
                  </button>
                </section>
              )}
            </div>
            <span className="app-role-badge">{user?.role}</span>
            {(user?.employeeId || (user?.role === 'admin' && user?._id)) && (
              <span className="app-id-badge">
                {user?.role === 'admin' ? 'Admin ID' : user.employeeId}
                {user?.role === 'admin' ? ` ${user.employeeId || user._id.slice(-8).toUpperCase()}` : ''}
              </span>
            )}
            {user?.role === 'admin' || user?.role === 'hr' ? (
              <div className="app-profile-menu" ref={profileMenuRef}>
                <button
                  aria-expanded={profileOpen}
                  aria-controls="workspace-profile-menu"
                  aria-label={`${user?.role === 'admin' ? 'Administrator' : 'HR'} profile: ${user?.fullName || 'User'}`}
                  className="app-profile-toggle"
                  onClick={() => {
                    setNotificationsOpen(false);
                    setProfileOpen(open => !open);
                  }}
                  type="button"
                >
                  <span className="app-topbar-avatar" aria-hidden="true">{initials}</span>
                  <ChevronDown className="app-profile-chevron" size={14} aria-hidden="true" />
                </button>
                {profileOpen && (
                  <section className="app-profile-popover" id="workspace-profile-menu" aria-label={`${user?.role === 'admin' ? 'Administrator' : 'HR'} profile menu`}>
                    <div className="app-profile-summary">
                      <strong>{user?.fullName || (user?.role === 'admin' ? 'Administrator' : 'HR user')}</strong>
                      <span>{user?.employeeId || user?.department || `${user?.role === 'admin' ? 'Administrator' : 'HR'} account`}</span>
                    </div>
                    <button className="app-profile-signout" onClick={handleLogout} type="button">
                      <LogOut size={16} aria-hidden="true" />
                      Sign out
                    </button>
                  </section>
                )}
              </div>
            ) : (
              <div className="app-topbar-avatar" aria-hidden="true">{initials}</div>
            )}
          </div>
        </header>

        <div className="app-content" data-workspace-page={workspacePage} ref={contentRef}>
          <div className="app-page legacy-page">
            {location.pathname !== (user?.role === 'employee' ? '/me' : `/${user?.role}`) && (
              <PageBackButton fallback={user?.mustChangePassword ? '/change-password' : undefined} />
            )}
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
