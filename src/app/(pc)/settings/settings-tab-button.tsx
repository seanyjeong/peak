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
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-bold transition ${
        active ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
