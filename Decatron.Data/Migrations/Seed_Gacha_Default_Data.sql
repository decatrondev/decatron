-- ============================================================
-- GACHA SYSTEM - Default Data Seed
-- Initializes default rarity probabilities for existing channels
-- ============================================================

-- Insert default rarity probabilities for channels that have gacha linked accounts
-- Each channel gets the standard 5-tier rarity system

-- Common defaults: Common 50%, Uncommon 25%, Rare 15%, Epic 7%, Legendary 3%

-- For all active channels in the system, seed default rarity configs
-- (Channels can customize these later via the dashboard)

DO $$
DECLARE
    channel_record RECORD;
BEGIN
    FOR channel_record IN
        SELECT DISTINCT u.login as channel_name
        FROM users u
        WHERE u.is_active = TRUE
        AND u.login IS NOT NULL
        LIMIT 50
    LOOP
        -- Only insert if no config exists yet for this channel
        IF NOT EXISTS (SELECT 1 FROM gacha_rarity_configs WHERE channel_name = channel_record.channel_name) THEN
            INSERT INTO gacha_rarity_configs (channel_name, rarity, probability) VALUES
                (channel_record.channel_name, 'common', 50.00),
                (channel_record.channel_name, 'uncommon', 25.00),
                (channel_record.channel_name, 'rare', 15.00),
                (channel_record.channel_name, 'epic', 7.00),
                (channel_record.channel_name, 'legendary', 3.00);

            RAISE NOTICE 'Seeded rarity config for channel: %', channel_record.channel_name;
        END IF;
    END LOOP;
END $$;

-- Verify
SELECT channel_name, rarity, probability
FROM gacha_rarity_configs
ORDER BY channel_name, probability DESC;
