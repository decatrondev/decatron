interface PlaceholderTabProps {
  icon: string;
  title: string;
  description: string;
}

export default function PlaceholderTab({ icon, title, description }: PlaceholderTabProps) {
  return (
    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-12 border border-[#e2e8f0] dark:border-[#374151] shadow-lg text-center">
      <span className="text-5xl mb-4 block">{icon}</span>
      <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">{title}</h3>
      <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mb-4">{description}</p>
      <span className="inline-block px-4 py-2 bg-[#f8fafc] dark:bg-[#374151]/50 text-[#64748b] text-sm font-bold rounded-xl border border-[#e2e8f0] dark:border-[#374151]">
        Proximamente
      </span>
    </div>
  );
}
