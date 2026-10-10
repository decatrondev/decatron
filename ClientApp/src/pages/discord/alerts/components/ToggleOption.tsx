export default function ToggleOption({ checked, onChange, label, desc }: { checked: boolean; onChange: (v: boolean) => void; label: string; desc: string }) {
  return (
    <label className="flex items-center gap-3 p-3 bg-ds-bg rounded-lg cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-ds-accent" />
      <div>
        <span className="text-sm font-medium text-ds-text">{label}</span>
        <p className="text-xs text-ds-soft">{desc}</p>
      </div>
    </label>
  );
}
