-- Overlay de Promociones, Fase 7 (preparación): entregas medidas SOLO con el canal en directo y suma de espectadores en esas entregas.
-- views/seconds no cambian (siguen contando toda entrega); live_views y viewers_sum alimentan el informe del anunciante y, más adelante, la cotización.
-- Promedio de espectadores = viewers_sum / live_views. Agregado, no identifica a nadie.
ALTER TABLE promo_view_counts
    ADD COLUMN IF NOT EXISTS live_views   integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS viewers_sum  bigint  NOT NULL DEFAULT 0;
ALTER TABLE promo_piece_daily
    ADD COLUMN IF NOT EXISTS live_views   integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS viewers_sum  bigint  NOT NULL DEFAULT 0;
