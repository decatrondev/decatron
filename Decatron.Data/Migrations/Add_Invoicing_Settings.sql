-- Que empresa de DecatronAPI emite los comprobantes del bot.
--
-- Hasta ahora esto vivia en appsettings.Secrets.json, y cambiarlo obligaba a editar un
-- archivo en el servidor y reiniciar. El problema no es la comodidad: es que el dato mas
-- importante de todo el sistema de facturacion -- si lo que se emite es real o es beta --
-- no se veia desde ningun lado. Aca se guarda, y el admin lo muestra y lo cambia.
--
-- Una sola fila a proposito: el bot factura con una empresa, no con varias. El CHECK
-- sobre el id es lo que lo garantiza.
--
-- Ojo con que esto NO es el interruptor beta/produccion. Ese vive en la empresa, del lado
-- de DecatronAPI, y una empresa que ya emitio no puede cambiarlo: su correlativo es suyo,
-- y saltearlo hace que SUNAT observe la serie. Pasar a produccion es crear una empresa
-- nueva alla y elegirla aca.

CREATE TABLE IF NOT EXISTS invoicing_settings (
    id         INTEGER PRIMARY KEY DEFAULT 1,
    company_id INTEGER NOT NULL,

    -- Quien lo cambio y cuando. Cambiar de empresa emisora cambia con que RUC salen los
    -- comprobantes: si algun dia hay que reconstruir que paso, esto es el rastro.
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_by VARCHAR(100),

    CONSTRAINT chk_invoicing_single_row CHECK (id = 1)
);
