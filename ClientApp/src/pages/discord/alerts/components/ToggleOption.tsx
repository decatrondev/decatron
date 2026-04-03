export default function ToggleOption({ checked, onChange, label, desc }: { checked: boolean; onChange: (v: boolean) => void; label: string; desc: string }) {
  return (
    <label className="flex items-center gap-3 p-3 bg-[#f8fafc] dark:bg-[#374151]/50 rounded-xl cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-[#2563eb]" />
      <div>
        <span className="text-sm font-medium text-gray-900 dark:text-white">{label}</span>
        <p className="text-xs text-[#64748b]">{desc}</p>
      </div>
    </label>
  );
}
