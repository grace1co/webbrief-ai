import { useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";

export function Icon({ name, className = "" }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

const NAV = [
  { to: "/", icon: "search", label: "Analyze" },
  { to: "/history", icon: "history", label: "History" },
  { to: "/saved", icon: "bookmark", label: "Saved" },
];

const ANALYSIS_NAV = [
  { seg: "", icon: "dashboard", label: "Overview" },
  { path: "ask", icon: "chat_bubble", label: "Ask" },
  { seg: "sources", icon: "menu_book", label: "Sources" },
  { seg: "brief", icon: "article", label: "Brief" },
  { seg: "score", icon: "fact_check", label: "Score" },
  { seg: "compare", icon: "compare_arrows", label: "Compare" },
];

export function Sidebar({ analysisId }: { analysisId?: string }) {
  return (
    <aside className="hidden md:flex flex-col h-screen p-stack-md gap-stack-sm bg-surface-container border-r border-outline-variant w-64 fixed left-0 top-0 z-50">
      <div className="flex items-center gap-stack-sm mb-stack-lg px-stack-sm">
        <Icon name="clinical_notes" className="text-primary" />
        <span className="text-h3 font-bold text-primary">WebBrief AI</span>
      </div>

      <div className="px-stack-sm mb-stack-sm">
        <span className="text-label-caps uppercase text-on-surface-variant">Workspace</span>
      </div>
      <nav className="flex flex-col gap-unit">
        {NAV.map((n) => (
          <NavItem key={n.to} to={n.to} icon={n.icon} label={n.label} end />
        ))}
      </nav>

      // Show analysis-specific navigation only after an analysis is open.
      {analysisId && (
        <>
          <div className="px-stack-sm mt-stack-md mb-stack-sm">
            <span className="text-label-caps uppercase text-on-surface-variant">Analysis</span>
          </div>
          <nav className="flex flex-col gap-unit">
            {ANALYSIS_NAV.map((n) => (
              <NavItem
                key={n.path}
                to={`/analysis/${analysisId}${n.path ? "/" + n.path : ""}`}
                icon={n.icon}
                label={n.label}
                end={n.path === ""}
              />
            ))}
          </nav>
        </>
      )}

    </aside>
  );
}

function NavItem({
  to,
  icon,
  label,
  end,
}: {
  to: string;
  icon: string;
  label: string;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-stack-sm p-stack-sm rounded-lg transition-colors duration-200 cursor-pointer ${
          isActive
            ? "bg-secondary-container text-on-secondary-container font-bold"
            : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest"
        }`
      }
    >
      <Icon name={icon} />
      <span className="text-body-sm">{label}</span>
    </NavLink>
  );
}

export function Header({ right, title }: { right?: ReactNode; title?: string }) {
  return (
    <header className="w-full sticky top-0 z-40 bg-[#0F172A] border-b border-[#263247] flex justify-between items-center px-gutter py-stack-md text-white">
      <div className="flex items-center gap-stack-sm min-w-0">
        <Icon name={title ? "menu" : "clinical_notes"} className={title ? "text-white" : "text-primary"} />
        <span className={`${title ? "text-body-md text-white" : "text-h3 text-primary"} font-bold truncate`}>
          {title || "WebBrief AI"}
        </span>
      </div>
      <div className="flex items-center gap-gutter">{right}</div>
    </header>
  );
}

export function Shell({
  analysisId,
  headerRight,
  headerTitle,
  contentClassName = "",
  children,
}: {
  analysisId?: string;
  headerRight?: ReactNode;
  headerTitle?: string;
  contentClassName?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-background text-on-surface">
      <Sidebar analysisId={analysisId} />
      <main className="flex-1 flex flex-col md:ml-64 min-w-0">
        <Header right={headerRight} title={headerTitle} />
        <div className={`flex-1 overflow-y-auto custom-scrollbar ${contentClassName}`}>{children}</div>
      </main>
    </div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-surface-container border border-outline-variant rounded-xl p-gutter ${className}`}
    >
      {children}
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = "primary",
  disabled,
  type = "button",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  const base =
    "inline-flex items-center justify-center gap-stack-sm px-gutter py-stack-sm rounded-lg text-body-sm font-bold transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-primary";
  const styles =
    variant === "primary"
      ? "bg-primary-container text-on-primary-container hover:bg-primary"
      : "border border-outline-variant text-on-surface hover:bg-surface-container-highest";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="px-stack-sm py-1 bg-surface-container-high rounded-full border border-outline-variant text-label-caps uppercase text-on-surface-variant">
      {children}
    </span>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-stack-sm p-stack-md rounded-lg border border-error-container bg-error-container/20 text-on-error-container">
      <Icon name="error" className="text-error" />
      <p className="text-body-sm">{message}</p>
    </div>
  );
}

export function EmptyState({ icon, title, hint }: { icon: string; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-stack-lg gap-stack-sm text-on-surface-variant">
      <Icon name={icon} className="text-4xl text-outline" />
      <p className="text-body-md font-bold text-on-surface">{title}</p>
      {hint && <p className="text-body-sm max-w-md">{hint}</p>}
    </div>
  );
}

export function Spinner({ label, className = "" }: { label?: string; className?: string }) {
  return (
    <div className={`flex items-center gap-stack-sm text-on-surface-variant ${className}`}>
      <span className="material-symbols-outlined animate-spin">progress_activity</span>
      {label && <span className="text-body-sm">{label}</span>}
    </div>
  );
}

export function CopyButton({ text, className = "" }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      setCopied(false);
    });
  }

  return (
    <button
      onClick={copy}
      title="Copy to clipboard"
      className={`flex items-center gap-1 text-on-surface-variant hover:text-on-surface transition-colors ${className}`}
    >
      <Icon name={copied ? "check" : "content_copy"} className="text-base" />
      <span className="text-label-caps uppercase">{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}
