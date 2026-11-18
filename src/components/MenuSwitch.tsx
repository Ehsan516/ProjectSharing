/** A menu row with a label on the left and an on/off switch on the right. */
export function MenuSwitch({
  icon,
  label,
  on,
  onToggle,
}: {
  icon: React.ReactNode;
  label: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left hover:bg-surface-2"
    >
      <span className="text-muted">{icon}</span>
      <span className="flex-1">{label}</span>
      <span
        aria-hidden
        className={`relative h-4 w-7 shrink-0 rounded-full transition ${on ? "bg-accent" : "bg-border-strong"}`}
      >
        <span
          className={`absolute top-0.5 h-3 w-3 rounded-full bg-surface transition-all ${on ? "left-3.5" : "left-0.5"}`}
        />
      </span>
    </button>
  );
}
