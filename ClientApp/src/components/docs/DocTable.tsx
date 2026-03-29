interface DocTableProps {
    headers: string[];
    rows: (string | React.ReactNode)[][];
}

export default function DocTable({ headers, rows }: DocTableProps) {
    return (
        <div className="overflow-x-auto rounded-xl border border-[#e2e8f0] dark:border-[#374151]">
            <table className="w-full">
                <thead>
                    <tr className="bg-[#f8fafc] dark:bg-[#1B1C1D] border-b border-[#e2e8f0] dark:border-[#374151]">
                        {headers.map((header, index) => (
                            <th
                                key={index}
                                className="px-4 py-3 text-left text-sm font-bold text-gray-900 dark:text-white"
                            >
                                {header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="bg-white dark:bg-[#1B1C1D]">
                    {rows.map((row, rowIndex) => (
                        <tr
                            key={rowIndex}
                            className="border-b border-[#e2e8f0] dark:border-[#374151] last:border-b-0"
                        >
                            {row.map((cell, cellIndex) => (
                                <td
                                    key={cellIndex}
                                    className="px-4 py-3 text-sm text-[#64748b] dark:text-[#94a3b8]"
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
