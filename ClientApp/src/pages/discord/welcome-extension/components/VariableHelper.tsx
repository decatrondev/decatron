import { MESSAGE_VARIABLES } from '../constants/defaults';

interface VariableHelperProps {
  onInsert?: (variable: string) => void;
  compact?: boolean;
}

export default function VariableHelper({ onInsert, compact }: VariableHelperProps) {
  if (compact) {
    return (
      <p className="text-xs text-ds-soft">
        Variables:{' '}
        {MESSAGE_VARIABLES.map((v, i) => (
          <span key={v.key}>
            {onInsert ? (
              <button
                onClick={() => onInsert(v.key)}
                className="text-ds-accent-text hover:underline font-mono"
              >
                {v.key}
              </button>
            ) : (
              <code className="text-ds-accent-text font-mono text-xs">{v.key}</code>
            )}
            {i < MESSAGE_VARIABLES.length - 1 && ', '}
          </span>
        ))}
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-ds-border bg-ds-bg p-3">
      <p className="text-xs font-bold text-ds-soft mb-2">Variables disponibles</p>
      <div className="grid grid-cols-2 gap-1.5">
        {MESSAGE_VARIABLES.map(v => (
          <div key={v.key} className="flex items-center gap-2">
            {onInsert ? (
              <button
                onClick={() => onInsert(v.key)}
                className="text-xs font-mono text-ds-accent-text hover:underline bg-ds-accent/10 px-1.5 py-0.5 rounded"
              >
                {v.key}
              </button>
            ) : (
              <code className="text-xs font-mono text-ds-accent-text bg-ds-accent/10 px-1.5 py-0.5 rounded">
                {v.key}
              </code>
            )}
            <span className="text-[10px] text-ds-soft">{v.example}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
