-- Modulo de Torneos - nombres de mecanica personalizables por edicion.
--
-- El sistema de "ficha que se lanza como castigo" y el de "factor de suerte de LP"
-- son mecanicas propias, pero los nombres de referencia que se usaron durante el
-- diseno (tomados del sitio auditado, soloqchallenge.gg) no se pueden usar como
-- nombre de producto — quedaria como una copia con otro logo. Cada canal-tenant
-- define su propio nombre para ambas mecanicas; el default es generico, no una
-- referencia al sitio original.

ALTER TABLE tournament_editions ADD COLUMN IF NOT EXISTS shell_item_name VARCHAR(60) NOT NULL DEFAULT 'Ficha de Castigo';
ALTER TABLE tournament_editions ADD COLUMN IF NOT EXISTS aegis_mechanic_name VARCHAR(60) NOT NULL DEFAULT 'Factor Suerte';
