import { MESSAGE_VARIABLES } from '../constants/defaults';

interface VariableHelperProps {
  onInsert?: (variable: string) => void;
  compact?: boolean;
}

export default function VariableHelper({ onInsert, compact }: VariableHelperProps) {
  if (compact) {
    return (
      <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
        Variables:{' '}
        {MESSAGE_VARIABLES.map((v, i) => (
          <span key={v.key}>
            {onInsert ? (
              <button
                onClick={() => onInsert(v.key)}
                className="text-[#2563eb] hover:underline font-mono"
              >
                {v.key}
              </button>
            ) : (
              <code className="text-[#2563eb] font-mono text-xs">{v.key}</code>
            )}
            {i < MESSAGE_VARIABLES.length - 1 && ', '}
          </span>
        ))}
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-[#e2e8f0] dark:border-[#374151] bg-[#f8fafc] dark:bg-[#374151]/30 p-3">
      <p className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] mb-2">Variables disponibles</p>
      <div className="grid grid-cols-2 gap-1.5">
        {MESSAGE_VARIABLES.map(v => (
          <div key={v.key} className="flex items-center gap-2">
            {onInsert ? (
              <button
                onClick={() => onInsert(v.key)}
                className="text-xs font-mono text-[#2563eb] hover:underline bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded"
              >
                {v.key}
              </button>
            ) : (
              <code className="text-xs font-mono text-[#2563eb] bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded">
                {v.key}
              </code>
            )}
            <span className="text-[10px] text-[#94a3b8]">{v.example}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
