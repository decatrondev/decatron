-- Permite que el refresh_token de un access token emitido con PKCE (clientes
-- publicos, ej. apps de escritorio como Flowdeck, que no pueden guardar un
-- client_secret de forma segura) funcione sin exigir client_secret tambien al
-- refrescar (RFC 8252) -- antes lo exigia siempre, sin importar como se haya
-- canjeado el authorization_code original.
ALTER TABLE oauth_access_tokens ADD COLUMN IF NOT EXISTS was_pkce_used BOOLEAN NOT NULL DEFAULT false;
