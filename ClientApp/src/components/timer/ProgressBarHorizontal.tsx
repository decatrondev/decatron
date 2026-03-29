import { CSSProperties } from 'react';

interface ProgressBarHorizontalProps {
    progress: number; // 0-100
    orientation: 'left-to-right' | 'right-to-left';
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
    animatedStripes?: boolean; // Nuevo: Efecto de rayas animadas
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

export default function ProgressBarHorizontal(props: ProgressBarHorizontalProps) {
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
        animatedStripes = false, // Default false
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

    // Calculate fill width based on progress and orientation
    const fillWidth = (progress / 100) * size.width;
    const isReversed = orientation === 'right-to-left';

    // Indicator position (centered on the fill edge)
    const indicatorLeft = isReversed
        ? size.width - fillWidth - indicatorSize / 2
        : fillWidth - indicatorSize / 2;

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
            width: `${fillWidth}px`,
            height: '100%',
            position: 'absolute',
            top: 0,
            left: isReversed ? 'auto' : 0,
            right: isReversed ? 0 : 'auto',
            transition: 'width 0.3s ease-out',
            borderRadius: `${borderRadius}px`,
            overflow: 'hidden' // Importante para contener las rayas
        };

        if (fillType === 'color') {
            base.backgroundColor = fillColor;
        } else if (fillType === 'gradient') {
            base.background = `linear-gradient(${fillGradient.angle}deg, ${fillGradient.color1}, ${fillGradient.color2})`;
        } else if (fillType === 'image' || fillType === 'gif') {
            if (fillImage) {
                base.backgroundImage = `url(${fillImage})`;
                base.backgroundSize = 'cover';
                base.backgroundPosition = isReversed ? 'right' : 'left';
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
            left: `${indicatorLeft}px`,
            top: '50%',
            transform: 'translateY(-50%)', // Centrado vertical inicial
            width: `${indicatorSize}px`,
            height: `${indicatorSize}px`,
            transition: 'left 0.3s ease-out',
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
                    // Usamos una animación que preserve el translateY(-50%)
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

                {/* Fill Container (para manejar overflow de rayas) */}
                <div style={getFillStyle()}>
                    {/* Animated Stripes Overlay */}
                    {animatedStripes && (
                        <div
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,0.2) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.2) 75%, transparent 75%, transparent)',
                                backgroundSize: '40px 40px',
                                animation: 'moveStripes 1s linear infinite',
                                zIndex: 2
                            }}
                        />
                    )}
                </div>

                {/* Indicator */}
                {indicatorEnabled && fillWidth > 0 && fillWidth < size.width && (
                    <div style={getIndicatorStyle()} />
                )}
            </div>

            {/* Animations */}
            <style>{`
                @keyframes indicatorRotate {
                    from { transform: translateY(-50%) rotate(0deg); }
                    to { transform: translateY(-50%) rotate(360deg); }
                }
                @keyframes moveStripes {
                    from { background-position: 0 0; }
                    to { background-position: 40px 0; }
                }
            `}</style>
        </div>
    );
}