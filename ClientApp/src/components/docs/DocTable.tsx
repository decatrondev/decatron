interface DocTableProps {
    headers: string[];
    rows: (string | React.ReactNode)[][];
}

export default function DocTable({ headers, rows }: DocTableProps) {
    return (
        <div className="overflow-x-auto rounded-lg border border-ds-border">
            <table className="w-full">
                <thead>
                    <tr className="bg-ds-bg border-b border-ds-border">
                        {headers.map((header, index) => (
                            <th
                                key={index}
                                className="px-4 py-3 text-left text-sm font-bold text-ds-text"
                            >
                                {header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="bg-ds-surface">
                    {rows.map((row, rowIndex) => (
                        <tr
                            key={rowIndex}
                            className="border-b border-ds-border last:border-b-0"
                        >
                            {row.map((cell, cellIndex) => (
                                <td
                                    key={cellIndex}
                                    className="px-4 py-3 text-sm text-ds-soft"
                                >
                                    {cell}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
