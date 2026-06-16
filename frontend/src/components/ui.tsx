import { useEffect, useState, type ReactNode } from "react";
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
  { path: "", icon: "dashboard", label: "Overview" },
  { path: "ask", icon: "chat_bubble", label: "Ask" },
  { path: "sources", icon: "menu_book", label: "Sources" },
  { path: "brief", icon: "article", label: "Brief" },
  { path: "score", icon: "fact_check", label: "Score" },
  { path: "compare", icon: "compare_arrows", label: "Compare" },
];

type Theme = "light" | "dark";

const THEME_STORAGE_KEY = "webbrief-theme";

export const fieldClassName =
  "bg-white border border-slate-300 text-slate-950 placeholder:text-slate-400 dark:bg-surface-container-lowest dark:border-outline-variant dark:text-on-surface dark:placeholder:text-on-surface-variant";

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "dark";

  const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (savedTheme === "light" || savedTheme === "dark") return savedTheme;

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (window.localStorage.getItem(THEME_STORAGE_KEY)) return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncTheme = (event: MediaQueryListEvent) => {
      setTheme(event.matches ? "dark" : "light");
    };

    media.addEventListener("change", syncTheme);
    return () => media.removeEventListener("change", syncTheme);
  }, []);

  return {
    theme,
    toggleTheme: () => setTheme((current) => (current === "dark" ? "light" : "dark")),
  };
}

export function Sidebar({ analysisId }: { analysisId?: string }) {
  return (
    <aside className="hidden md:flex flex-col h-screen p-stack-md gap-stack-sm bg-white border-r border-slate-200 w-64 fixed left-0 top-0 z-50 dark:bg-surface-container dark:border-outline-variant">
      <div className="flex items-center gap-stack-sm mb-stack-lg px-stack-sm">
        <Icon name="clinical_notes" className="text-indigo-600 dark:text-primary" />
        <span className="text-h3 font-bold text-indigo-600 dark:text-primary">WebBrief AI</span>
      </div>

      <div className="px-stack-sm mb-stack-sm">
        <span className="text-label-caps uppercase text-slate-500 dark:text-on-surface-variant">Workspace</span>
      </div>
      <nav className="flex flex-col gap-unit">
        {NAV.map((n) => (
          <NavItem key={n.to} to={n.to} icon={n.icon} label={n.label} end />
        ))}
      </nav>

      {/* Show analysis-specific navigation only after an analysis is open. */}
      {analysisId && (
        <>
          <div className="px-stack-sm mt-stack-md mb-stack-sm">
            <span className="text-label-caps uppercase text-slate-500 dark:text-on-surface-variant">Analysis</span>
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
            ? "bg-indigo-100 text-indigo-700 font-bold dark:bg-secondary-container dark:text-on-secondary-container"
            : "text-slate-600 hover:text-slate-950 hover:bg-slate-100 dark:text-on-surface-variant dark:hover:text-on-surface dark:hover:bg-surface-container-highest"
        }`
      }
    >
      <Icon name={icon} />
      <span className="text-body-sm">{label}</span>
    </NavLink>
  );
}

function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={onToggle}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 transition-colors hover:border-indigo-400 hover:text-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-[#334155] dark:bg-[#111827] dark:text-[#CBD5E1] dark:hover:border-[#A5B4FC] dark:hover:text-white"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <Icon name={isDark ? "light_mode" : "dark_mode"} />
    </button>
  );
}

export function Header({
  right,
  title,
  theme,
  onToggleTheme,
}: {
  right?: ReactNode;
  title?: string;
  theme: Theme;
  onToggleTheme: () => void;
}) {
  return (
    <header className="w-full sticky top-0 z-40 bg-white border-b border-slate-200 flex justify-between items-center px-gutter py-stack-md text-slate-950 dark:bg-[#0F172A] dark:border-[#263247] dark:text-white">
      <div className="flex md:hidden items-center gap-stack-sm min-w-0">
        <Icon
          name={title ? "menu" : "clinical_notes"}
          className={title ? "text-slate-700 dark:text-white" : "text-indigo-600 dark:text-primary"}
        />
        <span
          className={`${title ? "text-body-md text-slate-950 dark:text-white" : "text-h3 text-indigo-600 dark:text-primary"} font-bold truncate`}
        >
          {title || "WebBrief AI"}
        </span>
      </div>
      <div className="ml-auto flex items-center gap-stack-sm">
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        {right}
      </div>
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
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex min-h-screen bg-[#E5E7EB] text-slate-950 dark:bg-background dark:text-on-surface">
      <Sidebar analysisId={analysisId} />
      <main className="flex-1 flex flex-col md:ml-64 min-w-0">
        <Header right={headerRight} title={headerTitle} theme={theme} onToggleTheme={toggleTheme} />
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
      className={`bg-white border border-slate-200 rounded-xl p-gutter shadow-sm dark:bg-surface-container dark:border-outline-variant dark:shadow-none ${className}`}
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
      ? "bg-[#6366F1] text-white hover:bg-[#4F46E5] dark:bg-primary-container dark:text-on-primary-container dark:hover:bg-primary"
      : "border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-outline-variant dark:text-on-surface dark:hover:bg-surface-container-highest";
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
    <span className="px-stack-sm py-1 bg-slate-100 rounded-full border border-slate-300 text-label-caps uppercase text-slate-600 dark:bg-surface-container-high dark:border-outline-variant dark:text-on-surface-variant">
      {children}
    </span>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-stack-sm p-stack-md rounded-lg border border-red-200 bg-red-50 text-red-800 dark:border-error-container dark:bg-error-container/20 dark:text-on-error-container">
      <Icon name="error" className="text-red-600 dark:text-error" />
      <p className="text-body-sm">{message}</p>
    </div>
  );
}

export function EmptyState({ icon, title, hint }: { icon: string; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-stack-lg gap-stack-sm text-slate-500 dark:text-on-surface-variant">
      <Icon name={icon} className="text-4xl text-slate-400 dark:text-outline" />
      <p className="text-body-md font-bold text-slate-950 dark:text-on-surface">{title}</p>
      {hint && <p className="text-body-sm max-w-md">{hint}</p>}
    </div>
  );
}

export function Spinner({ label, className = "" }: { label?: string; className?: string }) {
  return (
    <div className={`flex items-center gap-stack-sm text-slate-500 dark:text-on-surface-variant ${className}`}>
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
      className={`flex items-center gap-1 text-slate-500 hover:text-slate-950 transition-colors dark:text-on-surface-variant dark:hover:text-on-surface ${className}`}
    >
      <Icon name={copied ? "check" : "content_copy"} className="text-base" />
      <span className="text-label-caps uppercase">{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}
