import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import PageBackButton from '../components/PageBackButton';
import api from '../services/api';
import './HomePage.css';
import {
  ArrowRight,
  ArrowUpRight,
  Camera,
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ClipboardCheck,
  Facebook,
  FileSpreadsheet,
  FileText,
  Linkedin,
  LockKeyhole,
  Mail,
  Menu,
  MapPin,
  PhoneCall,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
  Youtube,
  X,
} from 'lucide-react';

const landingFeatures = [
  {
    icon: Camera,
    title: 'Face Recognition Attendance',
    description: 'Record attendance through a fast, secure face verification workflow.',
  },
  {
    icon: Users,
    title: 'Employee Management',
    description: 'Maintain employee profiles and organize staff across university departments.',
  },
  {
    icon: Clock3,
    title: 'Real-Time Attendance Tracking',
    description: 'Review daily attendance activity and workforce status as it is recorded.',
  },
  {
    icon: FileText,
    title: 'Attendance Reports',
    description: 'Explore attendance summaries and export records across flexible reporting periods.',
  },
  {
    icon: CalendarDays,
    title: 'Leave Management',
    description: 'Submit, review, and manage employee leave requests in one place.',
  },
  {
    icon: BarChart3,
    title: 'Admin Dashboard',
    description: 'Give administrators a clear overview of attendance, teams, and system activity.',
  },
];

const workflowSteps = [
  {
    number: '01',
    title: 'Sign in securely',
    description: 'Authorized staff access the tools and information available to their role.',
    icon: ShieldCheck,
  },
  {
    number: '02',
    title: 'Record and monitor',
    description: 'Capture attendance and review team activity through a shared system.',
    icon: Clock3,
  },
  {
    number: '03',
    title: 'Analyze and report',
    description: 'Explore attendance trends and export reports for the period you need.',
    icon: BarChart3,
  },
];

const projectCapabilities = [
  {
    icon: ClipboardCheck,
    title: 'Employee attendance management',
    description: 'Record and review attendance for university employees.',
  },
  {
    icon: Building2,
    title: 'Department management',
    description: 'Organize staff by department and support team-level oversight.',
  },
  {
    icon: BarChart3,
    title: 'Attendance analytics and statistics',
    description: 'Turn attendance records into clear summaries and useful trends.',
  },
  {
    icon: CalendarDays,
    title: 'Flexible reporting periods',
    description: 'Review daily, weekly, monthly, quarterly, and yearly attendance.',
  },
  {
    icon: FileSpreadsheet,
    title: 'Excel and PDF export',
    description: 'Export attendance reports for review and record keeping.',
  },
  {
    icon: Bell,
    title: 'Automated notifications',
    description: 'Keep employees and administrators informed with timely updates.',
  },
  {
    icon: ShieldCheck,
    title: 'Role-based access control',
    description: 'Provide administrators, HR, and employees access appropriate to their roles.',
  },
];

const projectHighlights = [
  {
    icon: Clock3,
    title: 'Digital attendance tracking',
    description: 'Replace fragmented manual records with a consistent digital attendance workflow.',
  },
  {
    icon: FileText,
    title: 'Transparent reporting',
    description: 'Make attendance information easier for authorized teams to review and share.',
  },
  {
    icon: Building2,
    title: 'Department-level monitoring',
    description: 'Support managers with department-based attendance organization and oversight.',
  },
  {
    icon: LockKeyhole,
    title: 'Secure workforce management',
    description: 'Protect workforce workflows with role-based access and controlled administration.',
  },
];

const projectWorkflow = [
  {
    icon: ShieldCheck,
    title: 'Sign in securely',
    description: 'Authorized staff sign in and access tools based on their assigned role.',
  },
  {
    icon: Users,
    title: 'Manage attendance and departments',
    description: 'Administrators maintain employee records, departments, and attendance workflows.',
  },
  {
    icon: BarChart3,
    title: 'Monitor and make decisions',
    description: 'Reports and analytics help teams review attendance and plan next steps.',
  },
];

