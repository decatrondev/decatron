-- Perfil de facturacion del comprador.
--
-- Tabla aparte a proposito: el bot no la mira nunca. Quien usa Decatron gratis no tiene
-- fila aca y no se entera de que existe. Solo se completa cuando alguien quiere comprar
-- algo que lleva comprobante.
--
-- Los datos viven aca una sola vez y de aca salen para toda compra futura, pero al
-- comprar se COPIAN a supporter_payments en vez de referenciarse: un comprobante es una
-- foto del dia en que se emitio, y si el usuario cambia su RUC el mes que viene el
-- documento ya emitido tiene que seguir diciendo lo que decia.

CREATE TABLE IF NOT EXISTS billing_profiles (
    id          SERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

    -- ISO-3166 alpha-2. 'PE' = venta interna; cualquier otro = exportacion de servicios,
    -- que va con factura y sin IGV.
    country     VARCHAR(2)  NOT NULL DEFAULT 'PE',

    -- Nombres del catalogo 06 tal como los espera DecatronAPI: DNI, RUC, CE, PASAPORTE,
    -- DOC_PAIS_RESIDENCIA, TIN, IN, CEDULA_DIPLOMATICA.
    doc_type    VARCHAR(30) NOT NULL,
    doc_number  VARCHAR(20) NOT NULL,

    -- Nombre de la persona o razon social de la empresa. Para RUC lo trae SUNAT via
    -- GET /ruc/:ruc de DecatronAPI, para que nadie lo escriba a mano: una factura a
    -- nombre equivocado es un documento defectuoso.
    legal_name  VARCHAR(200) NOT NULL,

    -- Opcionales. La direccion no es obligatoria en el comprobante, pero si esta se pone.
    address     VARCHAR(300),
    email       VARCHAR(255),

    -- Se guarda de donde salio la razon social, para saber cual confiar. 'sunat' cuando
    -- la trajo la consulta de RUC, 'manual' cuando la escribio el usuario.
    name_source VARCHAR(10) NOT NULL DEFAULT 'manual',

    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_billing_country   CHECK (country ~ '^[A-Z]{2}$'),
    CONSTRAINT chk_billing_docnumber CHECK (length(trim(doc_number)) > 0),
    CONSTRAINT chk_billing_name      CHECK (length(trim(legal_name)) > 0),
    CONSTRAINT chk_billing_source    CHECK (name_source IN ('manual', 'sunat'))
);

CREATE INDEX IF NOT EXISTS idx_billing_profiles_doc
    ON billing_profiles (doc_type, doc_number);
