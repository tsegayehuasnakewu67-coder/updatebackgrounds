import { ArrowRight, BookOpenCheck, Microscope, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

export default function Landing() {
  return (
    <main className="landing">
      <nav className="landing-nav">
        <Link to="/" className="brand"><span className="brand-mark">M</span><span><b>MAU-RIMS</b><small>Mekdela Amba University</small></span></Link>
        <div className="landing-links"><a href="#about">About</a><a href="#research">Research areas</a><Link to="/login" className="button button-outline">Sign in</Link><Link to="/register" className="button button-primary">Create account</Link></div>
      </nav>
      <section className="hero">
        <div className="hero-copy"><span className="pill"><span className="status-dot" /> UNIVERSITY RESEARCH PORTAL</span><h1>Research that moves<br /><em>our community forward.</em></h1><p>A central place to manage research proposals, projects, ethics reviews, publications, and collaboration across Mekdela Amba University.</p><div className="hero-actions"><Link to="/register" className="button button-primary">Get started <ArrowRight size={17} /></Link><a className="text-link" href="#about">Explore the system</a></div><div className="hero-meta"><span><ShieldCheck size={17} /> Secure access</span><span><BookOpenCheck size={17} /> Connected research</span></div></div>
        <div className="hero-art"><div className="art-glow" /><div className="art-card art-card-main"><div className="art-top"><span className="art-icon"><Microscope size={22} /></span><span className="pill">RESEARCH PORTFOLIO</span></div><h3>Ideas into impact</h3><p>From proposal submission to published outcomes.</p><div className="art-bars">{Array.from({ length: 12 }, (_, index) => <i key={index} />)}</div><div className="art-legend"><span>Research lifecycle</span><b>2026</b></div></div><div className="floating-note"><span className="status-dot" /> Project progress <b>On track</b></div></div>
      </section>
      <section className="landing-info" id="about"><div><span className="eyebrow">ONE CONNECTED WORKSPACE</span><h2>Make research easier to manage.</h2><p>Coordinate the full institutional lifecycle with transparent approvals, structured records, and shared visibility for authorized teams.</p></div><div className="info-cards" id="research"><article><FeatureIcon /><h3>Research lifecycle</h3><p>Manage proposals, reviews, ethics applications, project milestones, and progress reports.</p></article><article><ShieldCheck size={21} /><h3>Accountable access</h3><p>Role-based permissions keep sensitive records accessible to the right people.</p></article><article><BookOpenCheck size={21} /><h3>Research outputs</h3><p>Organize publications, collaboration records, budgets, and supporting documents.</p></article></div></section>
      <footer className="landing-footer"><span>© {new Date().getFullYear()} Mekdela Amba University</span><span>Research Information Management System</span></footer>
    </main>
  );
}

function FeatureIcon() {
  return <span className="feature-icon"><BookOpenCheck size={21} /></span>;
}
