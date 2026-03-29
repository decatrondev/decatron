
import os

file_path = "src/pages/TimerOverlay.tsx"

try:
    with open(file_path, "r") as f:
        content = f.read()

    # 1. Quitar el tiempo transcurrido de adentro del contenedor del tiempo principal
    # Buscamos el bloque que renderiza el counter y el elapsed time juntos
    old_block = """
                    <div
                        style={{
                            fontSize: `${styleConfig.timeFontSize}px`,
                            fontWeight: 'bold',
                            color: styleConfig.textColor,
                            textShadow: getTextShadowStyle(styleConfig.textShadow),
                            fontFamily: 'monospace',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        {remainingTimeString}
                    </div>
                    {displayConfig.showElapsedTime && (
                        <div
                            style={{
                                fontSize: `${styleConfig.timeFontSize * 0.35}px`,
                                fontWeight: '600',
                                color: styleConfig.textColor,
                                textShadow: getTextShadowStyle(styleConfig.textShadow),
                                fontFamily: 'monospace',
                                opacity: 0.7,
                                marginTop: '8px',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            +{elapsedTimeString}
                        </div>
                    )}"""
    
    new_block = """
                    <div
                        style={{
                            fontSize: `${styleConfig.timeFontSize}px`,
                            fontWeight: 'bold',
                            color: styleConfig.textColor,
                            textShadow: getTextShadowStyle(styleConfig.textShadow),
                            fontFamily: 'monospace',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        {remainingTimeString}
                    </div>"""
    
    content = content.replace(old_block, new_block)

    # 2. Agregar el Tiempo Transcurrido como un elemento absoluto independiente
    insertion_marker = "{Math.round(progress)}%\n                    </div>\n                )"
    
    elapsed_element = "\n                {/* 2.5 Tiempo Transcurrido (Independiente) */}
                {displayConfig.showElapsedTime && (
                    <div
                        style={{
                            position: 'absolute',
                            left: `${styleConfig.elapsedTimePosition?.x || 500}px`,
                            top: `${styleConfig.elapsedTimePosition?.y || 160}px`,
                            transform: 'translateX(-50%)',
                            fontSize: `${styleConfig.timeFontSize * 0.35}px`,
                            fontWeight: '600',
                            color: styleConfig.textColor,
                            textShadow: getTextShadowStyle(styleConfig.textShadow),
                            fontFamily: 'monospace',
                            opacity: 0.7,
                            whiteSpace: 'nowrap',
                            zIndex: 10
                        }}
                    >
                        +{elapsedTimeString}
                    </div>
                )}"
    
    content = content.replace(insertion_marker, insertion_marker + elapsed_element)

    with open(file_path, "w") as f:
        f.write(content)

    print("Successfully independent Elapsed Time in TimerOverlay.tsx")

except Exception as e:
    print(f"Error: {e}")
