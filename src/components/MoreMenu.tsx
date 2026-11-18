import { Dropdown } from "@/components/Dropdown";

/** Small "…" menu for rarely-used actions (report, delete), so they don't compete with the main ones. */
export function MoreMenu({ children, label = "More actions" }: { children: React.ReactNode; label?: string }) {
  return (
    <Dropdown
      label={label}
      summaryClassName="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-text"
      panelClassName="flex w-72 flex-col items-start gap-2 p-3"
      summary={
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <circle cx="5" cy="12" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="19" cy="12" r="2" />
        </svg>
      }
    >
      {children}
    </Dropdown>
  );
}
