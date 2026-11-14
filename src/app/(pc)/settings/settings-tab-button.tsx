export function TabButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex h-9 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition ${
        active ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
