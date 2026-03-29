import { CSSProperties } from 'react';

interface ProgressBarCircularProps {
    progress: number; // 0-100
    orientation: 'clockwise' | 'counterclockwise';
    position: { x: number; y: number };
    size: { width: number; height: number };
    // Background
    backgroundType: 'color' | 'gradient' | 'image' | 'gif';
    backgroundColor: string;
    backgroundGradient: { color1: string; color2: string; angle: number };
    backgroundImage: string;
    // Fill
    fillType: 'color' | 'gradient' | 'image' | 'gif';
    fillColor: string;
    fillGradient: { color1: string; color2: string; angle: number };
    fillImage: string;
    // Indicator
    indicatorEnabled: boolean;
    indicatorType: 'circle' | 'image' | 'gif';
    indicatorSize: number;
    indicatorColor: string;
    indicatorImage: string;
    indicatorRotate: boolean;
    // Border
    borderEnabled: boolean;
    borderColor: string;
    borderWidth: number;
    borderRadius: number;
    // Animation
    isPulsing?: boolean;
    pulseSpeed?: 'slow' | 'normal' | 'fast';
    // Preview mode
    usePercentage?: boolean;
}

export default function ProgressBarCircular(props: ProgressBarCircularProps) {
    const {
        progress,
        orientation,
        position,
        size,
        backgroundType,
        backgroundColor,
        backgroundGradient,
        backgroundImage,
        fillType,
        fillColor,
        fillGradient,
        fillImage,
        indicatorEnabled,
        indicatorType,
        indicatorSize,
        indicatorColor,
        indicatorImage,
        indicatorRotate,
        borderEnabled,
        borderColor,
        borderWidth,
        isPulsing = false,
        pulseSpeed = 'normal',
        usePercentage = false
    } = props;

    const radius = Math.min(size.width, size.height) / 2;
    const centerX = size.width / 2;
    const centerY = size.height / 2;

    // Calculate arc path for the progress
    const getArcPath = (percent: number): string => {
        const angle = (percent / 100) * 360;
        const adjustedAngle = orientation === 'clockwise' ? angle : -angle;
        const radians = ((adjustedAngle - 90) * Math.PI) / 180;

        const x = centerX + radius * Math.cos(radians);
        const y = centerY + radius * Math.sin(radians);

        const largeArcFlag = angle > 180 ? 1 : 0;
        const sweepFlag = orientation === 'clockwise' ? 1 : 0;

        if (percent === 0) {
            return '';
        } else if (percent >= 100) {
            // Full circle
            return `M ${centerX},${centerY} m -${radius},0 a ${radius},${radius} 0 1,0 ${radius * 2},0 a ${radius},${radius} 0 1,0 -${radius * 2},0`;
        } else {
            // Partial arc (pizza slice from center)
            return `M ${centerX},${centerY} L ${centerX},${centerY - radius} A ${radius},${radius} 0 ${largeArcFlag},${sweepFlag} ${x},${y} Z`;
        }
    };

    // Calculate indicator position
    const getIndicatorPosition = (): { x: number; y: number; rotation: number } => {
        const angle = (progress / 100) * 360;
        const adjustedAngle = orientation === 'clockwise' ? angle : -angle;
        const radians = ((adjustedAngle - 90) * Math.PI) / 180;

        const x = centerX + radius * Math.cos(radians) - indicatorSize / 2;
        const y = centerY + radius * Math.sin(radians) - indicatorSize / 2;

        return { x, y, rotation: adjustedAngle };
    };

    // Fill path
    const fillPath = getArcPath(progress);
    const indicatorPos = getIndicatorPosition();

    // Generate gradient IDs (unique per instance)
    const bgGradientId = `bg-gradient-${Math.random().toString(36).substr(2, 9)}`;
    const fillGradientId = `fill-gradient-${Math.random().toString(36).substr(2, 9)}`;
    const fillClipId = `fill-clip-${Math.random().toString(36).substr(2, 9)}`;

    // Background style for non-SVG elements
    const getBackgroundStyle = (): CSSProperties => {
        const base: CSSProperties = {
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            borderRadius: '50%'
        };

        if (backgroundType === 'image' || backgroundType === 'gif') {
            if (backgroundImage) {
                base.backgroundImage = `url(${backgroundImage})`;
                base.backgroundSize = 'cover';
                base.backgroundPosition = 'center';
                base.backgroundRepeat = 'no-repeat';
            }
        }

        return base;
    };

    // Fill background style
    const getFillBackground = (): string => {
        if (fillType === 'color') {
            return fillColor;
        } else if (fillType === 'gradient') {
            return `url(#${fillGradientId})`;
        }
        return fillColor;
    };

    // Background fill color for SVG
    const getBackgroundFill = (): string => {
        if (backgroundType === 'color') {
            return backgroundColor;
        } else if (backgroundType === 'gradient') {
            return `url(#${bgGradientId})`;
        }
        return backgroundColor;
    };

    // Indicator style
    const getIndicatorStyle = (): CSSProperties => {
        const base: CSSProperties = {
            position: 'absolute',
            left: `${indicatorPos.x}px`,
            top: `${indicatorPos.y}px`,
            width: `${indicatorSize}px`,
            height: `${indicatorSize}px`,
            transition: 'all 0.3s ease-out',
            pointerEvents: 'none',
            zIndex: 20
        };

        if (indicatorType === 'circle') {
            base.borderRadius = '50%';
            base.backgroundColor = indicatorColor;
            base.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
        } else if (indicatorType === 'image' || indicatorType === 'gif') {
            if (indicatorImage) {
                base.backgroundImage = `url(${indicatorImage})`;
                base.backgroundSize = 'contain';
                base.backgroundPosition = 'center';
                base.backgroundRepeat = 'no-repeat';
                if (indicatorRotate) {
                    base.transform = `rotate(${indicatorPos.rotation}deg)`;
                }
            } else {
                // Fallback to circle
                base.borderRadius = '50%';
                base.backgroundColor = indicatorColor;
            }
        }

        return base;
    };

    // Container animation
    const getPulseAnimation = (): string => {
        if (!isPulsing) return '';
        const duration = pulseSpeed === 'slow' ? '1s' : pulseSpeed === 'fast' ? '0.5s' : '0.7s';
        return `pulse ${duration} ease-in-out infinite`;
    };

    const unit = usePercentage ? '%' : 'px';

    return (
        <div
            style={{
                position: 'absolute',
                left: `${position.x}${unit}`,
                top: `${position.y}${unit}`,
                width: `${size.width}${unit}`,
                height: `${size.height}${unit}`,
                animation: getPulseAnimation()
            }}
        >
            {/* Main container */}
            <div
                style={{
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                    border: borderEnabled ? `${borderWidth}px solid ${borderColor}` : 'none',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    boxSizing: 'border-box',
                    boxShadow: borderEnabled ? '0 4px 12px rgba(0, 0, 0, 0.3)' : '0 2px 8px rgba(0, 0, 0, 0.2)'
                }}
            >
                {/* Background image/gif (if applicable) */}
                {(backgroundType === 'image' || backgroundType === 'gif') && backgroundImage && (
                    <div style={getBackgroundStyle()} />
                )}

                {/* SVG for the circular progress */}
                <svg
                    width={size.width}
                    height={size.height}
                    viewBox={`0 0 ${size.width} ${size.height}`}
                    style={{ position: 'absolute', top: 0, left: 0 }}
                >
                    {/* Gradient definitions */}
                    <defs>
                        {/* Background gradient */}
                        {backgroundType === 'gradient' && (
                            <linearGradient
                                id={bgGradientId}
                                x1="0%"
                                y1="0%"
                                x2="100%"
                                y2="100%"
                                gradientTransform={`rotate(${backgroundGradient.angle})`}
                            >
                                <stop offset="0%" stopColor={backgroundGradient.color1} />
                                <stop offset="100%" stopColor={backgroundGradient.color2} />
                            </linearGradient>
                        )}

                        {/* Fill gradient */}
                        {fillType === 'gradient' && (
                            <linearGradient
                                id={fillGradientId}
                                x1="0%"
                                y1="0%"
                                x2="100%"
                                y2="100%"
                                gradientTransform={`rotate(${fillGradient.angle})`}
                            >
                                <stop offset="0%" stopColor={fillGradient.color1} />
                                <stop offset="100%" stopColor={fillGradient.color2} />
                            </linearGradient>
                        )}

                        {/* Clip path for fill image/gif */}
                        {(fillType === 'image' || fillType === 'gif') && fillImage && (
                            <clipPath id={fillClipId}>
                                <path d={fillPath} />
                            </clipPath>
                        )}
                    </defs>

                    {/* Background circle */}
                    {(backgroundType === 'color' || backgroundType === 'gradient') && (
                        <circle
                            cx={centerX}
                            cy={centerY}
                            r={radius}
                            fill={getBackgroundFill()}
                        />
                    )}

                    {/* Fill arc */}
                    {fillPath && (
                        <>
                            {(fillType === 'color' || fillType === 'gradient') ? (
                                <path
                                    d={fillPath}
                                    fill={getFillBackground()}
                                    style={{ transition: 'd 0.3s ease-out' }}
                                />
                            ) : (fillType === 'image' || fillType === 'gif') && fillImage ? (
                                <image
                                    href={fillImage}
                                    x="0"
                                    y="0"
                                    width={size.width}
                                    height={size.height}
                                    clipPath={`url(#${fillClipId})`}
                                    preserveAspectRatio="xMidYMid slice"
                                />
                            ) : null}
                        </>
                    )}
                </svg>

                {/* Indicator */}
                {indicatorEnabled && progress > 0 && progress < 100 && (
                    <div style={getIndicatorStyle()} />
                )}
            </div>
        </div>
    );
}
