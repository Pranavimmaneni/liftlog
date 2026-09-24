/** S14 switch: role="switch", 48×28 track inside a 44 px hit area. */
export function Switch({
  checked,
  onChange,
  label,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  id?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="flex h-11 w-14 shrink-0 items-center justify-center"
    >
      <span
        className={`flex h-7 w-12 items-center rounded-[14px] p-[3px] transition-colors ${
          checked ? 'justify-end bg-ink' : 'justify-start border-2 border-ink2 bg-transparent'
        }`}
      >
        <span
          className={`rounded-[11px] ${checked ? 'h-[22px] w-[22px] bg-card' : 'h-[18px] w-[18px] bg-ink2'}`}
        />
      </span>
    </button>
  );
}
