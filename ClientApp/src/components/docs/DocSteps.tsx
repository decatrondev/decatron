interface Step {
    title: string;
    description: string;
    code?: string;
}

interface DocStepsProps {
    steps: Step[];
}

export default function DocSteps({ steps }: DocStepsProps) {
    return (
        <div className="space-y-4">
            {steps.map((step, index) => (
                <div
                    key={index}
                    className="flex gap-4 bg-white dark:bg-[#1B1C1D] rounded-xl p-4 border border-[#e2e8f0] dark:border-[#374151]"
                >
                    <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-[#2563eb] text-white rounded-full flex items-center justify-center font-bold text-sm">
                            {index + 1}
                        </div>
                    </div>
                    <div className="flex-1">
                        <h4 className="font-bold text-gray-900 dark:text-white mb-1">
                            {step.title}
                        </h4>
                        <p className="text-[#64748b] dark:text-[#94a3b8] text-sm">
                            {step.description}
                        </p>
                        {step.code && (
                            <code className="block mt-2 bg-[#f8fafc] dark:bg-[#1B1C1D] text-[#2563eb] px-3 py-2 rounded-lg text-sm font-mono border border-[#e2e8f0] dark:border-[#374151]">
                                {step.code}
                            </code>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}
