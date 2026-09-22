-- Finanzas: las tarifas de créditos dejan de estar clavadas en el código.
-- Cada motor tiene su costo real de referencia y lo que se le cobra al canal; el margen
-- sale de la diferencia y lo decide el dueño, no el código.

ALTER TABLE finance_settings
    ADD COLUMN IF NOT EXISTS credit_usd NUMERIC(12,9) NOT NULL DEFAULT 0.000004,
    ADD COLUMN IF NOT EXISTS target_margin_percent NUMERIC(6,2) NOT NULL DEFAULT 30.00;

CREATE TABLE IF NOT EXISTS credit_rates (
    engine              TEXT PRIMARY KEY,
    label               TEXT NOT NULL,
    -- char | second | usd  (usd = el cobro sale del costo real de la llamada, como la IA)
    unit                TEXT NOT NULL DEFAULT 'char',
    credits_per_unit    NUMERIC(14,4) NOT NULL,
    -- Lo que cobra el proveedor por esa misma unidad, para calcular el margen real.
    provider_usd_per_unit NUMERIC(16,10) NOT NULL DEFAULT 0,
    enabled             BOOLEAN NOT NULL DEFAULT TRUE,
    notes               TEXT,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Valores de partida: el costo real de cada proveedor más el margen objetivo (30 %).
-- provider_usd_per_unit es el precio de lista del proveedor por carácter o por segundo.
INSERT INTO credit_rates (engine, label, unit, credits_per_unit, provider_usd_per_unit, notes) VALUES
    ('standard',      'Voz estándar (Piper, servidor propio)', 'char',   1,      0,            'No cuesta dinero: cobra a la bolsa estándar.'),
    ('neural',        'Polly neural',                          'char',   5.2,    0.000016,     'Polly neural $16/M + margen.'),
    ('generative',    'Polly generative',                      'char',   9.75,   0.000030,     'Polly generative $30/M + margen.'),
    ('longform',      'Polly long-form',                       'char',  32.5,    0.000100,     'Polly long-form $100/M + margen.'),
    ('long-form',     'Polly long-form (alias)',               'char',  32.5,    0.000100,     'Alias de longform.'),
    ('deepgram_aura', 'Deepgram Aura-2',                       'char',   9.75,   0.000030,     'Aura-2 $30/M + margen.'),
    ('fish',          'Fish Audio',                            'char',   4.875,  0.000015,     'Fish ~$15/M + margen.'),
    ('live_stt',      'Deepgram Nova-3 (escuchar)',            'second', 41.7,   0.00012833,   'Nova-3 streaming $0.0077/min = $0.00012833/s + margen. Se cobra el audio enviado, silencios incluidos, que es lo que factura Deepgram.'),
    ('ai',            'IA (OpenRouter / Gemini)',              'usd',    1.3,    0,            'Multiplicador sobre el costo real de la llamada: 1.3 = 30 % de margen.')
ON CONFLICT (engine) DO NOTHING;
