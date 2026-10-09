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
                    className="flex gap-4 bg-ds-surface rounded-lg p-4 border border-ds-border"
                >
                    <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-ds-accent text-white rounded-full flex items-center justify-center font-bold text-sm">
                            {index + 1}
                        </div>
                    </div>
                    <div className="flex-1">
                        <h4 className="font-bold text-ds-text mb-1">
                            {step.title}
                        </h4>
                        <p className="text-ds-soft text-sm">
                            {step.description}
                        </p>
                        {step.code && (
                            <code className="block mt-2 bg-ds-bg text-ds-accent-text px-3 py-2 rounded-lg text-sm font-mono border border-ds-border">
                                {step.code}
                            </code>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}