export default function HomePage({ page = 'home' }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [contactForm, setContactForm] = useState({ fullName: '', email: '', subject: '', message: '' });
  const [contactStatus, setContactStatus] = useState({ type: '', message: '' });
  const [contactTicketId, setContactTicketId] = useState('');
  const [formErrors, setFormErrors] = useState({});
  const [sendingContact, setSendingContact] = useState(false);
  const contactSubmitLock = useRef(false);
  const contactSubmissionId = useRef(null);
  const landingRef = useRef(null);

  useEffect(() => {
    if (page !== 'home' || !landingRef.current) return undefined;
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.14 });

    landingRef.current.querySelectorAll('.reveal-on-scroll').forEach(element => observer.observe(element));
    return () => observer.disconnect();
  }, [page]);

  const validateContactForm = (values) => {
    const nextErrors = {};
    const fullName = values.fullName.trim();
    const email = values.email.trim();
    const subject = values.subject.trim();
    const message = values.message.trim();

    if (!fullName) nextErrors.fullName = 'Full name is required.';
    else if (fullName.length < 2) nextErrors.fullName = 'Full name must be at least 2 characters.';

    if (!email) nextErrors.email = 'Email address is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) nextErrors.email = 'Please enter a valid email address.';

    if (!subject) nextErrors.subject = 'Subject is required.';
    else if (subject.length < 2) nextErrors.subject = 'Subject must be at least 2 characters.';

    if (!message) nextErrors.message = 'Message is required.';
    else if (message.length < 10) nextErrors.message = 'Message must be at least 10 characters long.';
    else if (message.length > 10000) nextErrors.message = 'Message is too long. Please shorten it.';

    return nextErrors;
  };

  const submitContactMessage = async event => {
    event.preventDefault();
    if (contactSubmitLock.current) return;
    const errors = validateContactForm(contactForm);
    setFormErrors(errors);
    setContactStatus({ type: '', message: '' });
    setContactTicketId('');

    if (Object.keys(errors).length > 0) {
      setContactStatus({ type: 'error', message: 'Please fix the highlighted fields and try again.' });
      return;
    }

    contactSubmitLock.current = true;
    contactSubmissionId.current = contactSubmissionId.current || globalThis.crypto.randomUUID();
    setSendingContact(true);
    try {
      const response = await api.post('/contact', {
        fullName: contactForm.fullName.trim(),
        email: contactForm.email.trim(),
        subject: contactForm.subject.trim(),
        message: contactForm.message.trim(),
        submissionId: contactSubmissionId.current,
      });
      if (response.data?.success !== true || !response.data.data?.ticketId) {
        throw new Error(response.data?.message || 'We could not confirm that your message was saved. Please try again.');
      }
      const notificationError = response.data.data?.notificationError;
      setContactStatus({
        type: notificationError ? 'warning' : 'success',
        message: notificationError
          ? 'Your message was saved, but the administrator notification could not be delivered. Please contact support if the matter is urgent.'
          : response.data.message || 'Your message has been sent successfully!',
      });
      setContactTicketId(response.data.data?.ticketId || '');
      setContactForm({ fullName: '', email: '', subject: '', message: '' });
      setFormErrors({});
      contactSubmissionId.current = null;
    } catch (requestError) {
      const backendMessage = requestError?.response?.data?.message || requestError.message || 'Unable to send your message. Please try again.';
      setContactStatus({ type: 'error', message: backendMessage });
      setFormErrors({});
    } finally {
      contactSubmitLock.current = false;
      setSendingContact(false);
    }
  };

  const styles = `
    .home-shell {
      min-height: 100vh;
      background: #87CEEB;
      color: #0F172A;
      overflow: hidden;
      position: relative;
      isolation: isolate;
    }

    html {
      scroll-behavior: smooth;
    }

    .home-inner {
      max-width: 1440px;
      margin: 0 auto;
      padding: 20px 32px 72px;
      position: relative;
      z-index: 1;
    }

      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 18px 24px;
      border: 1px solid rgba(148, 163, 184, 0.18);
      background: rgba(255, 255, 255, 0.82);
      backdrop-filter: blur(12px);
      border-radius: 0;
      box-shadow: 0 25px 50px rgba(15, 23, 42, 0.06);
      animation: revealDown 0.7s ease both;
    }

    .brand-wrap {
      display: inline-flex;
      align-items: center;
      gap: 14px;
    }

    .brand-logo {
      width: 52px;
      height: 52px;
      border-radius: 16px;
      background: linear-gradient(135deg, #0b2d27 0%, #0f766e 55%, #34d399 100%);
      display: grid;
      place-items: center;
      box-shadow: 0 12px 24px rgba(16, 185, 129, 0.38);
      animation: glow 3s ease-in-out infinite alternate, brandFloat 5s ease-in-out infinite;
      position: relative;
      overflow: hidden;
      padding: 4px;
      background: #f4f8ff;
    }

    .brand-logo-image {
      width: 100%;
      height: 100%;
      object-fit: contain;
      border-radius: 12px;
      position: relative;
      z-index: 1;
    }

    .brand-logo::after {
      content: '';
      position: absolute;
      inset: -45%;
      background: linear-gradient(120deg, transparent 35%, rgba(255, 255, 255, 0.5), transparent 65%);
      transform: translateX(-70%) rotate(18deg);
      animation: logoShine 4.5s ease-in-out infinite;
    }

    .brand-mark {
      font-size: 1.2rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      color: white;
    }

    .brand-copy h2 {
      margin: 0;
      font-size: 1.04rem;
      font-weight: 750;
      letter-spacing: -0.03em;
      color: #e0f2fe;
    }

    .brand-copy small {
      display: block;
      color: #a5f3fc;
      margin-top: 2px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .nav-links {
      display: flex;
      align-items: center;
      gap: 22px;
      color: #dbeafe;
      font-size: 0.95rem;
    }

    .nav-links a {
      color: #dbeafe;
      text-decoration: none;
      transition: color 0.2s ease, transform 0.2s ease;
      position: relative;
      padding: 8px 0;
    }

    .nav-links a:hover {
      color: #7dd3fc;
      transform: translateY(-1px);
    }

    .nav-links a.active {
      color: #7dd3fc;
    }

    .nav-links a::after {
      content: '';
      position: absolute;
      left: 0;
      right: 100%;
      bottom: 0;
      height: 2px;
      background: #1c64f3;
      transition: right 0.25s ease;
    }

    .nav-links a:hover::after {
      right: 0;
    }

    .nav-links a.active::after {
      right: 0;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .ghost-btn,
    .primary-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      border-radius: 999px;
      text-decoration: none;
      transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
      font-weight: 700;
      padding: 0.82rem 1.25rem;
      min-height: 44px;
    }

    .ghost-btn {
      border: 1px solid rgba(148, 160, 184, 0.28);
      background: rgba(15, 24, 42, 0.45);
      color: #e2e7f0;
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.06);
    }

    .primary-btn {
      background: linear-gradient(135deg, #5eead4 0%, #34d399 42%, #10b981 100%);
      color: #04150f;
      box-shadow: 0 18px 30px rgba(16, 185, 129, 0.35);
      position: relative;
      overflow: hidden;
    }

    .primary-btn::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(110deg, transparent 25%, rgba(255, 255, 255, 0.22), transparent 65%);
      transform: translateX(-120%);
      transition: transform 0.55s ease;
    }

    .primary-btn:hover::after {
      transform: translateX(120%);
    }

    .ghost-btn:hover,
    .primary-btn:hover {
      transform: translateY(-2px);
    }

    .ghost-btn:hover {
      border-color: rgba(59, 130, 246, 0.62);
      box-shadow: 0 12px 24px rgba(2, 9, 23, 0.25);
    }

    .hero {
      display: grid;
      grid-template-columns: 1.05fr 0.95fr;
      gap: 42px;
      min-height: calc(100vh - 112px);
      padding-top: 28px;
      padding-bottom: 44px;
      align-items: center;
    }

    .hero-content {
      animation: revealLeft 0.85s 0.12s ease both;
    }

    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 14px;
      border-radius: 999px;
      color: #d1fae5;
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(110, 231, 183, 0.26);
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      box-shadow: 0 0 0 5px rgba(16, 185, 129, 0.04);
    }

    .hero h1 {
      margin: 22px 0 18px;
      font-size: clamp(2.8rem, 5vw, 5rem);
      line-height: 0.96;
      letter-spacing: -0.06em;
      color: #e0f2fe;
      text-wrap: balance;
    }

    .hero h1 .highlight {
      display: block;
      background: linear-gradient(135deg, #7dd3fc 0%, #93c5fd 38%, #bfdbfe 100%);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }

    .hero-copy {
      color: #dbeafe;
      font-size: 1.08rem;
      line-height: 1.8;
      max-width: 680px;
      text-wrap: pretty;
    }

    .hero-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      margin-top: 30px;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(120px, 1fr));
      gap: 16px;
      margin-top: 30px;
    }

    .stat-box {
      background: rgba(15, 24, 42, 0.6);
      border: 1px solid rgba(148, 160, 184, 0.14);
      border-radius: 18px;
      padding: 18px 16px;
      backdrop-filter: blur(9px);
      transition: transform 0.25s ease, border-color 0.25s ease, background 0.25s ease;
    }

    .stat-box:hover {
      transform: translateY(-5px);
      border-color: rgba(59, 130, 246, 0.42);
      background: rgba(28, 39, 61, 0.72);
    }

    .stat-box strong {
      display: block;
      font-size: 1.6rem;
      color: #e0f2fe;
      margin-bottom: 4px;
    }

    .stat-box span {
      color: #bfdbfe;
      font-size: 0.78rem;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .visual-card {
      position: relative;
      padding: 16px;
      border-radius: 30px;
      background: linear-gradient(180deg, rgba(15, 24, 42, 0.8), rgba(15, 24, 42, 0.95));
      border: 1px solid rgba(148, 160, 184, 0.16);
      box-shadow: 0 30px 70px rgba(15, 24, 42, 0.62);
      animation: floatCard 6s ease-in-out infinite;
      animation-delay: 0.35s;
      animation-fill-mode: both;
    }

    .visual-frame {
      position: relative;
      overflow: hidden;
      border-radius: 24px;
      min-height: min(660px, 72vh);
      border: 1px solid rgba(148, 160, 184, 0.08);
      background: linear-gradient(145deg, #e2e8f0, #f8fafc);
      animation: campusZoom 12s ease-in-out infinite alternate;
    }

    .hero-logo-center {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      z-index: 1;
      pointer-events: none;
    }

    .hero-logo-center::before {
      content: '';
      position: absolute;
      width: 210px;
      height: 210px;
      border: 1px solid rgba(110, 231, 183, 0.52);
      border-radius: 50%;
      box-shadow: 0 0 0 18px rgba(16, 185, 129, 0.08), 0 0 70px rgba(16, 185, 129, 0.3);
      animation: logoOrbit 5s ease-in-out infinite;
    }

    .hero-logo-badge {
      width: 148px;
      height: 148px;
      padding: 10px;
      display: grid;
      place-items: center;
      border: 2px solid rgba(52, 211, 153, 0.82);
      border-radius: 28px;
      background: rgba(2, 9, 23, 0.72);
      box-shadow: 0 20px 70px rgba(2, 9, 23, 0.64);
      color: #a7f3d0;
      animation: logoFloat 4s ease-in-out infinite;
    }

    .hero-mau-logo {
      width: 100%;
      height: 100%;
      object-fit: contain;
      border-radius: 18px;
    }

    .mini-panel {
      position: absolute;
      left: 26px;
      bottom: 26px;
      width: min(260px, 72%);
      background: rgba(15, 24, 42, 0.75);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(148, 160, 184, 0.18);
      border-radius: 18px;
      padding: 18px 16px;
      box-shadow: 0 18px 30px rgba(15, 24, 42, 0.45);
      animation: revealUp 0.8s 0.65s ease both;
    }

    .mini-panel-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 10px;
      color: #e2e7f0;
      font-weight: 700;
      font-size: 0.9rem;
    }

    .mini-panel-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      color: #cbd2e1;
      font-size: 0.8rem;
      margin-top: 8px;
    }

    .mini-pill {
      padding: 4px 8px;
      border-radius: 999px;
      background: rgba(34, 88, 197, 0.12);
      color: #86efac;
      border: 1px solid rgba(74, 222, 128, 0.2);
      font-size: 0.7rem;
      font-weight: 700;
    }

    .feature-section,
    .project-section,
    .contact-section {
      margin: 72px -32px 0;
      padding: 48px 32px 32px;
      border-top: 1px solid rgba(148, 160, 184, 0.22);
      scroll-margin-top: 24px;
    }

    .feature-section {
      background: linear-gradient(110deg, rgba(14, 57, 144, 0.12), transparent 72%);
    }

    .project-section {
      background: linear-gradient(110deg, rgba(22, 48, 101, 0.12), transparent 72%);
    }

    .contact-section {
      margin-top: 28px;
      padding-top: 24px;
      padding-bottom: 20px;
      background: linear-gradient(110deg, rgba(9, 66, 180, 0.12), transparent 72%);
    }

    .contact-section .section-heading {
      margin-bottom: 14px;
    }

    .contact-section .section-heading h3 {
      font-size: clamp(1.65rem, 2.5vw, 2.2rem);
    }

    .hero {
      scroll-margin-top: 24px;
    }

    .section-heading {
      display: flex;
      align-items: end;
      justify-content: space-between;
      gap: 20px;
      margin-bottom: 26px;
    }

    .section-heading h3 {
      margin: 0;
      font-size: clamp(2rem, 3vw, 2.8rem);
      letter-spacing: -0.05em;
      color: #f8f9fc;
    }

    .section-heading p {
      max-width: 600px;
      color: #94a0b8;
      line-height: 1.7;
      margin: 0;
    }

    .feature-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 22px;
    }

    .feature-card {
      padding: 22px 18px 18px;
      border-radius: 22px;
      border: 1px solid rgba(148, 160, 184, 0.14);
      background: rgba(15, 24, 42, 0.62);
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.02);
      transition: transform 0.2s ease, border-color 0.2s ease;
      position: relative;
      overflow: hidden;
    }

    .feature-card::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      width: 100%;
      height: 3px;
      background: linear-gradient(90deg, #1c64f3, #3b79f5);
      transform: scaleX(0);
      transform-origin: left;
      transition: transform 0.3s ease;
    }

    .feature-card:hover {
      transform: translateY(-4px);
      border-color: rgba(96, 147, 250, 0.45);
      box-shadow: 0 18px 36px rgba(2, 9, 23, 0.28);
    }

    .feature-card:hover::before {
      transform: scaleX(1);
    }

    .icon-box {
      width: 56px;
      height: 56px;
      border-radius: 16px;
      display: grid;
      place-items: center;
      background: linear-gradient(135deg, rgba(60, 122, 245,0.18), rgba(99, 146, 241,0.12));
      border: 1px solid rgba(147, 182, 253, 0.24);
      color: #bfd4fe;
      margin-bottom: 18px;
      transition: transform 0.25s ease, background 0.25s ease;
    }

    .feature-card:hover .icon-box,
    .contact-card:hover .icon-box {
      transform: rotate(-5deg) scale(1.06);
      background: linear-gradient(135deg, rgba(28, 100, 243,0.24), rgba(60, 122, 245,0.2));
    }

    .feature-card h4 {
      margin: 0 0 8px;
      color: #f8f9fc;
      font-size: 1.1rem;
    }

    .feature-card p {
      margin: 0;
      color: #94a0b8;
      line-height: 1.7;
      font-size: 0.96rem;
    }

    .project-wrap {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 28px;
      align-items: center;
      padding: 26px 0 0;
      perspective: 1200px;
    }

    .project-box {
      border-radius: 28px;
      background: rgba(15, 24, 42, 0.66);
      border: 1px solid rgba(148, 160, 184, 0.16);
      padding: 28px;
      box-shadow: 0 18px 40px rgba(2, 9, 23, 0.25);
      position: relative;
      overflow: hidden;
      animation: revealLeft 0.8s 0.12s ease both;
    }

    .project-box::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 5px;
      height: 100%;
      background: linear-gradient(180deg, #1c64f3, #3b79f5);
      box-shadow: 0 0 28px rgba(59, 130, 246, 0.32);
    }

    .project-box p {
      color: #cbd2e1;
      line-height: 1.8;
      font-size: 1.02rem;
    }

    .check-list {
      list-style: none;
      padding: 0;
      margin: 18px 0 0;
      display: grid;
      gap: 12px;
    }

    .check-list li {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 0.96rem;
      color: #e2e7f0;
    }

    .project-visual {
      min-height: 340px;
      border-radius: 28px;
      overflow: hidden;
      position: relative;
      background: #0f182a;
      border: 1px solid rgba(148, 160, 184, 0.16);
      box-shadow: 0 18px 40px rgba(2, 9, 23, 0.28);
      animation: revealRight 0.9s 0.25s ease both;
      transform-style: preserve-3d;
    }

    .project-photo {
      position: absolute;
      inset: 0;
      z-index: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center 38%;
      animation: projectPhotoMotion 5.5s ease-out both;
    }

    .project-photo-control {
      position: absolute;
      top: 16px;
      z-index: 3;
      width: 38px;
      height: 38px;
      display: grid;
      place-items: center;
      border: 1px solid rgba(226, 231, 240, 0.45);
      border-radius: 50%;
      background: rgba(15, 24, 42, 0.72);
      color: #f8f9fc;
      cursor: pointer;
      transition: background 0.2s ease, transform 0.2s ease;
    }

    .project-photo-control:hover {
      background: rgba(37, 103, 235, 0.88);
      transform: scale(1.06);
    }

    .project-photo-prev { right: 62px; }
    .project-photo-next { right: 16px; }

    .project-visual::before {
      content: '';
      position: absolute;
      inset: 12px;
      border: 1px solid rgba(59, 130, 246, 0.42);
      border-radius: 20px;
      z-index: 2;
      pointer-events: none;
      animation: framePulse 4s ease-in-out infinite;
    }

    .project-visual::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgba(15, 24, 42, 0.1), rgba(15, 24, 42, 0.72));
      z-index: 1;
      pointer-events: none;
    }

    .project-tag {
      position: absolute;
      left: 24px;
      bottom: 24px;
      z-index: 3;
      background: rgba(15, 24, 42, 0.76);
      border: 1px solid rgba(148, 160, 184, 0.14);
      border-radius: 14px;
      padding: 14px 16px;
      color: #f8f9fc;
      max-width: 220px;
      backdrop-filter: blur(8px);
      animation: badgeFloat 4.5s ease-in-out infinite;
    }

    .project-tag::after {
      content: 'MAU';
      position: absolute;
      right: 12px;
      top: 10px;
      color: rgba(147, 197, 253, 0.9);
      font-size: 0.62rem;
      font-weight: 900;
      letter-spacing: 0.12em;
    }

    .project-tag strong {
      display: block;
      font-size: 0.8rem;
      letter-spacing: 0.08em;
      color: #93b6fd;
      text-transform: uppercase;
      margin-bottom: 6px;
    }

    .contact-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }

    .contact-card {
      padding: 14px 16px;
      border-radius: 14px;
      background: rgba(15, 24, 42, 0.64);
      border: 1px solid rgba(148, 160, 184, 0.15);
      transition: transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease;
    }

    .contact-card:hover {
      transform: translateY(-2px);
      border-color: rgba(59, 130, 246, 0.42);
      box-shadow: 0 8px 18px rgba(2, 9, 23, 0.12);
    }

    .contact-card .icon-box {
      width: 34px;
      height: 34px;
      margin-bottom: 8px;
      border-radius: 10px;
    }

    .contact-card h4 {
      font-size: 0.92rem;
      margin: 0 0 4px;
      color: #f8f9fc;
    }

    .contact-card p,
    .contact-card a {
      margin: 0;
      color: #cbd2e1;
      text-decoration: none;
      line-height: 1.45;
      font-size: 0.82rem;
    }

    .contact-card a {
      display: block;
      overflow-wrap: anywhere;
    }

    .contact-card a + a {
      margin-top: 3px;
    }

    .contact-form-wrap {
      width: 100%;
      max-width: 640px;
      margin: 24px auto 0;
      padding: 30px 32px 32px;
      border-radius: 20px;
      border: 1px solid #E2E8F0;
      background: #FFFFFF;
      box-shadow: 0 14px 36px rgba(15, 23, 42, 0.07);
    }

    .contact-form-eyebrow {
      margin: 0 0 7px;
      color: #1683A8;
      font-size: 0.68rem;
      font-weight: 800;
      letter-spacing: 0.12em;
    }

    .contact-form-wrap h4 {
      margin: 0;
      font-size: clamp(1.55rem, 3vw, 1.85rem);
      color: #0F172A;
      letter-spacing: -0.04em;
    }

    .contact-form-description {
      margin: 8px 0 24px;
      color: #64748B;
      font-size: 0.88rem;
      line-height: 1.55;
    }

    .contact-form-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px 14px;
    }

    .contact-form-grid label {
      display: flex;
      flex-direction: column;
      gap: 7px;
      color: #334155;
      font-size: 0.78rem;
      font-weight: 700;
    }

    .contact-form-grid .contact-form-message {
      grid-column: 1 / -1;
    }

    .contact-form-grid input,
    .contact-form-grid textarea {
      width: 100%;
      border: 1px solid #CBD5E1;
      border-radius: 9px;
      background: #FFFFFF;
      color: #0F172A;
      padding: 0.65rem 0.75rem;
      font-size: 0.86rem;
      transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
      box-sizing: border-box;
    }

    .contact-form-grid input {
      height: 42px;
    }

    .contact-form-grid textarea {
      height: 140px;
      min-height: 120px;
      resize: vertical;
      line-height: 1.45;
    }

    .contact-form-grid input::placeholder,
    .contact-form-grid textarea::placeholder {
      color: #94A3B8;
    }

    .contact-form-hint {
      display: block;
      margin-top: 1px;
      color: #64748B;
      font-size: 0.7rem;
      font-weight: 400;
    }

    .contact-form-grid input:focus,
    .contact-form-grid textarea:focus {
      outline: none;
      border-color: #1E3A8A;
      box-shadow: 0 0 0 3px rgba(30, 58, 138, 0.1);
      background: #FFFFFF;
    }

    .contact-form-grid input[aria-invalid='true'],
    .contact-form-grid textarea[aria-invalid='true'] {
      border-color: #DC2626;
      box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.08);
    }

    .field-error {
      display: block;
      color: #B91C1C;
      font-size: 0.78rem;
      font-weight: 500;
      margin-top: 2px;
    }

    .contact-form-alert {
      margin: 10px 0 0;
      padding: 0.55rem 0.75rem;
      border-radius: 8px;
      font-size: 0.82rem;
      line-height: 1.45;
    }

    .contact-form-alert.success {
      background: #ECFDF5;
      border: 1px solid #A7F3D0;
      color: #065F46;
    }

    .contact-form-alert.error {
      background: #FEF2F2;
      border: 1px solid #FECACA;
      color: #991B1B;
    }

    .contact-form-alert.warning {
      background: #FFFBEB;
      border: 1px solid #FDE68A;
      color: #92400E;
    }

    .contact-form-submit {
      display: flex;
      justify-content: flex-start;
      margin-top: 16px;
    }

    .contact-form-submit button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      border: none;
      border-radius: 9px;
      padding: 0.72rem 1.1rem;
      background: linear-gradient(135deg, #168EBB, #1476B8);
      color: #FFFFFF;
      font-weight: 700;
      font-size: 0.86rem;
      cursor: pointer;
      box-shadow: 0 7px 16px rgba(20, 118, 184, 0.2);
      transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
    }

    .contact-form-submit button:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 9px 20px rgba(20, 118, 184, 0.26);
    }

    .contact-form-submit button:disabled {
      opacity: 0.72;
      cursor: wait;
    }

    .spin {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .site-footer {
      margin-top: 80px;
      border-top: 1px solid rgba(148, 160, 184, 0.16);
      padding-top: 28px;
    }

    .footer-inner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      flex-wrap: wrap;
      padding-bottom: 24px;
    }

    .footer-links {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-wrap: wrap;
      gap: 18px;
      color: #cbd2e1;
    }

    .footer-links a {
      color: #cbd2e1;
      text-decoration: none;
      transition: color 0.2s ease;
    }

    .footer-links a:hover {
      color: #93C5FD;
    }

    .footer-copy {
      color: #94a0b8;
      text-align: right;
      line-height: 1.6;
      font-size: 0.92rem;
    }

    @keyframes glow {
      0% { box-shadow: 0 12px 24px rgba(99, 146, 241, 0.38); }
      100% { box-shadow: 0 18px 34px rgba(96, 147, 250, 0.52); }
    }

    @keyframes logoShine {
      0%, 55% { transform: translateX(-70%) rotate(18deg); }
      75%, 100% { transform: translateX(70%) rotate(18deg); }
    }

    @keyframes revealDown {
      from { opacity: 0; transform: translateY(-18px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes revealLeft {
      from { opacity: 0; transform: translateX(-24px); }
      to { opacity: 1; transform: translateX(0); }
    }

    @keyframes revealUp {
      from { opacity: 0; transform: translateY(18px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes revealRight {
      from { opacity: 0; transform: translateX(24px) rotateY(-5deg); }
      to { opacity: 1; transform: translateX(0) rotateY(0); }
    }

    @keyframes framePulse {
      0%, 100% { opacity: 0.38; transform: scale(1); }
      50% { opacity: 0.9; transform: scale(1.015); }
    }

    @keyframes badgeFloat {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-8px); }
    }

    @keyframes floatCard {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-8px); }
    }

    @keyframes campusZoom {
      0% { background-position: center center; transform: scale(1); }
      100% { background-position: 54% 46%; transform: scale(1.035); }
    }

    @keyframes logoFloat {
      0%, 100% { transform: translateY(0) rotate(-2deg); }
      50% { transform: translateY(-10px) rotate(2deg); }
    }

    @keyframes brandFloat {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-3px); }
    }

    @keyframes logoOrbit {
      0%, 100% { transform: scale(0.96); opacity: 0.58; }
      50% { transform: scale(1.08); opacity: 1; }
    }

    @keyframes projectPhotoMotion {
      from { opacity: 0.55; transform: scale(1.08); }
      to { opacity: 1; transform: scale(1); }
    }

    @keyframes homeBackgroundCycle {
      0%, 12% { opacity: 1; transform: scale(1.04); }
      17%, 100% { opacity: 0; transform: scale(1.12); }
    }

    @media (max-width: 980px) {
      .hero,
      .project-wrap,
      .feature-grid,
      .contact-grid {
        grid-template-columns: 1fr 1fr;
      }

      .hero {
        grid-template-columns: 1fr;
      }

      .feature-grid,
      .contact-grid {
        grid-template-columns: 1fr 1fr;
      }
    }

    @media (max-width: 760px) {
      .home-header {
        flex-wrap: wrap;
        justify-content: center;
      }

      .nav-links {
        width: 100%;
        justify-content: center;
        order: 3;
        gap: 14px;
        font-size: 0.82rem;
      }

      .hero {
        padding-top: 52px;
        min-height: auto;
      }

      .section-heading {
        flex-direction: column;
        align-items: flex-start;
      }

      .feature-grid,
      .contact-grid,
      .project-wrap {
        grid-template-columns: 1fr;
      }

      .stats-grid {
        grid-template-columns: 1fr;
      }

      .header-actions {
        width: 100%;
        justify-content: center;
      }

      .header-actions a {
        flex: 1;
      }

      .home-inner {
        padding-left: 16px;
        padding-right: 16px;
      }

      .feature-section,
      .project-section,
      .contact-section {
        margin-left: -16px;
        margin-right: -16px;
        padding-left: 16px;
        padding-right: 16px;
      }

      .visual-frame {
        min-height: 420px;
      }

      .contact-form-grid { grid-template-columns: 1fr; }
      .contact-form-wrap { padding: 24px 20px; }
    }

    .home-shell { background: #FFFFFF; color: #0F172A; }
    .home-header { background: #83CDE3; border-color: #6CB9D1; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08); }
    .brand-copy h2 { color: #0F172A; }
    .brand-copy small { color: #475569; }
    .nav-links, .nav-links a { color: #334155; }
    .nav-links a:hover, .nav-links a.active { color: #1E3A8A; }
    .nav-links a::after { background: #1E3A8A; }
    .ghost-btn, .primary-btn {
      min-height: 48px;
      border-radius: 6px;
      padding: 0 18px;
      font-size: 0.9375rem;
      box-shadow: none;
    }
    .ghost-btn { border: 1px solid #1E3A8A; background: #FFFFFF; color: #1E3A8A; }
    .ghost-btn:hover { border-color: #1E40AF; background: #EFF6FF; box-shadow: none; }
    .primary-btn { background: #1E3A8A; color: #FFFFFF; }
    .primary-btn:hover { background: #1E40AF; }
    .hero h1 { color: #0F172A; }
    .hero h1 .highlight {
      background: none;
      -webkit-background-clip: initial;
      background-clip: initial;
      -webkit-text-fill-color: #1E3A8A;
      color: #1E3A8A;
    }
    .hero-copy { color: #334155; }
    .eyebrow { color: #166534; background: #F0FDF4; border-color: #BBF7D0; box-shadow: none; }
    .stats-grid .stat-box { background: #FFFFFF; border-color: #E2E8F0; box-shadow: 0 4px 14px rgba(15, 23, 42, 0.05); }
    .stat-box strong { color: #1E3A8A; }
    .stat-box span { color: #475569; }
    .visual-card { background: #FFFFFF; border-color: #E2E8F0; box-shadow: 0 18px 42px rgba(15, 23, 42, 0.12); }
    .section-heading h3 { color: #0F172A; }
    .section-heading p, .feature-card p { color: #475569; }
    .feature-section, .project-section, .contact-section { background: #F8FAFC; border-color: #E2E8F0; }
    .feature-card, .contact-card { background: #FFFFFF; border-color: #E2E8F0; box-shadow: 0 4px 14px rgba(15, 23, 42, 0.05); }
    .feature-card h4, .contact-card h4 { color: #0F172A; }
    .icon-box { background: #EFF6FF; border-color: #BFDBFE; color: #1E3A8A; }
    .feature-card:hover .icon-box, .contact-card:hover .icon-box { background: #DBEAFE; }
    .project-box { background: #FFFFFF; border-color: #E2E8F0; box-shadow: 0 12px 28px rgba(15, 23, 42, 0.08); }
    .project-box p, .contact-card p, .contact-card a { color: #475569; }
    .check-list li { color: #334155; }
    .site-footer { border-color: #E2E8F0; }
    .footer-links, .footer-links a { color: #475569; }
    .footer-links a:hover { color: #1E3A8A; }
    .footer-copy { color: #475569; }

    .home-shell.landing-page {
      background: #87CEEB;
    }

  `;

  return (
    <>
      <style>{styles}</style>

      <div ref={page === 'home' ? landingRef : undefined} className={`home-shell${page === 'home' ? ' landing-page' : ''}${page === 'features' ? ' features-page' : ''}${page === 'project' ? ' project-page' : ''}${page === 'contact' ? ' contact-page' : ''}`}>
        <div className={`home-inner${page === 'home' ? ' landing-inner' : ''}`}>
          {page !== 'home' && <PageBackButton fallback="/" />}
          <header className={`home-header${page === 'home' ? ' landing-header' : ''}`}>
            <div className="brand-wrap">
              <div className="brand-logo" aria-label="Mekdela Amba University logo">
                <img className="brand-logo-image" src="/mau-logo.png" alt="Mekdela Amba University logo" />
              </div>
              <div className="brand-copy">
                <h2>Mekdela Amba University</h2>
                <small>Smart Attendance Management System</small>
              </div>
            </div>

            <nav
              className={`nav-links${page === 'home' ? ` landing-nav${mobileMenuOpen ? ' is-open' : ''}` : ''}`}
              aria-label="Main navigation"
              id="landing-navigation"
            >
              {page === 'home' ? <>
                <a href="#home" onClick={() => setMobileMenuOpen(false)} className="active">Home</a>
                <a href="#about" onClick={() => setMobileMenuOpen(false)}>About</a>
                <a href="#features" onClick={() => setMobileMenuOpen(false)}>Features</a>
                <a href="#contact" onClick={() => setMobileMenuOpen(false)}>Contact</a>
              </> : <>
                <Link to="/" onClick={() => setMobileMenuOpen(false)}>Home</Link>
                <Link to="/features" onClick={() => setMobileMenuOpen(false)} className={page === 'features' ? 'active' : ''}>Features</Link>
                <Link to="/project" onClick={() => setMobileMenuOpen(false)} className={page === 'project' ? 'active' : ''}>Project</Link>
                <Link to="/contact" onClick={() => setMobileMenuOpen(false)} className={page === 'contact' ? 'active' : ''}>Contact</Link>
              </>}
            </nav>

            <div className={`header-actions${page === 'home' ? ' landing-header-actions' : ''}`}>
              <Link to="/login" className="ghost-btn">Login</Link>
            </div>
            {page === 'home' && (
              <button
                type="button"
                className="landing-menu-toggle"
                aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
                aria-controls="landing-navigation"
                aria-expanded={mobileMenuOpen}
                onClick={() => setMobileMenuOpen(open => !open)}
              >
                {mobileMenuOpen ? <X size={21} /> : <Menu size={21} />}
              </button>
            )}
          </header>

          {page === 'home' && <>
            <main className="hero landing-hero" id="home">
              <div className="hero-content landing-hero-content">
                <span className="eyebrow landing-eyebrow">
                  <Sparkles size={14} aria-hidden="true" /> MEKDELA AMBA UNIVERSITY
                </span>

                <h1>
                  WELCOME TO MAU SMART ATTENDANCE SYSTEM
                </h1>

                <p className="hero-copy">
                  Smart, Secure and Efficient Attendance Management for Mekdela Amba University.
                </p>

                <div className="hero-actions landing-hero-actions">
                  <Link to="/login" className="primary-btn landing-primary-btn">
                    GET STARTED <ArrowRight size={17} aria-hidden="true" />
                  </Link>
                  <a href="#about" className="landing-secondary-btn">
                    LEARN MORE <ArrowUpRight size={17} aria-hidden="true" />
                  </a>
                </div>

                <div className="landing-trust-line" aria-label="Secure, transparent, and efficient">
                  <span><ShieldCheck size={16} aria-hidden="true" /> Secure</span>
                  <i aria-hidden="true" />
                  <span><CheckCircle2 size={16} aria-hidden="true" /> Transparent</span>
                  <i aria-hidden="true" />
                  <span><Sparkles size={16} aria-hidden="true" /> Efficient</span>
                </div>
              </div>

              <div className="visual-card landing-dashboard">
                <div className="landing-dashboard-top">
                  <div className="landing-dashboard-brand">
                    <img src="/mau-logo.png" alt="" />
                    <span><strong>Smart Workforce</strong><small>Attendance dashboard</small></span>
                  </div>
                  <span className="landing-preview-tag"><span /> Preview</span>
                </div>

                <div className="landing-dashboard-content">
                  <div className="landing-overview-heading">
                    <div>
                      <span className="landing-dashboard-kicker">WORKFORCE SNAPSHOT</span>
                      <h2>Attendance overview</h2>
                    </div>
                    <span className="landing-period-tag">Today</span>
                  </div>

                  <div className="landing-kpi-grid">
                    <article className="landing-kpi-card">
                      <span className="landing-kpi-icon landing-kpi-blue"><Users size={17} /></span>
                      <span className="landing-kpi-label">Present staff</span>
                      <strong>216</strong>
                      <small><span className="landing-positive">+8.2%</span> vs. prior period</small>
                    </article>
                    <article className="landing-kpi-card">
                      <span className="landing-kpi-icon landing-kpi-amber"><Clock3 size={17} /></span>
                      <span className="landing-kpi-label">Late arrivals</span>
                      <strong>12</strong>
                      <small>Across all departments</small>
                    </article>
                  </div>

                  <div className="landing-dashboard-lower">
                    <section className="landing-department-card" aria-label="Illustrative department attendance">
                      <div className="landing-card-heading"><strong>Department attendance</strong><span>Sample</span></div>
                      <div className="landing-progress-row">
                        <span>Administration</span><strong>92%</strong>
                        <div className="landing-progress-track"><i style={{ width: '92%' }} /></div>
                      </div>
                      <div className="landing-progress-row">
                        <span>Academic Affairs</span><strong>86%</strong>
                        <div className="landing-progress-track"><i style={{ width: '86%' }} /></div>
                      </div>
                      <div className="landing-progress-row">
                        <span>Student Services</span><strong>78%</strong>
                        <div className="landing-progress-track"><i style={{ width: '78%' }} /></div>
                      </div>
                    </section>

                    <section className="landing-trend-card" aria-label="Illustrative attendance trend chart">
                      <div className="landing-card-heading"><strong>Attendance trend</strong><span>Sample</span></div>
                      <div className="landing-chart-value">89.4% <small>sample rate</small></div>
                      <svg className="landing-trend-chart" viewBox="0 0 240 76" role="img" aria-label="Illustrative upward attendance trend">
                        <defs>
                          <linearGradient id="attendance-chart-fill" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="#83CDE0" stopOpacity=".3" />
                            <stop offset="100%" stopColor="#83CDE0" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        <path d="M0 61 C20 52 23 43 42 48 S67 57 82 39 S108 43 123 32 S148 39 164 26 S189 31 204 17 S226 18 240 7 V76 H0Z" fill="url(#attendance-chart-fill)" />
                        <path d="M0 61 C20 52 23 43 42 48 S67 57 82 39 S108 43 123 32 S148 39 164 26 S189 31 204 17 S226 18 240 7" fill="none" stroke="#23469B" strokeWidth="3" strokeLinecap="round" />
                        <circle cx="240" cy="7" r="4" fill="#20A875" stroke="white" strokeWidth="2" />
                      </svg>
                      <div className="landing-chart-labels"><span>Mon</span><span>Wed</span><span>Fri</span><span>Sun</span></div>
                    </section>
                  </div>
                  <p className="landing-demo-note"><Sparkles size={13} aria-hidden="true" /> Illustrative preview only — not live university data.</p>
                </div>
              </div>
            </main>

            <section className="landing-about" id="about" aria-labelledby="landing-about-title">
              <div className="landing-about-mark" aria-hidden="true"><img src="/mau-logo.png" alt="" /></div>
              <div className="landing-about-copy reveal-on-scroll">
                <span className="landing-section-eyebrow">ABOUT THE SYSTEM</span>
                <h2 id="landing-about-title">A better way to support the people who move our university forward.</h2>
                <p>MAU Smart Attendance brings secure attendance, employee records, leave workflows, and useful reporting together for Mekdela Amba University. Authorized employees, HR teams, and administrators can work from one clear, dependable system.</p>
              </div>
              <div className="landing-about-note"><ShieldCheck size={20} aria-hidden="true" /><span>Secure by design<br /><strong>Built for university teams</strong></span></div>
            </section>

            <section className="landing-capabilities" aria-label="System capabilities">
              <div><strong>Role-based access</strong><span>Tools for each authorized role</span></div>
              <i aria-hidden="true" />
              <div><strong>Flexible reporting</strong><span>Daily through yearly summaries</span></div>
              <i aria-hidden="true" />
              <div><strong>University-wide view</strong><span>Attendance across departments</span></div>
            </section>

            <section className="landing-section landing-features" id="features" aria-labelledby="landing-features-title">
              <div className="landing-section-heading">
                <span className="landing-section-eyebrow">BUILT FOR YOUR WORKFLOW</span>
                <h2 id="landing-features-title">Everything your team needs to stay in sync</h2>
                <p>Purposeful tools to support transparent attendance and smooth day-to-day workforce operations.</p>
              </div>
              <div className="landing-feature-grid">
                {landingFeatures.map(({ icon: FeatureIcon, title, description }) => (
                  <article className="landing-feature-card reveal-on-scroll" key={title}>
                    <span className="landing-feature-icon"><FeatureIcon size={21} aria-hidden="true" /></span>
                    <h3>{title}</h3>
                    <p>{description}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="landing-workflow" aria-labelledby="landing-workflow-title">
              <div className="landing-section-heading">
                <span className="landing-section-eyebrow">SIMPLE BY DESIGN</span>
                <h2 id="landing-workflow-title">A clearer way to manage attendance</h2>
                <p>From secure access to useful reports, the workflow stays straightforward.</p>
              </div>
              <div className="landing-step-grid">
                {workflowSteps.map(({ number, title, description, icon: StepIcon }) => (
                  <article className="landing-step-card reveal-on-scroll" key={number}>
                    <div className="landing-step-top"><span>{number}</span><StepIcon size={20} aria-hidden="true" /></div>
                    <h3>{title}</h3>
                    <p>{description}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="landing-insights" aria-label="Illustrative system insights">
              <div className="landing-insights-copy">
                <span className="landing-section-eyebrow">A TRUSTED DAILY WORKFLOW</span>
                <h2>Clarity for every department.</h2>
                <p>Bring attendance tracking, team oversight, and reporting together in one secure workspace.</p>
              </div>
              <div className="landing-insight-stat"><strong>3</strong><span>access roles</span></div>
              <div className="landing-insight-stat"><strong>5</strong><span>reporting periods</span></div>
              <p className="landing-insights-note">System capabilities shown; no live statistics displayed.</p>
            </section>

            <section className="landing-cta" aria-labelledby="landing-cta-title">
              <div>
                <span className="landing-section-eyebrow">MEKDELA AMBA UNIVERSITY</span>
                <h2 id="landing-cta-title">Ready to get started?</h2>
                <p>Sign in to access your Smart Workforce tools and attendance workspace.</p>
              </div>
              <Link to="/login" className="primary-btn landing-primary-btn">
                Access your account <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </section>

            <section className="landing-contact" id="contact" aria-labelledby="landing-contact-title">
              <div className="landing-contact-intro">
                <span className="landing-section-eyebrow">GET IN TOUCH</span>
                <h2 id="landing-contact-title">Contact Mekdela Amba University</h2>
                <p>For university information or assistance with the attendance system, contact the university team.</p>
              </div>
              <div className="landing-contact-details">
                <a href="mailto:mauinfo@mkau.edu.et"><Mail size={18} aria-hidden="true" /><span>Email<strong>mauinfo@mkau.edu.et</strong></span></a>
                <a href="tel:+251332405111"><PhoneCall size={18} aria-hidden="true" /><span>Telephone<strong>+251 332405111</strong></span></a>
                <div><MapPin size={18} aria-hidden="true" /><span>Location<strong>Gimba, Amhara, Ethiopia</strong></span></div>
                <Link to="/contact" className="landing-contact-form-link">Send a message <ArrowRight size={16} aria-hidden="true" /></Link>
              </div>
            </section>
          </>}

          {page === 'features' && <section className="feature-section" id="features">
            <div className="section-heading">
              <h3>Built for operational clarity</h3>
              <p>
                Every feature is designed to make staff attendance easier to manage, easier to verify,
                and easier to report across teams and departments.
              </p>
            </div>

            <div className="feature-grid">
              <article className="feature-card">
                <div className="icon-box">
                  <Clock3 size={24} />
                </div>
                <h4>Department attendance</h4>
                <p>Track employee attendance by department with daily, weekly, monthly, quarterly, and yearly oversight.</p>
              </article>

              <article className="feature-card">
                <div className="icon-box">
                  <ShieldCheck size={24} />
                </div>
                <h4>Admin control</h4>
                <p>Administrators can manage all employees, update settings, and control workforce workflows securely.</p>
              </article>

              <article className="feature-card">
                <div className="icon-box">
                  <Users size={24} />
                </div>
                <h4>Messages & notifications</h4>
                <p>Send updates, reminders, and alerts to employees and departments from one central control point.</p>
              </article>

              <article className="feature-card">
                <div className="icon-box">
                  <CheckCircle2 size={24} />
                </div>
                <h4>Export & certificates</h4>
                <p>Download attendance records in Excel or PDF and generate recognition or completion certificates.</p>
              </article>
            </div>
          </section>}

          {page === 'project' && <main className="project-showcase" id="project">
            <header className="project-page-heading">
              <span className="project-maU-badge">
                <img src="/mau-logo.png" alt="" />
                <span>MEKDELA AMBA UNIVERSITY</span>
              </span>
              <h1>About Our Project</h1>
              <p>Transforming university workforce management through smart digital attendance.</p>
            </header>

            <section className="project-overview-grid" aria-labelledby="project-overview-title">
              <article className="project-information-card">
                <span className="project-card-eyebrow">THE PLATFORM</span>
                <h2 id="project-overview-title">Smart Workforce Attendance System</h2>
                <p className="project-overview-description">
                  Designed for Mekdela Amba University, the system helps manage employee attendance, departments,
                  reports, notifications, and attendance compliance in one secure digital workspace.
                </p>

                <h3 className="project-capabilities-title">What the system supports</h3>
                <ul className="project-capabilities-list">
                  {projectCapabilities.map(({ icon: CapabilityIcon, title, description }) => (
                    <li key={title}>
                      <span className="project-capability-icon"><CapabilityIcon size={18} aria-hidden="true" /></span>
                      <span className="project-capability-copy">
                        <strong>{title}</strong>
                        <small>{description}</small>
                      </span>
                    </li>
                  ))}
                </ul>
              </article>

            </section>

            <section className="project-highlights" aria-labelledby="project-highlights-title">
              <div className="project-section-heading">
                <span className="project-card-eyebrow">BUILT AROUND YOUR NEEDS</span>
                <h2 id="project-highlights-title">Key Project Highlights</h2>
                <p>Practical tools to support consistent attendance and informed workforce management.</p>
              </div>
              <div className="project-highlight-grid">
                {projectHighlights.map(({ icon: HighlightIcon, title, description }) => (
                  <article className="project-highlight-card" key={title}>
                    <span className="project-highlight-icon"><HighlightIcon size={20} aria-hidden="true" /></span>
                    <h3>{title}</h3>
                    <p>{description}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="project-process" aria-labelledby="project-process-title">
              <div className="project-section-heading">
                <span className="project-card-eyebrow">A CLEAR WORKFLOW</span>
                <h2 id="project-process-title">How the System Works</h2>
                <p>Connected steps help teams move from secure access to useful attendance insights.</p>
              </div>
              <ol className="project-process-grid">
                {projectWorkflow.map(({ icon: StepIcon, title, description }, index) => (
                  <li className="project-process-step" key={title}>
                    <span className="project-process-number">0{index + 1}</span>
                    <span className="project-process-icon"><StepIcon size={20} aria-hidden="true" /></span>
                    <h3>{title}</h3>
                    <p>{description}</p>
                  </li>
                ))}
              </ol>
            </section>
          </main>}

          {page === 'contact' && <section className="contact-section" id="contact">
            <header className="contact-hero">
              <span className="contact-hero-eyebrow"><Building2 size={15} aria-hidden="true" /> MEKDELA AMBA UNIVERSITY · SMART WORKFORCE</span>
              <h1>Contact Us</h1>
              <p>Have questions or need assistance? Our team is here to help you.</p>
              <span className="contact-hero-decoration contact-hero-decoration-one" aria-hidden="true" />
              <span className="contact-hero-decoration contact-hero-decoration-two" aria-hidden="true" />
            </header>

            <div className="contact-grid" aria-label="University contact information">
              <article className="contact-card">
                <span className="contact-card-icon"><Mail size={21} aria-hidden="true" /></span>
                <div className="contact-card-copy">
                  <h2>Email</h2>
                  <p>Send a note to the university team</p>
                </div>
                <div className="contact-card-links">
                  <a href="mailto:tsegayehuasnakewu67@gmail.com">tsegayehuasnakewu67@gmail.com</a>
                  <a href="mailto:tsegayehu2@gmail.com">tsegayehu2@gmail.com</a>
                  <a href="mailto:sinteyehukalkidan@gmail.com">sinteyehukalkidan@gmail.com</a>
                </div>
              </article>

              <article className="contact-card">
                <span className="contact-card-icon"><PhoneCall size={21} aria-hidden="true" /></span>
                <div className="contact-card-copy">
                  <h2>Phone</h2>
                  <p>Reach us by phone</p>
                </div>
                <div className="contact-card-links">
                  <a href="tel:0995207802">0995207802</a>
                  <a href="tel:0968067828">0968067828</a>
                </div>
              </article>

              <article className="contact-card">
                <span className="contact-card-icon"><MapPin size={21} aria-hidden="true" /></span>
                <div className="contact-card-copy">
                  <h2>Location</h2>
                  <p>Visit Mekdela Amba University</p>
                </div>
                <p className="contact-card-location">Gimba Mekedela Amba University, Ethiopia</p>
              </article>
            </div>

            <div className="contact-form-wrap">
              <p className="contact-form-eyebrow">WE’RE HERE TO HELP</p>
              <h2>Send us a message</h2>
              <p className="contact-form-description">Share your question with our team and we’ll make sure it reaches the right place.</p>
              <form onSubmit={submitContactMessage} noValidate>
                <div className="contact-form-grid">
                  <label>
                    <span>Full Name <b aria-hidden="true">*</b></span>
                    <input
                      aria-invalid={Boolean(formErrors.fullName)}
                      autoComplete="name"
                      id="contact-full-name"
                      maxLength={120}
                      name="fullName"
                      onChange={event => {
                        setContactForm(current => ({ ...current, fullName: event.target.value }));
                        if (formErrors.fullName) setFormErrors(current => ({ ...current, fullName: '' }));
                      }}
                      placeholder="Your full name"
                      required
                      value={contactForm.fullName}
                    />
                    {formErrors.fullName && <small className="field-error">{formErrors.fullName}</small>}
                  </label>
                  <label>
                    <span>Email Address <b aria-hidden="true">*</b></span>
                    <input
                      aria-invalid={Boolean(formErrors.email)}
                      autoComplete="email"
                      id="contact-email"
                      maxLength={254}
                      name="email"
                      onChange={event => {
                        setContactForm(current => ({ ...current, email: event.target.value }));
                        if (formErrors.email) setFormErrors(current => ({ ...current, email: '' }));
                      }}
                      placeholder="you@example.com"
                      required
                      type="email"
                      value={contactForm.email}
                    />
                    {formErrors.email && <small className="field-error">{formErrors.email}</small>}
                  </label>
                  <label className="contact-form-message">
                    <span>Subject <b aria-hidden="true">*</b></span>
                    <input
                      aria-invalid={Boolean(formErrors.subject)}
                      id="contact-subject"
                      maxLength={160}
                      name="subject"
                      onChange={event => {
                        setContactForm(current => ({ ...current, subject: event.target.value }));
                        if (formErrors.subject) setFormErrors(current => ({ ...current, subject: '' }));
                      }}
                      placeholder="How can we help?"
                      required
                      value={contactForm.subject}
                    />
                    {formErrors.subject && <small className="field-error">{formErrors.subject}</small>}
                  </label>
                  <label className="contact-form-message">
                    <span>Message <b aria-hidden="true">*</b></span>
                    <textarea
                      aria-invalid={Boolean(formErrors.message)}
                      id="contact-message"
                      maxLength={10000}
                      minLength={10}
                      name="message"
                      onChange={event => {
                        setContactForm(current => ({ ...current, message: event.target.value }));
                        if (formErrors.message) setFormErrors(current => ({ ...current, message: '' }));
                      }}
                      placeholder="Tell us a little more about what you need..."
                      required
                      rows={5}
                      value={contactForm.message}
                    />
                    {formErrors.message && <small className="field-error">{formErrors.message}</small>}
                    <small className="contact-form-hint">Include your phone number in the message if you would like a call back.</small>
                  </label>
                </div>
                {contactStatus.message && (
                  <p className={`contact-form-alert ${contactStatus.type}`} role={contactStatus.type === 'error' ? 'alert' : 'status'}>
                    {contactStatus.message}
                    {contactTicketId && <><br />Ticket ID: <strong>{contactTicketId}</strong></>}
                  </p>
                )}
                <div className="contact-form-submit">
                  <button disabled={sendingContact} type="submit">
                    {sendingContact ? <><Loader2 className="spin" size={16} /> Sending…</> : <>Send Message <ArrowRight size={16} /></>}
                  </button>
                </div>
              </form>
            </div>
          </section>}

          <footer className={`site-footer university-footer${page === 'home' ? ' landing-footer' : ''}`}>
            <div className="footer-inner">
              <section className="footer-brand" aria-label="About the attendance system">
                <a className="footer-brand-link" href="https://mkau.edu.et/" target="_blank" rel="noopener noreferrer" aria-label="Mekdela Amba University official website">
                  <img className="footer-logo" src="/mau-logo.png" alt="Mekdela Amba University logo" />
                  <span className="footer-brand-name">Mekdela Amba University</span>
                </a>
                <p>Smart Workforce Attendance System</p>
                <p className="footer-brand-description">
                  A secure workspace for transparent workforce attendance, department insights, and university reporting.
                </p>
                <a className="footer-website-link" href="https://mkau.edu.et/" target="_blank" rel="noopener noreferrer">
                  mkau.edu.et <ArrowUpRight size={14} aria-hidden="true" />
                </a>
              </section>

              <nav className="footer-column" aria-label="Quick links">
                <h2>Quick Links</h2>
                <Link to="/">Home</Link>
                <Link to="/features">Features</Link>
                <Link to="/project">Project</Link>
                <Link to="/contact">Contact</Link>
                <Link to="/login">Login</Link>
              </nav>

              <address className="footer-column footer-contact">
                <h2>Contact Us</h2>
                <a href="mailto:mauinfo@mkau.edu.et"><Mail size={16} aria-hidden="true" />mauinfo@mkau.edu.et</a>
                <a href="tel:+251332405111"><PhoneCall size={16} aria-hidden="true" />+251 332405111</a>
                <span><MapPin size={16} aria-hidden="true" />Gimba, Amhara, Ethiopia</span>
                <span className="footer-address">P.O. Box 32</span>
              </address>

              <nav className="footer-column footer-social" aria-label="Follow Mekdela Amba University">
                <h2>Follow Us</h2>
                <a href="https://www.facebook.com/Mekdela.Amba.University/" target="_blank" rel="noopener noreferrer" aria-label="Mekdela Amba University on Facebook">
                  <Facebook size={18} aria-hidden="true" /><span>Facebook</span>
                </a>
                <a href="https://t.me/mekdelauniversity" target="_blank" rel="noopener noreferrer" aria-label="Mekdela Amba University on Telegram">
                  <Send size={18} aria-hidden="true" /><span>Telegram</span>
                </a>
                <a href="https://lnkd.in/gakMRDpG" target="_blank" rel="noopener noreferrer" aria-label="Mekdela Amba University on YouTube">
                  <Youtube size={18} aria-hidden="true" /><span>YouTube</span>
                </a>
                <a href="https://www.linkedin.com/company/mekdela-amba-university-mau" target="_blank" rel="noopener noreferrer" aria-label="Mekdela Amba University on LinkedIn">
                  <Linkedin size={18} aria-hidden="true" /><span>LinkedIn</span>
                </a>
              </nav>
            </div>
            <div className="footer-bottom">
              <p>© {new Date().getFullYear()} Mekdela Amba University. All rights reserved.</p>
            </div>
          </footer>
        </div>
      </div>
    </>
  );
}
