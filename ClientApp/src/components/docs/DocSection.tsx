interface DocSectionProps {
    title: string;
    children: React.ReactNode;
    id?: string;
}

export default function DocSection({ title, children, id }: DocSectionProps) {
    return (
        <section id={id} className="mb-8">
            <h2 className="text-2xl font-black text-ds-text mb-4 pb-2 border-b border-ds-border">
                {title}
            </h2>
            <div className="space-y-4 text-ds-soft">
                {children}
            </div>
        </section>
    );
}
