# Event Alerts Extension

Sistema modular de alertas para eventos de Twitch (follows, bits, subs, raids, etc.)

## 🏗️ Estructura

```
event-alerts-extension/
├── types/
│   └── index.ts                    # Tipos TypeScript completos
├── constants/
│   └── defaults.ts                 # Valores por defecto
├── hooks/
│   └── useEventAlertsConfig.ts     # Hook principal de estado
├── components/
│   └── tabs/
│       ├── GlobalTab.tsx           # ✅ IMPLEMENTADO
│       ├── FollowTab.tsx           # TODO
│       ├── BitsTab.tsx             # TODO
│       ├── SubsTab.tsx             # TODO
│       ├── GiftSubsTab.tsx         # TODO
│       ├── RaidsTab.tsx            # TODO
│       ├── ResubsTab.tsx           # TODO
│       ├── HypeTrainTab.tsx        # TODO
│       ├── MediaTab.tsx            # TODO
│       ├── TestingTab.tsx          # TODO
│       └── OverlayTab.tsx          # TODO
└── README.md                       # Este archivo
```

## ✅ Estado Actual

### Implementado:
- ✅ **Tipos completos** (EventAlertsConfig y todos los subtipos)
- ✅ **Defaults** (configuración por defecto exhaustiva)
- ✅ **Hook principal** (useEventAlertsConfig con estado y métodos)
- ✅ **GlobalTab** (configuración global completa)
- ✅ **Componente principal** (EventAlertsConfig.tsx)
- ✅ **Ruta configurada** (/overlays/event-alerts)
- ✅ **Enlace en menú Overlays**

### Próximos pasos:
1. Implementar tabs individuales (FollowTab, BitsTab, etc.)
2. Crear componentes especializados:
   - AlertTierManager (gestor de tiers/rangos)
   - AlertVariantEditor (editor de variantes)
   - AlertMediaSelector (selector de media avanzado)
3. Implementar preview de alertas
4. Conectar con backend (API + SignalR)
5. Crear overlay independiente para OBS

## 🎨 Diseño

El sistema sigue los mismos patrones del Timer Extension:
- **Modular**: 11 tabs independientes
- **Tipado fuerte**: TypeScript con interfaces exhaustivas
- **Reactivo**: Hooks personalizados para lógica
- **Persistente**: Configuración guardada en backend
- **Modo claro/oscuro**: Compatible con tema de la web

## 🚀 Uso

1. Acceder a `/overlays/event-alerts`
2. Configurar en la tab "Global" los valores por defecto
3. Configurar cada tipo de evento (follows, bits, etc.)
4. Testear alertas en la tab "Testing"
5. Copiar URL del overlay para OBS

## 📝 Notas

- El sistema NO está relacionado con el timer extensible (son independientes)
- La arquitectura está inspirada en el timer para mantener consistencia
- El modo oscuro/claro es solo para la interfaz web de configuración
- Las alertas en OBS funcionan con overlay transparente
