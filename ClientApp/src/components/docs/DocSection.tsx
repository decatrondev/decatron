interface DocSectionProps {
    title: string;
    children: React.ReactNode;
    id?: string;
}

export default function DocSection({ title, children, id }: DocSectionProps) {
    return (
        <section id={id} className="mb-8">
            <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-4 pb-2 border-b border-[#e2e8f0] dark:border-[#374151]">
                {title}
            </h2>
            <div className="space-y-4 text-[#64748b] dark:text-[#94a3b8]">
                {children}
            </div>
        </section>
    );
}
