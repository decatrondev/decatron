import { CSSProperties } from 'react';

interface ProgressBarVerticalProps {
    progress: number; // 0-100
    orientation: 'top-to-bottom' | 'bottom-to-top';
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

export default function ProgressBarVertical(props: ProgressBarVerticalProps) {
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
        borderRadius,
        isPulsing = false,
        pulseSpeed = 'normal',
        usePercentage = false
    } = props;

    // Calculate fill height based on progress and orientation
    const fillHeight = (progress / 100) * size.height;
    const isReversed = orientation === 'top-to-bottom';

    // Indicator position (centered on the fill edge)
    const indicatorTop = isReversed
        ? fillHeight - indicatorSize / 2
        : size.height - fillHeight - indicatorSize / 2;

    // Background style
    const getBackgroundStyle = (): CSSProperties => {
        const base: CSSProperties = {
            width: '100%',
            height: '100%',
            borderRadius: `${borderRadius}px`,
            overflow: 'hidden'
        };

        if (backgroundType === 'color') {
            base.backgroundColor = backgroundColor;
        } else if (backgroundType === 'gradient') {
            base.background = `linear-gradient(${backgroundGradient.angle}deg, ${backgroundGradient.color1}, ${backgroundGradient.color2})`;
        } else if (backgroundType === 'image' || backgroundType === 'gif') {
            if (backgroundImage) {
                base.backgroundImage = `url(${backgroundImage})`;
                base.backgroundSize = 'cover';
                base.backgroundPosition = 'center';
                base.backgroundRepeat = 'no-repeat';
            } else {
                base.backgroundColor = backgroundColor;
            }
        }

        return base;
    };

    // Fill style
    const getFillStyle = (): CSSProperties => {
        const base: CSSProperties = {
            width: '100%',
            height: `${fillHeight}px`,
            position: 'absolute',
            left: 0,
            top: isReversed ? 0 : 'auto',
            bottom: isReversed ? 'auto' : 0,
            transition: 'height 0.3s ease-out',
            borderRadius: `${borderRadius}px`
        };

        if (fillType === 'color') {
            base.backgroundColor = fillColor;
        } else if (fillType === 'gradient') {
            base.background = `linear-gradient(${fillGradient.angle}deg, ${fillGradient.color1}, ${fillGradient.color2})`;
        } else if (fillType === 'image' || fillType === 'gif') {
            if (fillImage) {
                base.backgroundImage = `url(${fillImage})`;
                base.backgroundSize = 'cover';
                base.backgroundPosition = isReversed ? 'top' : 'bottom';
                base.backgroundRepeat = 'no-repeat';
            } else {
                base.backgroundColor = fillColor;
            }
        }

        return base;
    };

    // Indicator style
    const getIndicatorStyle = (): CSSProperties => {
        const base: CSSProperties = {
            position: 'absolute',
            left: '50%',
            top: `${indicatorTop}px`,
            transform: 'translateX(-50%)',
            width: `${indicatorSize}px`,
            height: `${indicatorSize}px`,
            transition: 'top 0.3s ease-out',
            pointerEvents: 'none',
            zIndex: 10
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
                    base.animation = 'indicatorRotate 2s linear infinite';
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
            {/* Border container */}
            <div
                style={{
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                    border: borderEnabled ? `${borderWidth}px solid ${borderColor}` : 'none',
                    borderRadius: `${borderRadius}px`,
                    overflow: 'hidden',
                    boxSizing: 'border-box',
                    boxShadow: borderEnabled ? '0 4px 12px rgba(0, 0, 0, 0.3)' : '0 2px 8px rgba(0, 0, 0, 0.2)'
                }}
            >
                {/* Background */}
                <div style={getBackgroundStyle()} />

                {/* Fill */}
                <div style={getFillStyle()} />

                {/* Indicator */}
                {indicatorEnabled && fillHeight > 0 && fillHeight < size.height && (
                    <div style={getIndicatorStyle()} />
                )}
            </div>

            {/* Animations */}
            <style>{`
                @keyframes indicatorRotate {
                    from { transform: translateX(-50%) rotate(0deg); }
                    to { transform: translateX(-50%) rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
