interface PlaceholderTabProps {
  icon: string;
  title: string;
  description: string;
}

export default function PlaceholderTab({ icon, title, description }: PlaceholderTabProps) {
  return (
    <div className="bg-ds-surface rounded-lg p-12 border border-ds-border text-center">
      <span className="text-5xl mb-4 block">{icon}</span>
      <h3 className="text-xl font-black text-ds-text mb-2">{title}</h3>
      <p className="text-sm text-ds-soft mb-4">{description}</p>
      <span className="inline-block px-4 py-2 bg-ds-bg text-ds-soft text-sm font-bold rounded-lg border border-ds-border">
        Proximamente
      </span>
    </div>
  );
}
