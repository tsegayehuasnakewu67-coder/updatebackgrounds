import { Link } from "react-router-dom";
import BackToHomeButton from "./BackToHomeButton.jsx";

export default function PageHeader({
  title,
  description,
  eyebrow,
  breadcrumbs = [],
  actions = null,
  showBackToHome = true,
}) {
  const validBreadcrumbs = breadcrumbs.length ? breadcrumbs : [{ label: "Home", to: "/app", current: true }];

  return (
    <header className="page-header">
      <div className="page-header-main">
        <nav aria-label="Breadcrumb" className="breadcrumb-nav">
          {validBreadcrumbs.map((item, index) => {
            const isCurrent = item.current || index === validBreadcrumbs.length - 1;
            const content = (
              <>
                {index > 0 && <span className="breadcrumb-separator">/</span>}
                <span className="breadcrumb-label">{item.label}</span>
              </>
            );

            if (isCurrent) {
              return <span key={`${item.label}-${index}`} className="breadcrumb-item breadcrumb-current">{content}</span>;
            }

            return (
              <Link key={`${item.label}-${index}`} to={item.to || "/app"} className="breadcrumb-item breadcrumb-link">
                {content}
              </Link>
            );
          })}
        </nav>

        <div className="page-title-wrap">
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          <h2>{title}</h2>
          {description && <p className="muted">{description}</p>}
        </div>
      </div>

      <div className="page-header-actions">
        {showBackToHome && <BackToHomeButton className="page-header-back-home" />}
        {actions}
      </div>
    </header>
  );
}
