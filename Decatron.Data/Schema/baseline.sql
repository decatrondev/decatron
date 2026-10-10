-- Decatron baseline schema (PostgreSQL 16)
--
-- Generated from the production database with:
--   pg_dump --schema-only --no-owner --no-privileges --no-comments
-- It contains structure only: no data, no roles, no secrets.
--
-- Use it to create an EMPTY database:
--   createdb -O decatron_user decatron
--   psql -U decatron_user -d decatron -f Decatron.Data/Schema/baseline.sql
--
-- Tables created after this snapshot are added by the incremental scripts in
-- Decatron.Data/Migrations/. After loading the baseline, apply only the scripts
-- added to that folder after this file was generated (see git history).
--
-- Snapshot date: 2026-10-10
--
-- PostgreSQL database dump
--


-- Dumped from database version 16.13 (Ubuntu 16.13-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 16.13 (Ubuntu 16.13-0ubuntu0.24.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: cleanup_expired_oauth_tokens(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_expired_oauth_tokens() RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Eliminar códigos de autorización expirados (más de 1 hora)
    DELETE FROM oauth_authorization_codes
    WHERE expires_at < NOW() - INTERVAL '1 hour';

    -- Eliminar refresh tokens expirados (más de 7 días después de expiración)
    DELETE FROM oauth_refresh_tokens
    WHERE expires_at < NOW() - INTERVAL '7 days';

    -- Eliminar access tokens expirados y revocados (más de 7 días)
    DELETE FROM oauth_access_tokens
    WHERE (expires_at < NOW() - INTERVAL '7 days')
       OR (revoked = true AND created_at < NOW() - INTERVAL '7 days');

    RAISE NOTICE 'OAuth tokens cleanup completed at %', NOW();
END;
$$;


--
-- Name: update_timer_config_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_timer_config_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: __EFMigrationsHistory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."__EFMigrationsHistory" (
    "MigrationId" character varying(150) NOT NULL,
    "ProductVersion" character varying(32) NOT NULL
);


--
-- Name: accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounts (
    id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: accounts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.accounts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: accounts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.accounts_id_seq OWNED BY public.accounts.id;


--
-- Name: admin_mod_actions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_mod_actions (
    id bigint NOT NULL,
    channel_user_id bigint NOT NULL,
    channel_login character varying(100) NOT NULL,
    target character varying(20) NOT NULL,
    target_login character varying(100) NOT NULL,
    action character varying(10) NOT NULL,
    success boolean NOT NULL,
    error character varying(500),
    admin_user_id bigint NOT NULL,
    admin_login character varying(100) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: admin_mod_actions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.admin_mod_actions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: admin_mod_actions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.admin_mod_actions_id_seq OWNED BY public.admin_mod_actions.id;


--
-- Name: ai_usage_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_usage_logs (
    id bigint NOT NULL,
    module character varying(40) NOT NULL,
    provider character varying(20) NOT NULL,
    model character varying(120) NOT NULL,
    user_id bigint DEFAULT 0 NOT NULL,
    channel_name character varying(100),
    prompt_tokens integer DEFAULT 0 NOT NULL,
    completion_tokens integer DEFAULT 0 NOT NULL,
    estimated_cost_usd numeric(12,6) DEFAULT 0 NOT NULL,
    response_time_ms integer DEFAULT 0 NOT NULL,
    success boolean DEFAULT true NOT NULL,
    error_message character varying(300),
    used_at timestamp with time zone DEFAULT now() NOT NULL,
    credits_charged bigint
);


--
-- Name: ai_usage_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ai_usage_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ai_usage_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ai_usage_logs_id_seq OWNED BY public.ai_usage_logs.id;


--
-- Name: banned_words; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.banned_words (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    channel_name character varying(100) NOT NULL,
    word character varying(500) NOT NULL,
    severity character varying(20) DEFAULT 'leve'::character varying NOT NULL,
    detections integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_severity CHECK (((severity)::text = ANY (ARRAY[('leve'::character varying)::text, ('medio'::character varying)::text, ('severo'::character varying)::text])))
);


--
-- Name: banned_words_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.banned_words_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: banned_words_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.banned_words_id_seq OWNED BY public.banned_words.id;


--
-- Name: billing_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.billing_profiles (
    id integer NOT NULL,
    user_id bigint NOT NULL,
    country character varying(2) DEFAULT 'PE'::character varying NOT NULL,
    doc_type character varying(30) NOT NULL,
    doc_number character varying(20) NOT NULL,
    legal_name character varying(200) NOT NULL,
    address character varying(300),
    email character varying(255),
    name_source character varying(10) DEFAULT 'manual'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_billing_country CHECK (((country)::text ~ '^[A-Z]{2}$'::text)),
    CONSTRAINT chk_billing_docnumber CHECK ((length(TRIM(BOTH FROM doc_number)) > 0)),
    CONSTRAINT chk_billing_name CHECK ((length(TRIM(BOTH FROM legal_name)) > 0)),
    CONSTRAINT chk_billing_source CHECK (((name_source)::text = ANY ((ARRAY['manual'::character varying, 'sunat'::character varying])::text[])))
);


--
-- Name: billing_profiles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.billing_profiles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: billing_profiles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.billing_profiles_id_seq OWNED BY public.billing_profiles.id;


--
-- Name: bot_catalog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bot_catalog (
    id bigint NOT NULL,
    platform character varying(10) DEFAULT 'twitch'::character varying NOT NULL,
    username character varying(100) NOT NULL,
    display_name character varying(100) NOT NULL,
    category character varying(20) NOT NULL,
    notes character varying(300),
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_bot_catalog_category CHECK (((category)::text = ANY ((ARRAY['competencia'::character varying, 'moderacion'::character varying, 'musica'::character varying, 'alertas'::character varying, 'utilidad'::character varying, 'propio'::character varying])::text[]))),
    CONSTRAINT chk_bot_catalog_platform CHECK (((platform)::text = ANY ((ARRAY['twitch'::character varying, 'kick'::character varying, 'youtube'::character varying])::text[])))
);


--
-- Name: bot_catalog_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bot_catalog_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bot_catalog_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bot_catalog_id_seq OWNED BY public.bot_catalog.id;


--
-- Name: bot_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bot_tokens (
    "Id" integer NOT NULL,
    bot_username character varying(100) NOT NULL,
    bot_twitch_id character varying(50),
    access_token character varying(500) NOT NULL,
    refresh_token character varying(500),
    chat_token character varying(500) NOT NULL,
    token_expiration timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    is_active boolean NOT NULL
);


--
-- Name: bot_tokens_Id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.bot_tokens ALTER COLUMN "Id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."bot_tokens_Id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: brand_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.brand_assets (
    id bigint NOT NULL,
    name character varying(120) DEFAULT ''::character varying NOT NULL,
    file_name character varying(200) NOT NULL,
    url character varying(500) NOT NULL,
    width integer DEFAULT 0 NOT NULL,
    height integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: brand_assets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.brand_assets_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: brand_assets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.brand_assets_id_seq OWNED BY public.brand_assets.id;


--
-- Name: brand_slots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.brand_slots (
    slot_key character varying(60) NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: card_event_banners; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.card_event_banners (
    id integer NOT NULL,
    event_id character varying(50) NOT NULL,
    starts_at timestamp without time zone NOT NULL,
    ends_at timestamp without time zone NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_ceb_dates CHECK ((ends_at > starts_at))
);


--
-- Name: card_event_banners_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.card_event_banners_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: card_event_banners_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.card_event_banners_id_seq OWNED BY public.card_event_banners.id;


--
-- Name: card_level_art; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.card_level_art (
    id bigint NOT NULL,
    card_id uuid NOT NULL,
    level smallint NOT NULL,
    image_path text,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    requested_at timestamp without time zone DEFAULT now() NOT NULL,
    completed_at timestamp without time zone,
    CONSTRAINT chk_cla_level CHECK (((level >= 1) AND (level <= 10))),
    CONSTRAINT chk_cla_status CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'generating'::character varying, 'done'::character varying])::text[])))
);


--
-- Name: card_level_art_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.card_level_art_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: card_level_art_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.card_level_art_id_seq OWNED BY public.card_level_art.id;


--
-- Name: card_sobre_tiers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.card_sobre_tiers (
    id integer NOT NULL,
    name character varying(50) NOT NULL,
    card_count smallint NOT NULL,
    price_coins integer NOT NULL,
    guaranteed_floor_rarity character varying(10) NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    free_cooldown_hours integer,
    CONSTRAINT chk_cst_card_count CHECK ((card_count > 0)),
    CONSTRAINT chk_cst_floor CHECK (((guaranteed_floor_rarity)::text = ANY ((ARRAY['N'::character varying, 'R'::character varying, 'SR'::character varying, 'SSR'::character varying, 'UR'::character varying, 'LR'::character varying, 'MR'::character varying])::text[]))),
    CONSTRAINT chk_cst_free_cooldown CHECK (((free_cooldown_hours IS NULL) OR (free_cooldown_hours > 0))),
    CONSTRAINT chk_cst_price CHECK ((price_coins > 0))
);


--
-- Name: card_sobre_tiers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.card_sobre_tiers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: card_sobre_tiers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.card_sobre_tiers_id_seq OWNED BY public.card_sobre_tiers.id;


--
-- Name: cards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    rarity text NOT NULL,
    element text NOT NULL,
    class text NOT NULL,
    story text,
    personality text,
    hp integer,
    atk integer,
    def integer,
    spd integer,
    abilities jsonb,
    tags text[],
    image_path text,
    seed bigint,
    prompt text,
    negative_prompt text,
    lora_used text,
    event_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    combo_hash text,
    gender text DEFAULT 'female'::text NOT NULL,
    animated boolean DEFAULT false NOT NULL
);


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    "Id" bigint NOT NULL,
    name character varying(255) NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: categories_Id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.categories ALTER COLUMN "Id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."categories_Id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: channel_bot_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_bot_entries (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    platform character varying(10) DEFAULT 'twitch'::character varying NOT NULL,
    username character varying(100) NOT NULL,
    display_name character varying(100),
    category character varying(20),
    is_custom boolean DEFAULT false NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    hide_overlay boolean,
    skip_counting boolean,
    skip_commands boolean,
    skip_moderation boolean,
    skip_speech boolean,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_channel_bot_category CHECK (((category IS NULL) OR ((category)::text = ANY ((ARRAY['competencia'::character varying, 'moderacion'::character varying, 'musica'::character varying, 'alertas'::character varying, 'utilidad'::character varying, 'propio'::character varying])::text[])))),
    CONSTRAINT chk_channel_bot_platform CHECK (((platform)::text = ANY ((ARRAY['twitch'::character varying, 'kick'::character varying, 'youtube'::character varying])::text[])))
);


--
-- Name: channel_bot_entries_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.channel_bot_entries_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: channel_bot_entries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.channel_bot_entries_id_seq OWNED BY public.channel_bot_entries.id;


--
-- Name: channel_emote_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_emote_reports (
    id bigint NOT NULL,
    emote_id bigint NOT NULL,
    reporter_user_id bigint NOT NULL,
    reason character varying(300),
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: channel_emote_reports_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.channel_emote_reports_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: channel_emote_reports_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.channel_emote_reports_id_seq OWNED BY public.channel_emote_reports.id;


--
-- Name: channel_emote_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_emote_settings (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    upload_mode character varying(10) DEFAULT 'staff'::character varying NOT NULL,
    max_pending_per_user integer DEFAULT 5 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_channel_emote_mode CHECK (((upload_mode)::text = ANY ((ARRAY['owner'::character varying, 'staff'::character varying, 'approval'::character varying, 'list'::character varying])::text[]))),
    CONSTRAINT chk_channel_emote_pending CHECK (((max_pending_per_user >= 1) AND (max_pending_per_user <= 50)))
);


--
-- Name: channel_emote_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.channel_emote_settings_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: channel_emote_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.channel_emote_settings_id_seq OWNED BY public.channel_emote_settings.id;


--
-- Name: channel_emote_uploaders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_emote_uploaders (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    platform character varying(10) DEFAULT 'twitch'::character varying NOT NULL,
    login character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_channel_emote_uploader_platform CHECK (((platform)::text = ANY ((ARRAY['twitch'::character varying, 'kick'::character varying])::text[])))
);


--
-- Name: channel_emote_uploaders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.channel_emote_uploaders_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: channel_emote_uploaders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.channel_emote_uploaders_id_seq OWNED BY public.channel_emote_uploaders.id;


--
-- Name: channel_emotes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_emotes (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    name character varying(25) NOT NULL,
    file_key character varying(32) NOT NULL,
    animated boolean DEFAULT false NOT NULL,
    zero_width boolean DEFAULT false NOT NULL,
    width integer NOT NULL,
    height integer NOT NULL,
    bytes integer NOT NULL,
    status character varying(10) DEFAULT 'pending'::character varying NOT NULL,
    uploaded_by bigint NOT NULL,
    uploaded_by_name character varying(100) NOT NULL,
    reviewed_by_name character varying(100),
    reviewed_at timestamp without time zone,
    reason character varying(300),
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_channel_emote_status CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'hidden'::character varying, 'rejected'::character varying, 'removed'::character varying])::text[])))
);


--
-- Name: channel_emotes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.channel_emotes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: channel_emotes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.channel_emotes_id_seq OWNED BY public.channel_emotes.id;


--
-- Name: channel_followers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_followers (
    id bigint NOT NULL,
    broadcaster_id character varying(50) NOT NULL,
    broadcaster_name character varying(100) NOT NULL,
    user_id character varying(50) NOT NULL,
    user_name character varying(150) NOT NULL,
    user_login character varying(100) NOT NULL,
    followed_at timestamp without time zone NOT NULL,
    account_created_at timestamp without time zone,
    is_following integer DEFAULT 0 NOT NULL,
    unfollowed_at timestamp without time zone,
    is_blocked integer DEFAULT 0 NOT NULL,
    was_blocked integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: channel_followers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.channel_followers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: channel_followers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.channel_followers_id_seq OWNED BY public.channel_followers.id;


--
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_messages (
    "Id" bigint NOT NULL,
    channel character varying(100) NOT NULL,
    username character varying(100) NOT NULL,
    user_id character varying(50) NOT NULL,
    message text NOT NULL,
    "timestamp" timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: chat_messages_Id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.chat_messages ALTER COLUMN "Id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."chat_messages_Id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: chat_overlay_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_overlay_configs (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: chat_overlay_configs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.chat_overlay_configs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: chat_overlay_configs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.chat_overlay_configs_id_seq OWNED BY public.chat_overlay_configs.id;


--
-- Name: coin_discount_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coin_discount_codes (
    id bigint NOT NULL,
    code text NOT NULL,
    discount_type text NOT NULL,
    discount_value numeric(10,2) NOT NULL,
    assigned_user_id bigint,
    max_uses integer,
    current_uses integer DEFAULT 0 NOT NULL,
    max_uses_per_user integer DEFAULT 1 NOT NULL,
    min_purchase_usd numeric(10,2) DEFAULT 0 NOT NULL,
    applicable_package_id bigint,
    combinable_with_first_purchase boolean DEFAULT true NOT NULL,
    starts_at timestamp without time zone,
    expires_at timestamp without time zone,
    enabled boolean DEFAULT true NOT NULL,
    created_by bigint,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_discount_type CHECK ((discount_type = ANY (ARRAY['percentage'::text, 'fixed_amount'::text, 'bonus_coins'::text])))
);


--
-- Name: coin_discount_codes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.coin_discount_codes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: coin_discount_codes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.coin_discount_codes_id_seq OWNED BY public.coin_discount_codes.id;


--
-- Name: coin_discount_uses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coin_discount_uses (
    id bigint NOT NULL,
    code_id bigint NOT NULL,
    user_id bigint NOT NULL,
    purchase_id bigint,
    discount_applied numeric(10,2) DEFAULT 0 NOT NULL,
    used_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: coin_discount_uses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.coin_discount_uses_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: coin_discount_uses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.coin_discount_uses_id_seq OWNED BY public.coin_discount_uses.id;


--
-- Name: coin_flags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coin_flags (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    flag_type text NOT NULL,
    flag_reason text NOT NULL,
    flag_details jsonb,
    status text DEFAULT 'pending'::text NOT NULL,
    resolved_by bigint,
    resolved_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_flag_status CHECK ((status = ANY (ARRAY['pending'::text, 'resolved_ok'::text, 'resolved_banned'::text]))),
    CONSTRAINT chk_flag_type CHECK ((flag_type = ANY (ARRAY['rapid_transfers'::text, 'high_balance_transfer_new_account'::text, 'coupon_then_transfer'::text, 'multi_account_ip'::text])))
);


--
-- Name: coin_flags_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.coin_flags_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: coin_flags_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.coin_flags_id_seq OWNED BY public.coin_flags.id;


--
-- Name: coin_packages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coin_packages (
    id bigint NOT NULL,
    name text NOT NULL,
    description text,
    coins integer NOT NULL,
    bonus_coins integer DEFAULT 0 NOT NULL,
    price_usd numeric(10,2) NOT NULL,
    icon text,
    is_offer boolean DEFAULT false NOT NULL,
    offer_starts_at timestamp without time zone,
    offer_expires_at timestamp without time zone,
    first_purchase_only boolean DEFAULT false NOT NULL,
    max_per_transaction integer DEFAULT 1 NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: coin_packages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.coin_packages_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: coin_packages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.coin_packages_id_seq OWNED BY public.coin_packages.id;


--
-- Name: coin_pending_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coin_pending_orders (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    package_id bigint,
    paypal_order_id text,
    discount_code_id bigint,
    final_price_usd numeric(10,2) NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    custom_coins integer,
    CONSTRAINT chk_pending_status CHECK ((status = ANY (ARRAY['pending'::text, 'completed'::text, 'expired'::text])))
);


--
-- Name: coin_pending_orders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.coin_pending_orders_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: coin_pending_orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.coin_pending_orders_id_seq OWNED BY public.coin_pending_orders.id;


--
-- Name: coin_purchases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coin_purchases (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    package_id bigint,
    coins_received integer NOT NULL,
    amount_paid_usd numeric(10,2) DEFAULT 0 NOT NULL,
    paypal_order_id text,
    paypal_status text,
    discount_code_id bigint,
    discount_amount numeric(10,2) DEFAULT 0 NOT NULL,
    bonus_coins_from_coupon integer DEFAULT 0 NOT NULL,
    bonus_coupon_scheduled_at timestamp without time zone,
    bonus_coupon_credited_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    custom_coins integer,
    customer_name text,
    customer_email text,
    customer_country text,
    customer_doc_type text,
    customer_doc_number text,
    prefer_factura boolean DEFAULT false NOT NULL,
    charged_amount numeric(10,2),
    charged_currency text,
    invoice_status text,
    invoice_document_id integer,
    invoice_type text,
    invoice_series text,
    invoice_number integer,
    invoice_error text,
    invoice_attempts integer DEFAULT 0 NOT NULL,
    invoice_last_attempt_at timestamp without time zone,
    is_test boolean DEFAULT false NOT NULL
);


--
-- Name: coin_purchases_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.coin_purchases_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: coin_purchases_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.coin_purchases_id_seq OWNED BY public.coin_purchases.id;


--
-- Name: coin_referrals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coin_referrals (
    id bigint NOT NULL,
    referrer_user_id bigint NOT NULL,
    referred_user_id bigint NOT NULL,
    referral_code text NOT NULL,
    bonus_given_to_referrer integer DEFAULT 0 NOT NULL,
    bonus_given_to_referred integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    completed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_referral_status CHECK ((status = ANY (ARRAY['pending'::text, 'completed'::text, 'rejected'::text])))
);


--
-- Name: coin_referrals_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.coin_referrals_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: coin_referrals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.coin_referrals_id_seq OWNED BY public.coin_referrals.id;


--
-- Name: coin_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coin_settings (
    id integer NOT NULL,
    currency_name text DEFAULT 'DecaCoins'::text NOT NULL,
    currency_icon text DEFAULT 'coins'::text NOT NULL,
    max_transfer_per_day integer DEFAULT 5000 NOT NULL,
    max_transfers_per_day integer DEFAULT 10 NOT NULL,
    min_transfer_amount integer DEFAULT 10 NOT NULL,
    min_account_age_to_transfer_days integer DEFAULT 7 NOT NULL,
    min_account_age_to_receive_days integer DEFAULT 3 NOT NULL,
    max_referrals_per_user integer,
    referral_bonus_referrer integer DEFAULT 50 NOT NULL,
    referral_bonus_referred integer DEFAULT 50 NOT NULL,
    referral_min_activity_days integer DEFAULT 7 NOT NULL,
    first_purchase_bonus_percent integer DEFAULT 50 NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: coin_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.coin_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: coin_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.coin_settings_id_seq OWNED BY public.coin_settings.id;


--
-- Name: coin_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coin_transactions (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    amount integer NOT NULL,
    balance_after bigint DEFAULT 0 NOT NULL,
    type text NOT NULL,
    description text,
    related_user_id bigint,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_transaction_type CHECK ((type = ANY (ARRAY['purchase'::text, 'admin_gift'::text, 'admin_remove'::text, 'transfer_in'::text, 'transfer_out'::text, 'marketplace_buy'::text, 'referral_bonus'::text, 'coupon_bonus'::text, 'gacha_purchase'::text, 'tcg_sobre_purchase'::text, 'tcg_upgrade_payment'::text, 'wheel_credits'::text])))
);


--
-- Name: coin_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.coin_transactions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: coin_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.coin_transactions_id_seq OWNED BY public.coin_transactions.id;


--
-- Name: coin_transfers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coin_transfers (
    id bigint NOT NULL,
    from_user_id bigint NOT NULL,
    to_user_id bigint NOT NULL,
    amount integer NOT NULL,
    message text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: coin_transfers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.coin_transfers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: coin_transfers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.coin_transfers_id_seq OWNED BY public.coin_transfers.id;


--
-- Name: command_counters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.command_counters (
    id bigint NOT NULL,
    channel_name character varying(100) NOT NULL,
    command_name character varying(100) NOT NULL,
    counter_value integer DEFAULT 0 NOT NULL,
    last_modified_by character varying(100),
    last_modified_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL,
    user_id bigint NOT NULL
);


--
-- Name: command_counters_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.command_counters ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.command_counters_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: command_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.command_settings (
    "Id" bigint NOT NULL,
    user_id bigint NOT NULL,
    command_name character varying(100) NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: command_settings_Id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.command_settings ALTER COLUMN "Id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."command_settings_Id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: command_uses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.command_uses (
    id bigint NOT NULL,
    channel_name character varying(100) NOT NULL,
    command_name character varying(100) NOT NULL,
    use_count integer DEFAULT 0 NOT NULL,
    last_used_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL,
    user_id bigint NOT NULL
);


--
-- Name: command_uses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.command_uses ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.command_uses_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: credit_packages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credit_packages (
    id bigint NOT NULL,
    name text NOT NULL,
    description text,
    credits bigint NOT NULL,
    bonus_credits bigint DEFAULT 0 NOT NULL,
    price_usd numeric(10,2) NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    highlight boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: credit_packages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.credit_packages_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: credit_packages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.credit_packages_id_seq OWNED BY public.credit_packages.id;


--
-- Name: credit_purchases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credit_purchases (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    package_id bigint,
    credits_received integer NOT NULL,
    amount_paid_usd numeric(10,2) NOT NULL,
    charge_id text,
    charge_status text,
    charged_amount numeric(10,2),
    charged_currency text,
    customer_name text,
    customer_email text,
    customer_country text,
    customer_doc_type text,
    customer_doc_number text,
    prefer_factura boolean DEFAULT false NOT NULL,
    is_test boolean DEFAULT false NOT NULL,
    invoice_status text,
    invoice_document_id integer,
    invoice_type text,
    invoice_series text,
    invoice_number integer,
    invoice_error text,
    invoice_attempts integer DEFAULT 0 NOT NULL,
    invoice_last_attempt_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL
);


--
-- Name: credit_purchases_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.credit_purchases_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: credit_purchases_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.credit_purchases_id_seq OWNED BY public.credit_purchases.id;


--
-- Name: credit_rates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credit_rates (
    engine text NOT NULL,
    label text NOT NULL,
    unit text DEFAULT 'char'::text NOT NULL,
    credits_per_unit numeric(14,4) NOT NULL,
    provider_usd_per_unit numeric(16,10) DEFAULT 0 NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    notes text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: custom_commands; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.custom_commands (
    "Id" integer NOT NULL,
    channel_name character varying(100) NOT NULL,
    command_name character varying(100) NOT NULL,
    response text NOT NULL,
    restriction character varying(50) DEFAULT 'all'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by character varying(100) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    is_scripted boolean DEFAULT false NOT NULL,
    script_content text,
    user_id bigint NOT NULL
);


--
-- Name: custom_commands_Id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.custom_commands ALTER COLUMN "Id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."custom_commands_Id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: decatron_ai_channel_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.decatron_ai_channel_config (
    id bigint NOT NULL,
    channel_name character varying(100) NOT NULL,
    permission_level character varying(50) DEFAULT 'everyone'::character varying NOT NULL,
    whitelist_enabled boolean DEFAULT false NOT NULL,
    whitelist_users text DEFAULT '[]'::text,
    blacklist_users text DEFAULT '[]'::text,
    channel_cooldown_seconds integer DEFAULT 300 NOT NULL,
    user_cooldown_seconds integer,
    custom_prefix character varying(100) DEFAULT NULL::character varying,
    custom_system_prompt text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    user_id bigint NOT NULL
);


--
-- Name: decatron_ai_channel_config_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.decatron_ai_channel_config_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: decatron_ai_channel_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.decatron_ai_channel_config_id_seq OWNED BY public.decatron_ai_channel_config.id;


--
-- Name: decatron_ai_channel_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.decatron_ai_channel_permissions (
    id bigint NOT NULL,
    channel_name character varying(100) NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    can_configure boolean DEFAULT false NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    user_id bigint NOT NULL
);


--
-- Name: decatron_ai_channel_permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.decatron_ai_channel_permissions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: decatron_ai_channel_permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.decatron_ai_channel_permissions_id_seq OWNED BY public.decatron_ai_channel_permissions.id;


--
-- Name: decatron_ai_global_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.decatron_ai_global_config (
    id bigint NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    model character varying(100) DEFAULT 'gemini-2.0-flash-lite'::character varying NOT NULL,
    max_tokens integer DEFAULT 60 NOT NULL,
    system_prompt text DEFAULT 'Eres Decatron IA, un asistente de chat desarrollado por AnthonyDeca. Responde de forma breve, amigable y útil. Máximo 2-3 oraciones.'::text NOT NULL,
    response_prefix character varying(100) DEFAULT '🤖 Decatron IA:'::character varying NOT NULL,
    global_cooldown_seconds integer DEFAULT 30 NOT NULL,
    min_channel_cooldown_seconds integer DEFAULT 120 NOT NULL,
    default_channel_cooldown_seconds integer DEFAULT 300 NOT NULL,
    max_prompt_length integer DEFAULT 200 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    ai_provider character varying(50) DEFAULT 'gemini'::character varying,
    fallback_enabled boolean DEFAULT false,
    openrouter_model character varying(100) DEFAULT 'x-ai/grok-4.1-fast:free'::character varying,
    translation_model character varying(120) DEFAULT 'qwen/qwen3.8-flash'::character varying NOT NULL,
    coach_model character varying(120) DEFAULT 'qwen/qwen3.8-flash'::character varying NOT NULL,
    model_prices_json text DEFAULT '{"qwen/qwen3.8-flash":{"in":0.15,"out":0.47},"deepseek/deepseek-v4.1-flash":{"in":0.30,"out":1.20},"x-ai/grok-4.1-fast:free":{"in":0,"out":0},"gemini-3.5-flash-lite":{"in":0.30,"out":2.50},"gemini-2.5-flash-lite":{"in":0.10,"out":0.40}}'::text NOT NULL,
    fallback_models character varying(400) DEFAULT 'openai/gpt-6-luna,deepseek/deepseek-v4.1-flash'::character varying NOT NULL
);


--
-- Name: decatron_ai_global_config_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.decatron_ai_global_config_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: decatron_ai_global_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.decatron_ai_global_config_id_seq OWNED BY public.decatron_ai_global_config.id;


--
-- Name: decatron_ai_usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.decatron_ai_usage (
    id bigint NOT NULL,
    channel_name character varying(100) NOT NULL,
    username character varying(100) NOT NULL,
    prompt text NOT NULL,
    response text,
    tokens_used integer DEFAULT 0,
    response_time_ms integer DEFAULT 0,
    success boolean DEFAULT true NOT NULL,
    error_message text,
    used_at timestamp without time zone DEFAULT now() NOT NULL,
    user_id bigint NOT NULL
);


--
-- Name: decatron_ai_usage_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.decatron_ai_usage_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: decatron_ai_usage_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.decatron_ai_usage_id_seq OWNED BY public.decatron_ai_usage.id;


--
-- Name: decatron_chat_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.decatron_chat_config (
    id bigint NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    ai_provider character varying(50) DEFAULT 'gemini'::character varying NOT NULL,
    fallback_enabled boolean DEFAULT false NOT NULL,
    model character varying(100) DEFAULT 'gemini-2.0-flash-exp'::character varying NOT NULL,
    openrouter_model character varying(100) DEFAULT 'x-ai/grok-4.1-fast:free'::character varying,
    max_tokens integer DEFAULT 2000 NOT NULL,
    system_prompt text DEFAULT 'Eres Decatron IA, un asistente de programación avanzado creado por AnthonyDeca. Puedes generar código en cualquier lenguaje, explicar conceptos técnicos, depurar errores, ayudar con arquitectura de software, y mantener conversaciones técnicas extensas. Usa bloques de código markdown con ```lenguaje cuando generes código. Sé claro, preciso y profesional.'::text NOT NULL,
    max_conversations_per_user integer DEFAULT 50 NOT NULL,
    max_messages_per_conversation integer DEFAULT 100 NOT NULL,
    context_messages integer DEFAULT 10 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: decatron_chat_config_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.decatron_chat_config_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: decatron_chat_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.decatron_chat_config_id_seq OWNED BY public.decatron_chat_config.id;


--
-- Name: decatron_chat_conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.decatron_chat_conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id bigint NOT NULL,
    channel_owner_id bigint NOT NULL,
    title character varying(200) DEFAULT 'Nueva conversación'::character varying NOT NULL,
    message_count integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: decatron_chat_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.decatron_chat_messages (
    id bigint NOT NULL,
    conversation_id uuid NOT NULL,
    user_id bigint NOT NULL,
    role character varying(20) NOT NULL,
    content text NOT NULL,
    tokens_used integer DEFAULT 0 NOT NULL,
    response_time_ms integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT decatron_chat_messages_role_check CHECK (((role)::text = ANY (ARRAY[('user'::character varying)::text, ('assistant'::character varying)::text])))
);


--
-- Name: decatron_chat_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.decatron_chat_messages_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: decatron_chat_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.decatron_chat_messages_id_seq OWNED BY public.decatron_chat_messages.id;


--
-- Name: decatron_chat_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.decatron_chat_permissions (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    channel_owner_id bigint NOT NULL,
    can_view boolean DEFAULT true NOT NULL,
    can_chat boolean DEFAULT false NOT NULL,
    granted_by bigint NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: decatron_chat_permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.decatron_chat_permissions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: decatron_chat_permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.decatron_chat_permissions_id_seq OWNED BY public.decatron_chat_permissions.id;


--
-- Name: design_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.design_versions (
    id bigint NOT NULL,
    status character varying(12) NOT NULL,
    values_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    note character varying(200) DEFAULT ''::character varying NOT NULL,
    author_login character varying(100) DEFAULT ''::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    published_at timestamp with time zone,
    CONSTRAINT design_versions_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'published'::character varying, 'archived'::character varying])::text[])))
);


--
-- Name: design_versions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.design_versions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: design_versions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.design_versions_id_seq OWNED BY public.design_versions.id;


--
-- Name: desktop_devices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.desktop_devices (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    name character varying(80) DEFAULT ''::character varying NOT NULL,
    token_hash character varying(64) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_seen_at timestamp with time zone,
    revoked_at timestamp with time zone,
    app_version character varying(30),
    platform character varying(20)
);


--
-- Name: discord_alert_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.discord_alert_messages (
    id bigint NOT NULL,
    alert_id bigint NOT NULL,
    guild_id character varying(50) NOT NULL,
    channel_id character varying(50) NOT NULL,
    message_id character varying(50) NOT NULL,
    channel_name character varying(100) NOT NULL,
    broadcaster_user_id character varying(50) NOT NULL,
    peak_viewers integer DEFAULT 0 NOT NULL,
    total_viewer_samples integer DEFAULT 0 NOT NULL,
    total_viewers_sum bigint DEFAULT 0 NOT NULL,
    last_game character varying(200),
    stream_started_at timestamp without time zone,
    sent_at timestamp without time zone DEFAULT now() NOT NULL,
    last_updated_at timestamp without time zone,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: discord_alert_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.discord_alert_messages_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: discord_alert_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.discord_alert_messages_id_seq OWNED BY public.discord_alert_messages.id;


--
-- Name: discord_guild_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.discord_guild_configs (
    id bigint NOT NULL,
    guild_id character varying(50) NOT NULL,
    guild_name character varying(200) DEFAULT ''::character varying NOT NULL,
    guild_icon character varying(500),
    channel_name character varying(100) NOT NULL,
    twitch_user_id character varying(50) NOT NULL,
    live_alert_channel_id character varying(50),
    live_alerts_enabled boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    is_default boolean DEFAULT false NOT NULL
);


--
-- Name: discord_guild_configs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.discord_guild_configs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: discord_guild_configs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.discord_guild_configs_id_seq OWNED BY public.discord_guild_configs.id;


--
-- Name: discord_live_alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.discord_live_alerts (
    id bigint NOT NULL,
    guild_config_id bigint NOT NULL,
    guild_id character varying(50) NOT NULL,
    channel_name character varying(100) NOT NULL,
    discord_channel_id character varying(50) NOT NULL,
    discord_channel_name character varying(200) DEFAULT ''::character varying NOT NULL,
    custom_message text,
    mention_everyone boolean DEFAULT true NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    is_own_channel boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    thumbnail_mode character varying(20) DEFAULT 'live'::character varying NOT NULL,
    static_thumbnail_url text,
    embed_color character varying(10) DEFAULT '#ff0000'::character varying,
    footer_text character varying(200),
    show_button boolean DEFAULT true NOT NULL,
    show_start_time boolean DEFAULT true NOT NULL,
    send_mode character varying(20) DEFAULT 'wait'::character varying NOT NULL,
    delay_minutes integer DEFAULT 2 NOT NULL,
    update_interval_minutes integer DEFAULT 10 NOT NULL,
    on_offline_action character varying(20) DEFAULT 'summary'::character varying NOT NULL
);


--
-- Name: discord_live_alerts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.discord_live_alerts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: discord_live_alerts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.discord_live_alerts_id_seq OWNED BY public.discord_live_alerts.id;


--
-- Name: discord_welcome_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.discord_welcome_configs (
    id bigint NOT NULL,
    guild_config_id bigint NOT NULL,
    guild_id character varying(50) NOT NULL,
    welcome_enabled boolean DEFAULT false NOT NULL,
    welcome_channel_id character varying(50),
    welcome_message text DEFAULT 'Bienvenido {user} a {server}! Eres el miembro #{memberCount}'::text,
    welcome_embed_color character varying(10) DEFAULT '#22c55e'::character varying,
    welcome_image_mode character varying(20) DEFAULT 'avatar'::character varying,
    welcome_image_url text,
    welcome_show_avatar boolean DEFAULT true NOT NULL,
    welcome_auto_role_id character varying(50),
    welcome_dm_enabled boolean DEFAULT false NOT NULL,
    welcome_dm_message text,
    welcome_mention_user boolean DEFAULT true NOT NULL,
    goodbye_enabled boolean DEFAULT false NOT NULL,
    goodbye_channel_id character varying(50),
    goodbye_message text DEFAULT '{user} se fue del servidor. Eramos {memberCount}.'::text,
    goodbye_embed_color character varying(10) DEFAULT '#64748b'::character varying,
    goodbye_image_mode character varying(20) DEFAULT 'none'::character varying,
    goodbye_image_url text,
    goodbye_show_avatar boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    editor_layout text,
    welcome_generated_image text,
    goodbye_generated_image text
);


--
-- Name: discord_welcome_configs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.discord_welcome_configs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: discord_welcome_configs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.discord_welcome_configs_id_seq OWNED BY public.discord_welcome_configs.id;


--
-- Name: discount_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.discount_codes (
    id integer NOT NULL,
    code character varying(50) NOT NULL,
    discount_type character varying(10) NOT NULL,
    discount_value numeric(10,2) NOT NULL,
    applies_to character varying(20) DEFAULT 'all'::character varying NOT NULL,
    max_uses integer,
    used_count integer DEFAULT 0 NOT NULL,
    expires_at timestamp with time zone,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT discount_codes_discount_type_check CHECK (((discount_type)::text = ANY (ARRAY[('fixed'::character varying)::text, ('percent'::character varying)::text])))
);


--
-- Name: discount_codes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.discount_codes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: discount_codes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.discount_codes_id_seq OWNED BY public.discount_codes.id;


--
-- Name: email_campaigns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_campaigns (
    id bigint NOT NULL,
    template_id bigint NOT NULL,
    name character varying(200) NOT NULL,
    recipients_filter text DEFAULT ''::text NOT NULL,
    status character varying(50) DEFAULT 'draft'::character varying NOT NULL,
    total_sent integer DEFAULT 0 NOT NULL,
    total_failed integer DEFAULT 0 NOT NULL,
    sent_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: email_campaigns_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.email_campaigns_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: email_campaigns_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.email_campaigns_id_seq OWNED BY public.email_campaigns.id;


--
-- Name: email_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_logs (
    id bigint NOT NULL,
    campaign_id bigint NOT NULL,
    recipient_email character varying(255) NOT NULL,
    recipient_user_id bigint,
    status character varying(50) DEFAULT 'sent'::character varying NOT NULL,
    sent_at timestamp without time zone DEFAULT now() NOT NULL,
    resend_id character varying(100),
    error_message character varying(1000)
);


--
-- Name: email_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.email_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: email_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.email_logs_id_seq OWNED BY public.email_logs.id;


--
-- Name: email_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_templates (
    id bigint NOT NULL,
    name character varying(200) NOT NULL,
    subject character varying(500) NOT NULL,
    html_content text DEFAULT ''::text NOT NULL,
    design_json text DEFAULT ''::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: email_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.email_templates_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: email_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.email_templates_id_seq OWNED BY public.email_templates.id;


--
-- Name: event_alerts_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.event_alerts_configs (
    id integer NOT NULL,
    user_id bigint NOT NULL,
    channel_name character varying(100) DEFAULT ''::character varying NOT NULL,
    config_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: event_alerts_configs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.event_alerts_configs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: event_alerts_configs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.event_alerts_configs_id_seq OWNED BY public.event_alerts_configs.id;


--
-- Name: finance_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_settings (
    id integer DEFAULT 1 NOT NULL,
    gateway_percent numeric(6,3) DEFAULT 3.990 NOT NULL,
    gateway_fixed_pen numeric(10,2) DEFAULT 0.30 NOT NULL,
    gateway_fee_has_igv boolean DEFAULT true NOT NULL,
    igv_percent numeric(6,3) DEFAULT 18.000 NOT NULL,
    pen_per_usd numeric(10,4) DEFAULT 3.8000 NOT NULL,
    primary_currency text DEFAULT 'PEN'::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    credit_usd numeric(12,9) DEFAULT 0.000004 NOT NULL,
    target_margin_percent numeric(6,2) DEFAULT 30.00 NOT NULL,
    CONSTRAINT finance_settings_single_row CHECK ((id = 1))
);


--
-- Name: fixed_costs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fixed_costs (
    id bigint NOT NULL,
    concept text NOT NULL,
    amount numeric(12,2) NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    periodicity text DEFAULT 'monthly'::text NOT NULL,
    starts_on date DEFAULT CURRENT_DATE NOT NULL,
    ends_on date,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: fixed_costs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.fixed_costs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: fixed_costs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.fixed_costs_id_seq OWNED BY public.fixed_costs.id;


--
-- Name: follow_alert_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.follow_alert_configs (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    channel_name character varying(100) NOT NULL,
    enabled boolean DEFAULT true,
    message character varying(500) DEFAULT '¡Gracias @{username} por el follow! ❤️'::character varying,
    cooldown_minutes integer DEFAULT 60,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: follow_alert_configs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.follow_alert_configs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: follow_alert_configs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.follow_alert_configs_id_seq OWNED BY public.follow_alert_configs.id;


--
-- Name: follow_alert_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.follow_alert_history (
    id bigint NOT NULL,
    channel_name character varying(100) NOT NULL,
    follower_username character varying(100) NOT NULL,
    followed_at timestamp without time zone DEFAULT now(),
    message_sent boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    user_id bigint NOT NULL
);


--
-- Name: follow_alert_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.follow_alert_history_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: follow_alert_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.follow_alert_history_id_seq OWNED BY public.follow_alert_history.id;


--
-- Name: follower_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.follower_history (
    id bigint NOT NULL,
    broadcaster_id character varying(50) NOT NULL,
    user_id character varying(50) NOT NULL,
    action integer NOT NULL,
    action_timestamp timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: follower_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.follower_history_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: follower_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.follower_history_id_seq OWNED BY public.follower_history.id;


--
-- Name: fortnite_sprites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fortnite_sprites (
    id integer NOT NULL,
    sprite_key character varying(100) NOT NULL,
    name character varying(200) NOT NULL,
    "character" character varying(100) NOT NULL,
    theme character varying(50) NOT NULL,
    rarity character varying(50) NOT NULL,
    image_url character varying(500),
    is_unreleased boolean DEFAULT false NOT NULL,
    season character varying(50),
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    released_at timestamp without time zone
);


--
-- Name: fortnite_sprites_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.fortnite_sprites_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: fortnite_sprites_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.fortnite_sprites_id_seq OWNED BY public.fortnite_sprites.id;


--
-- Name: gacha_achievements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gacha_achievements (
    id integer NOT NULL,
    channel_name character varying(100),
    code character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    description character varying(255) DEFAULT ''::character varying NOT NULL,
    icon character varying(10) DEFAULT ''::character varying NOT NULL,
    badge_rarity character varying(20) DEFAULT 'common'::character varying NOT NULL,
    condition_type character varying(50) DEFAULT ''::character varying NOT NULL,
    condition_value integer DEFAULT 0 NOT NULL,
    condition_param character varying(50),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    user_id bigint
);


--
-- Name: gacha_achievements_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.gacha_achievements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: gacha_achievements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.gacha_achievements_id_seq OWNED BY public.gacha_achievements.id;


--
-- Name: gacha_banners; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gacha_banners (
    id integer NOT NULL,
    channel_name character varying(100) NOT NULL,
    banner_url character varying(500) NOT NULL,
    is_active boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    user_id bigint NOT NULL
);


--
-- Name: gacha_banners_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.gacha_banners_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: gacha_banners_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.gacha_banners_id_seq OWNED BY public.gacha_banners.id;


--
-- Name: gacha_command_aliases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gacha_command_aliases (
    id integer NOT NULL,
    channel_name character varying(100) NOT NULL,
    alias character varying(50) NOT NULL,
    target_command character varying(50) NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    user_id bigint NOT NULL
);


--
-- Name: gacha_command_aliases_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.gacha_command_aliases_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: gacha_command_aliases_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.gacha_command_aliases_id_seq OWNED BY public.gacha_command_aliases.id;


--
-- Name: gacha_command_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gacha_command_configs (
    id integer NOT NULL,
    channel_name character varying(100) NOT NULL,
    command character varying(50) NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    permission character varying(20) DEFAULT 'everyone'::character varying NOT NULL,
    cooldown_global integer DEFAULT 0 NOT NULL,
    cooldown_user integer DEFAULT 3 NOT NULL,
    custom_response text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    user_id bigint NOT NULL,
    CONSTRAINT chk_cmd_permission CHECK (((permission)::text = ANY ((ARRAY['everyone'::character varying, 'subscriber'::character varying, 'vip'::character varying, 'moderator'::character varying, 'broadcaster'::character varying])::text[])))
);


--
-- Name: gacha_command_configs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.gacha_command_configs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: gacha_command_configs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.gacha_command_configs_id_seq OWNED BY public.gacha_command_configs.id;


--
-- Name: gacha_integration_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gacha_integration_configs (
    id integer NOT NULL,
    channel_name character varying(100) NOT NULL,
    tips_enabled boolean DEFAULT false NOT NULL,
    pulls_per_dollar integer DEFAULT 1 NOT NULL,
    coins_enabled boolean DEFAULT false NOT NULL,
    coins_per_pull integer DEFAULT 100 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    bits_enabled boolean DEFAULT false NOT NULL,
    bits_per_pull integer DEFAULT 100 NOT NULL,
    subs_enabled boolean DEFAULT false NOT NULL,
    pulls_sub_prime integer DEFAULT 1 NOT NULL,
    pulls_sub_tier1 integer DEFAULT 2 NOT NULL,
    pulls_sub_tier2 integer DEFAULT 3 NOT NULL,
    pulls_sub_tier3 integer DEFAULT 5 NOT NULL,
    gift_subs_enabled boolean DEFAULT false NOT NULL,
    pulls_per_gift integer DEFAULT 1 NOT NULL,
    coins_daily_limit integer DEFAULT 0 NOT NULL,
    multi_pull_enabled boolean DEFAULT true NOT NULL,
    multi_pull_max integer DEFAULT 10 NOT NULL,
    multi_pull_delay integer DEFAULT 10 NOT NULL,
    user_id bigint NOT NULL,
    chat_notify_enabled boolean DEFAULT true NOT NULL,
    bonus_expire_on_stream_end boolean DEFAULT false NOT NULL
);


--
-- Name: gacha_integration_configs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.gacha_integration_configs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: gacha_integration_configs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.gacha_integration_configs_id_seq OWNED BY public.gacha_integration_configs.id;


--
-- Name: gacha_inventory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gacha_inventory (
    id integer NOT NULL,
    channel_name character varying(100) NOT NULL,
    participant_id integer NOT NULL,
    item_id integer NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    is_redeemed boolean DEFAULT false NOT NULL,
    last_won_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    user_id bigint NOT NULL
);


--
-- Name: gacha_inventory_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.gacha_inventory_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: gacha_inventory_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.gacha_inventory_id_seq OWNED BY public.gacha_inventory.id;


--
-- Name: gacha_item_restrictions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gacha_item_restrictions (
    id integer NOT NULL,
    channel_name character varying(100) NOT NULL,
    item_id integer NOT NULL,
    min_donation_required numeric(10,2) DEFAULT 0 NOT NULL,
    total_quantity integer,
    is_unique boolean DEFAULT false NOT NULL,
    cooldown_period character varying(50) DEFAULT 'none'::character varying NOT NULL,
    cooldown_value integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    allowed_pull_types character varying(20) DEFAULT 'all'::character varying NOT NULL,
    coin_min_spent integer,
    cumulative_donation_threshold numeric(18,2) DEFAULT NULL::numeric,
    cumulative_coins_threshold integer,
    cumulative_guarantee boolean DEFAULT true NOT NULL,
    cumulative_probability numeric(5,2) DEFAULT NULL::numeric,
    milestone_priority integer DEFAULT 0 NOT NULL,
    user_id bigint NOT NULL,
    CONSTRAINT chk_allowed_pull_types CHECK (((allowed_pull_types)::text = ANY ((ARRAY['all'::character varying, 'donation_only'::character varying, 'coins_only'::character varying])::text[])))
);


--
-- Name: gacha_item_restrictions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.gacha_item_restrictions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: gacha_item_restrictions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.gacha_item_restrictions_id_seq OWNED BY public.gacha_item_restrictions.id;


--
-- Name: gacha_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gacha_items (
    id integer NOT NULL,
    channel_name character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    rarity character varying(50) DEFAULT 'common'::character varying NOT NULL,
    image character varying(500),
    available boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    user_id bigint NOT NULL,
    effect_type character varying(30) DEFAULT 'none'::character varying NOT NULL,
    effect_value integer DEFAULT 0 NOT NULL,
    consumable boolean DEFAULT false NOT NULL,
    CONSTRAINT chk_gacha_item_effect_type CHECK (((effect_type)::text = ANY ((ARRAY['none'::character varying, 'roll_again'::character varying, 'extra_pulls'::character varying, 'timer_time'::character varying])::text[])))
);


--
-- Name: gacha_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.gacha_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: gacha_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.gacha_items_id_seq OWNED BY public.gacha_items.id;


--
-- Name: gacha_linked_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gacha_linked_accounts (
    id bigint NOT NULL,
    gacha_user_id integer NOT NULL,
    gacha_username character varying(100) NOT NULL,
    twitch_user_id bigint NOT NULL,
    twitch_username character varying(100) NOT NULL,
    linked_at timestamp with time zone NOT NULL,
    is_active boolean NOT NULL,
    last_used_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: gacha_linked_accounts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.gacha_linked_accounts ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.gacha_linked_accounts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: gacha_overlay_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gacha_overlay_configs (
    id integer NOT NULL,
    channel_name character varying(100) NOT NULL,
    overlay_size character varying(20) DEFAULT 'standard'::character varying NOT NULL,
    custom_width integer,
    custom_height integer,
    animation_speed integer DEFAULT 10 NOT NULL,
    enable_debug boolean DEFAULT false NOT NULL,
    enable_sounds boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    user_id bigint NOT NULL
);


--
-- Name: gacha_overlay_configs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.gacha_overlay_configs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: gacha_overlay_configs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.gacha_overlay_configs_id_seq OWNED BY public.gacha_overlay_configs.id;


--
-- Name: gacha_participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gacha_participants (
    id integer NOT NULL,
    channel_name character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    twitch_user_id character varying(50),
    donation_amount numeric(10,2) DEFAULT 0 NOT NULL,
    effective_donation numeric(10,2) DEFAULT 0 NOT NULL,
    pulls integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    coin_pulls_available integer DEFAULT 0 NOT NULL,
    coins_spent_total integer DEFAULT 0 NOT NULL,
    cumulative_donation_progress numeric(18,2) DEFAULT 0 NOT NULL,
    cumulative_coins_progress integer DEFAULT 0 NOT NULL,
    display_name character varying(100) DEFAULT NULL::character varying,
    milestone_won_items jsonb DEFAULT '[]'::jsonb NOT NULL,
    user_id bigint NOT NULL,
    bonus_pulls_available integer DEFAULT 0 NOT NULL,
    forced_item_id integer
);


--
-- Name: gacha_participants_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.gacha_participants_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: gacha_participants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.gacha_participants_id_seq OWNED BY public.gacha_participants.id;


--
-- Name: gacha_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gacha_preferences (
    id integer NOT NULL,
    channel_name character varying(100) NOT NULL,
    item_id integer NOT NULL,
    participant_id integer,
    probability_percentage numeric(5,2) DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    coin_probability_override numeric(5,2) DEFAULT NULL::numeric,
    user_id bigint NOT NULL
);


--
-- Name: gacha_preferences_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.gacha_preferences_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: gacha_preferences_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.gacha_preferences_id_seq OWNED BY public.gacha_preferences.id;


--
-- Name: gacha_pull_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gacha_pull_logs (
    id bigint NOT NULL,
    channel_name character varying(100) NOT NULL,
    participant_id integer NOT NULL,
    item_id integer,
    action character varying(50) DEFAULT 'pull'::character varying NOT NULL,
    amount numeric(10,2),
    occurred_at timestamp without time zone DEFAULT now() NOT NULL,
    pull_type character varying(10) DEFAULT 'donation'::character varying NOT NULL,
    user_id bigint NOT NULL,
    CONSTRAINT chk_pull_type CHECK (((pull_type)::text = ANY ((ARRAY['donation'::character varying, 'coins'::character varying, 'bonus'::character varying])::text[])))
);


--
-- Name: gacha_pull_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.gacha_pull_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: gacha_pull_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.gacha_pull_logs_id_seq OWNED BY public.gacha_pull_logs.id;


--
-- Name: gacha_rarity_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gacha_rarity_configs (
    id integer NOT NULL,
    channel_name character varying(100) NOT NULL,
    rarity character varying(50) NOT NULL,
    probability numeric(5,2) NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    coin_probability numeric(5,2) DEFAULT NULL::numeric,
    user_id bigint NOT NULL
);


--
-- Name: gacha_rarity_configs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.gacha_rarity_configs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: gacha_rarity_configs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.gacha_rarity_configs_id_seq OWNED BY public.gacha_rarity_configs.id;


--
-- Name: gacha_rarity_restrictions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gacha_rarity_restrictions (
    id integer NOT NULL,
    channel_name character varying(100) NOT NULL,
    item_id integer,
    participant_id integer,
    rarity character varying(50),
    pull_interval integer,
    time_interval integer,
    time_unit character varying(20),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    coin_pull_interval integer,
    coin_time_interval integer,
    coin_time_unit character varying(10) DEFAULT NULL::character varying,
    user_id bigint NOT NULL
);


--
-- Name: gacha_rarity_restrictions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.gacha_rarity_restrictions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: gacha_rarity_restrictions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.gacha_rarity_restrictions_id_seq OWNED BY public.gacha_rarity_restrictions.id;


--
-- Name: gacha_showcases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gacha_showcases (
    id integer NOT NULL,
    participant_id integer NOT NULL,
    item_id integer NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    added_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: gacha_showcases_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.gacha_showcases_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: gacha_showcases_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.gacha_showcases_id_seq OWNED BY public.gacha_showcases.id;


--
-- Name: gacha_sound_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gacha_sound_configs (
    id integer NOT NULL,
    channel_name character varying(100) NOT NULL,
    master_volume integer DEFAULT 80 NOT NULL,
    enable_sounds boolean DEFAULT false NOT NULL,
    sounds_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    user_id bigint NOT NULL
);


--
-- Name: gacha_sound_configs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.gacha_sound_configs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: gacha_sound_configs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.gacha_sound_configs_id_seq OWNED BY public.gacha_sound_configs.id;


--
-- Name: gacha_user_achievements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gacha_user_achievements (
    id integer NOT NULL,
    participant_id integer NOT NULL,
    achievement_id integer NOT NULL,
    unlocked_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: gacha_user_achievements_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.gacha_user_achievements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: gacha_user_achievements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.gacha_user_achievements_id_seq OWNED BY public.gacha_user_achievements.id;


--
-- Name: gacha_viewer_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gacha_viewer_settings (
    id integer NOT NULL,
    user_id bigint NOT NULL,
    twitch_username character varying(100) NOT NULL,
    terms_accepted boolean DEFAULT false NOT NULL,
    terms_accepted_at timestamp without time zone,
    collections_public boolean DEFAULT true NOT NULL,
    private_channels jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: gacha_viewer_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.gacha_viewer_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: gacha_viewer_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.gacha_viewer_settings_id_seq OWNED BY public.gacha_viewer_settings.id;


--
-- Name: gacha_wishlists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gacha_wishlists (
    id integer NOT NULL,
    participant_id integer NOT NULL,
    item_id integer NOT NULL,
    added_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: gacha_wishlists_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.gacha_wishlists_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: gacha_wishlists_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.gacha_wishlists_id_seq OWNED BY public.gacha_wishlists.id;


--
-- Name: game_aliases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.game_aliases (
    alias character varying(100) NOT NULL,
    game_id character varying(50) NOT NULL,
    game_name character varying(255) NOT NULL,
    alias_type character varying(20) DEFAULT 'system'::character varying NOT NULL,
    created_by_user_id bigint,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: game_cache; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.game_cache (
    game_id character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    box_art_url character varying(500),
    popularity_rank integer NOT NULL,
    usage_count integer DEFAULT 0 NOT NULL,
    last_updated timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: game_category_mappings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.game_category_mappings (
    id bigint NOT NULL,
    platform character varying(10) NOT NULL,
    category_id character varying(40) NOT NULL,
    category_name character varying(100) NOT NULL,
    game character varying(32) NOT NULL
);


--
-- Name: game_category_mappings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.game_category_mappings_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: game_category_mappings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.game_category_mappings_id_seq OWNED BY public.game_category_mappings.id;


--
-- Name: game_data_cache; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.game_data_cache (
    id bigint NOT NULL,
    provider character varying(32) NOT NULL,
    external_id character varying(120) NOT NULL,
    kind character varying(32) NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    fetched_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL
);


--
-- Name: game_data_cache_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.game_data_cache_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: game_data_cache_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.game_data_cache_id_seq OWNED BY public.game_data_cache.id;


--
-- Name: game_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.game_history (
    "Id" bigint NOT NULL,
    channel_login character varying(100) NOT NULL,
    category_name character varying(500) NOT NULL,
    changed_by character varying(100) NOT NULL,
    changed_at timestamp with time zone NOT NULL,
    user_id bigint NOT NULL
);


--
-- Name: game_history_Id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.game_history ALTER COLUMN "Id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."game_history_Id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: game_overlay_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.game_overlay_configs (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    slug character varying(40) DEFAULT 'main'::character varying NOT NULL,
    name character varying(60) DEFAULT 'Principal'::character varying NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    detection_mode character varying(16) DEFAULT 'auto'::character varying NOT NULL,
    forced_game character varying(32),
    idle_behavior character varying(16) DEFAULT 'hide'::character varying NOT NULL,
    canvas jsonb DEFAULT '{"width": 1920, "height": 1080}'::jsonb NOT NULL,
    games_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: game_overlay_configs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.game_overlay_configs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: game_overlay_configs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.game_overlay_configs_id_seq OWNED BY public.game_overlay_configs.id;


--
-- Name: game_overlay_promo_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.game_overlay_promo_settings (
    id bigint NOT NULL,
    every_seconds integer DEFAULT 180 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: game_overlay_promos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.game_overlay_promos (
    id bigint NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    weight integer DEFAULT 1 NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    title_es character varying(120) DEFAULT ''::character varying NOT NULL,
    title_en character varying(120) DEFAULT ''::character varying NOT NULL,
    line_es character varying(300) DEFAULT ''::character varying NOT NULL,
    line_en character varying(300) DEFAULT ''::character varying NOT NULL,
    image_url character varying(500),
    duration_seconds integer DEFAULT 8 NOT NULL,
    games character varying(200),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: game_overlay_promos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.game_overlay_promos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: game_overlay_promos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.game_overlay_promos_id_seq OWNED BY public.game_overlay_promos.id;


--
-- Name: game_session_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.game_session_snapshots (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    linked_account_id bigint NOT NULL,
    game character varying(32) NOT NULL,
    stream_started_at timestamp with time zone NOT NULL,
    stream_ended_at timestamp with time zone,
    start_rank jsonb,
    current_rank jsonb,
    wins integer DEFAULT 0 NOT NULL,
    losses integer DEFAULT 0 NOT NULL,
    matches_json jsonb DEFAULT '[]'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    points_history_json jsonb DEFAULT '[]'::jsonb NOT NULL
);


--
-- Name: game_session_snapshots_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.game_session_snapshots_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: game_session_snapshots_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.game_session_snapshots_id_seq OWNED BY public.game_session_snapshots.id;


--
-- Name: giveaway_blacklist; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.giveaway_blacklist (
    id integer NOT NULL,
    channel_id character varying(255) NOT NULL,
    user_id character varying(255) NOT NULL,
    username character varying(255) NOT NULL,
    reason text,
    added_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    added_by character varying(255)
);


--
-- Name: giveaway_blacklist_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.giveaway_blacklist_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: giveaway_blacklist_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.giveaway_blacklist_id_seq OWNED BY public.giveaway_blacklist.id;


--
-- Name: giveaway_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.giveaway_configs (
    id integer NOT NULL,
    channel_id character varying(255) NOT NULL,
    name character varying(255) DEFAULT 'Nuevo Giveaway'::character varying NOT NULL,
    prize_name character varying(500) NOT NULL,
    prize_description text,
    duration_type character varying(10) DEFAULT 'timed'::character varying NOT NULL,
    duration_minutes integer DEFAULT 10 NOT NULL,
    max_participants integer DEFAULT 1000 NOT NULL,
    max_participants_enabled boolean DEFAULT false NOT NULL,
    allow_multiple_entries boolean DEFAULT false NOT NULL,
    number_of_winners integer DEFAULT 1 NOT NULL,
    has_backup_winners boolean DEFAULT true NOT NULL,
    number_of_backup_winners integer DEFAULT 2 NOT NULL,
    entry_command character varying(100) DEFAULT '!join'::character varying NOT NULL,
    allow_auto_entry boolean DEFAULT false NOT NULL,
    requirements jsonb DEFAULT '{}'::jsonb NOT NULL,
    weights jsonb DEFAULT '{}'::jsonb NOT NULL,
    winner_cooldown_enabled boolean DEFAULT true NOT NULL,
    winner_cooldown_days integer DEFAULT 7 NOT NULL,
    announce_on_start boolean DEFAULT true NOT NULL,
    announce_reminders boolean DEFAULT true NOT NULL,
    reminder_interval_minutes integer DEFAULT 3 NOT NULL,
    announce_participant_count boolean DEFAULT true NOT NULL,
    start_message text,
    reminder_message text,
    winner_message text,
    no_response_message text,
    winner_response_timeout integer DEFAULT 60 NOT NULL,
    auto_reroll_on_timeout boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: giveaway_configs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.giveaway_configs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: giveaway_configs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.giveaway_configs_id_seq OWNED BY public.giveaway_configs.id;


--
-- Name: giveaway_participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.giveaway_participants (
    id integer NOT NULL,
    session_id integer NOT NULL,
    user_id character varying(255) NOT NULL,
    username character varying(255) NOT NULL,
    display_name character varying(255) NOT NULL,
    is_follower boolean DEFAULT false NOT NULL,
    is_subscriber boolean DEFAULT false NOT NULL,
    subscription_tier smallint,
    is_vip boolean DEFAULT false NOT NULL,
    is_moderator boolean DEFAULT false NOT NULL,
    account_created_at timestamp without time zone,
    followed_at timestamp without time zone,
    watch_time_minutes integer DEFAULT 0 NOT NULL,
    chat_messages_count integer DEFAULT 0 NOT NULL,
    bits_total integer DEFAULT 0 NOT NULL,
    sub_streak integer DEFAULT 0 NOT NULL,
    entered_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    entry_count integer DEFAULT 1 NOT NULL,
    calculated_weight numeric(10,4) DEFAULT 1.0 NOT NULL,
    ip_hash character varying(64)
);


--
-- Name: giveaway_participants_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.giveaway_participants_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: giveaway_participants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.giveaway_participants_id_seq OWNED BY public.giveaway_participants.id;


--
-- Name: giveaway_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.giveaway_sessions (
    id integer NOT NULL,
    channel_id character varying(255) NOT NULL,
    config_id integer,
    name character varying(255) NOT NULL,
    prize_name character varying(500) NOT NULL,
    prize_description text,
    config_snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
    status character varying(20) DEFAULT 'idle'::character varying NOT NULL,
    started_at timestamp without time zone,
    ends_at timestamp without time zone,
    ended_at timestamp without time zone,
    total_participants integer DEFAULT 0 NOT NULL,
    total_weight numeric(15,4) DEFAULT 0 NOT NULL,
    cancel_reason text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: giveaway_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.giveaway_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: giveaway_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.giveaway_sessions_id_seq OWNED BY public.giveaway_sessions.id;


--
-- Name: giveaway_winner_cooldowns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.giveaway_winner_cooldowns (
    id integer NOT NULL,
    channel_id character varying(255) NOT NULL,
    user_id character varying(255) NOT NULL,
    username character varying(255) NOT NULL,
    won_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    cooldown_until timestamp without time zone NOT NULL,
    session_id integer,
    prize_name character varying(500)
);


--
-- Name: giveaway_winner_cooldowns_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.giveaway_winner_cooldowns_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: giveaway_winner_cooldowns_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.giveaway_winner_cooldowns_id_seq OWNED BY public.giveaway_winner_cooldowns.id;


--
-- Name: giveaway_winners; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.giveaway_winners (
    id integer NOT NULL,
    session_id integer NOT NULL,
    participant_id integer NOT NULL,
    "position" integer NOT NULL,
    is_backup boolean DEFAULT false NOT NULL,
    selected_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    has_responded boolean DEFAULT false NOT NULL,
    responded_at timestamp without time zone,
    was_disqualified boolean DEFAULT false NOT NULL,
    disqualification_reason text,
    disqualified_at timestamp without time zone,
    response_message character varying(500),
    timeout_processed boolean DEFAULT false NOT NULL,
    promoted_at timestamp with time zone
);


--
-- Name: giveaway_winners_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.giveaway_winners_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: giveaway_winners_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.giveaway_winners_id_seq OWNED BY public.giveaway_winners.id;


--
-- Name: global_emote_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.global_emote_log (
    id bigint NOT NULL,
    actor character varying(100) NOT NULL,
    action character varying(30) NOT NULL,
    detail character varying(300),
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: global_emote_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.global_emote_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: global_emote_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.global_emote_log_id_seq OWNED BY public.global_emote_log.id;


--
-- Name: global_emote_managers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.global_emote_managers (
    id bigint NOT NULL,
    login character varying(100) NOT NULL,
    added_by character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: global_emote_managers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.global_emote_managers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: global_emote_managers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.global_emote_managers_id_seq OWNED BY public.global_emote_managers.id;


--
-- Name: global_emote_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.global_emote_requests (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    login character varying(100) NOT NULL,
    message character varying(300),
    status character varying(10) DEFAULT 'pending'::character varying NOT NULL,
    resolved_by character varying(100),
    resolved_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_global_emote_request_status CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying])::text[])))
);


--
-- Name: global_emote_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.global_emote_requests_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: global_emote_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.global_emote_requests_id_seq OWNED BY public.global_emote_requests.id;


--
-- Name: global_emotes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.global_emotes (
    id bigint NOT NULL,
    name character varying(25) NOT NULL,
    file_key character varying(32) NOT NULL,
    animated boolean DEFAULT false NOT NULL,
    zero_width boolean DEFAULT false NOT NULL,
    width integer NOT NULL,
    height integer NOT NULL,
    bytes integer NOT NULL,
    status character varying(10) DEFAULT 'approved'::character varying NOT NULL,
    uploaded_by bigint NOT NULL,
    uploaded_by_name character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    removed_at timestamp without time zone,
    removed_by character varying(100),
    CONSTRAINT chk_global_emote_status CHECK (((status)::text = ANY ((ARRAY['approved'::character varying, 'hidden'::character varying, 'removed'::character varying])::text[])))
);


--
-- Name: global_emotes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.global_emotes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: global_emotes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.global_emotes_id_seq OWNED BY public.global_emotes.id;


--
-- Name: invoicing_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoicing_settings (
    id integer DEFAULT 1 NOT NULL,
    company_id integer NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_by character varying(100),
    culqi_mode text DEFAULT 'live'::text NOT NULL,
    CONSTRAINT chk_invoicing_culqi_mode CHECK ((culqi_mode = ANY (ARRAY['live'::text, 'test'::text]))),
    CONSTRAINT chk_invoicing_single_row CHECK ((id = 1))
);


--
-- Name: linked_game_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.linked_game_accounts (
    id bigint NOT NULL,
    account_id bigint NOT NULL,
    game character varying(32) NOT NULL,
    provider character varying(32) NOT NULL,
    display_name character varying(100) DEFAULT ''::character varying NOT NULL,
    external_name character varying(100) NOT NULL,
    external_tag character varying(20),
    external_id character varying(120) DEFAULT ''::character varying NOT NULL,
    region character varying(10),
    verification_challenge_icon_id integer,
    verification_started_at timestamp with time zone,
    verified_at timestamp with time zone,
    manual_rank jsonb,
    manual_updated_at timestamp with time zone,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: linked_game_accounts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.linked_game_accounts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: linked_game_accounts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.linked_game_accounts_id_seq OWNED BY public.linked_game_accounts.id;


--
-- Name: live_overlay_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.live_overlay_configs (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    slug character varying(40) DEFAULT 'main'::character varying NOT NULL,
    name character varying(60) DEFAULT 'Principal'::character varying NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    canvas jsonb DEFAULT '{"width": 1920, "height": 1080}'::jsonb NOT NULL,
    config_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: live_overlay_configs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.live_overlay_configs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: live_overlay_configs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.live_overlay_configs_id_seq OWNED BY public.live_overlay_configs.id;


--
-- Name: live_translation_devices_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.live_translation_devices_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: live_translation_devices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.live_translation_devices_id_seq OWNED BY public.desktop_devices.id;


--
-- Name: live_translation_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.live_translation_sessions (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    device_id bigint,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    ended_at timestamp with time zone,
    speech_seconds double precision DEFAULT 0 NOT NULL,
    segments integer DEFAULT 0 NOT NULL,
    chars_by_language_json text DEFAULT '{}'::text NOT NULL,
    peak_listeners integer DEFAULT 0 NOT NULL,
    credits_used bigint DEFAULT 0 NOT NULL,
    end_reason character varying(30)
);


--
-- Name: live_translation_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.live_translation_sessions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: live_translation_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.live_translation_sessions_id_seq OWNED BY public.live_translation_sessions.id;


--
-- Name: live_translation_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.live_translation_settings (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    source_language character varying(10) DEFAULT 'es'::character varying NOT NULL,
    target_languages character varying(200) DEFAULT 'en'::character varying NOT NULL,
    voice_engine character varying(20) DEFAULT 'deepgram'::character varying NOT NULL,
    voices_json text DEFAULT '{}'::text NOT NULL,
    announce_in_chat boolean DEFAULT true NOT NULL,
    announce_message character varying(400),
    background_volume integer DEFAULT 15 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: live_translation_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.live_translation_settings_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: live_translation_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.live_translation_settings_id_seq OWNED BY public.live_translation_settings.id;


--
-- Name: lol_coach_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lol_coach_settings (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    coach_name character varying(40) DEFAULT 'Coach'::character varying NOT NULL,
    tone character varying(20) DEFAULT 'analyst'::character varying NOT NULL,
    comment_picks boolean DEFAULT true NOT NULL,
    post_game_summary boolean DEFAULT true NOT NULL,
    show_on_overlay boolean DEFAULT true NOT NULL,
    champ_pool character varying(400) DEFAULT ''::character varying NOT NULL,
    notes character varying(600) DEFAULT ''::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    voice_enabled boolean DEFAULT false NOT NULL,
    voice_id character varying(60) DEFAULT ''::character varying NOT NULL,
    voice_kinds character varying(60) DEFAULT 'my_turn,final,postgame'::character varying NOT NULL,
    briefing boolean DEFAULT true NOT NULL,
    tilt_check boolean DEFAULT false NOT NULL,
    lobby_comments boolean DEFAULT true NOT NULL,
    daily_goal character varying(200) DEFAULT ''::character varying NOT NULL,
    goal_set_at timestamp with time zone,
    predictions_enabled boolean DEFAULT false NOT NULL,
    prediction_start_points integer DEFAULT 1000 NOT NULL,
    prediction_close_minutes integer DEFAULT 5 NOT NULL,
    chat_kinds character varying(60) DEFAULT 'final,postgame'::character varying NOT NULL,
    voice_engine character varying(20) DEFAULT 'standard'::character varying NOT NULL,
    last_briefing_at timestamp with time zone,
    coach_memory text DEFAULT ''::text NOT NULL
);


--
-- Name: lol_coach_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lol_coach_settings_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lol_coach_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lol_coach_settings_id_seq OWNED BY public.lol_coach_settings.id;


--
-- Name: lol_prediction_bets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lol_prediction_bets (
    id bigint NOT NULL,
    prediction_id bigint NOT NULL,
    viewer character varying(100) NOT NULL,
    side character varying(5) NOT NULL,
    amount integer NOT NULL,
    payout bigint DEFAULT 0 NOT NULL,
    placed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: lol_prediction_bets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lol_prediction_bets_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lol_prediction_bets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lol_prediction_bets_id_seq OWNED BY public.lol_prediction_bets.id;


--
-- Name: lol_prediction_points; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lol_prediction_points (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    viewer character varying(100) NOT NULL,
    points bigint DEFAULT 0 NOT NULL,
    correct integer DEFAULT 0 NOT NULL,
    total integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: lol_prediction_points_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lol_prediction_points_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lol_prediction_points_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lol_prediction_points_id_seq OWNED BY public.lol_prediction_points.id;


--
-- Name: lol_predictions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lol_predictions (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    game_key character varying(120) NOT NULL,
    champion character varying(40),
    opened_at timestamp with time zone DEFAULT now() NOT NULL,
    closes_at timestamp with time zone NOT NULL,
    resolved_at timestamp with time zone,
    result character varying(10),
    pool_win bigint DEFAULT 0 NOT NULL,
    pool_loss bigint DEFAULT 0 NOT NULL
);


--
-- Name: lol_predictions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lol_predictions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lol_predictions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lol_predictions_id_seq OWNED BY public.lol_predictions.id;


--
-- Name: micro_game_commands; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.micro_game_commands (
    "Id" bigint NOT NULL,
    channel_name character varying(100) NOT NULL,
    short_command character varying(100) NOT NULL,
    category_name character varying(500) NOT NULL,
    created_by character varying(100) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    user_id bigint NOT NULL
);


--
-- Name: micro_game_commands_Id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.micro_game_commands ALTER COLUMN "Id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."micro_game_commands_Id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: moderation_command_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.moderation_command_configs (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    channel_name character varying(100) NOT NULL,
    settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: moderation_command_configs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.moderation_command_configs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: moderation_command_configs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.moderation_command_configs_id_seq OWNED BY public.moderation_command_configs.id;


--
-- Name: moderation_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.moderation_configs (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    channel_name character varying(100) NOT NULL,
    vip_immunity character varying(20) DEFAULT 'escalamiento'::character varying NOT NULL,
    sub_immunity character varying(20) DEFAULT 'escalamiento'::character varying NOT NULL,
    whitelist_users jsonb DEFAULT '[]'::jsonb NOT NULL,
    warning_message character varying(500) DEFAULT '⚠️ $(user), evita usar ese lenguaje. Strike $(strike)/5'::character varying NOT NULL,
    strike_expiration character varying(20) DEFAULT '15min'::character varying NOT NULL,
    strike1_action character varying(20) DEFAULT 'warning'::character varying NOT NULL,
    strike2_action character varying(20) DEFAULT 'timeout_1m'::character varying NOT NULL,
    strike3_action character varying(20) DEFAULT 'timeout_5m'::character varying NOT NULL,
    strike4_action character varying(20) DEFAULT 'timeout_10m'::character varying NOT NULL,
    strike5_action character varying(20) DEFAULT 'ban'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    delete_message character varying(500) DEFAULT '🗑️ $(user), mensaje borrado por lenguaje inapropiado. Strike $(strike)/5'::character varying,
    timeout_message character varying(500) DEFAULT '⏱️ $(user), timeout aplicado por lenguaje inapropiado. Strike $(strike)/5'::character varying,
    ban_message character varying(500) DEFAULT '🔨 $(user), has sido baneado por lenguaje inapropiado. Strike $(strike)/5'::character varying,
    severo_message character varying(500) DEFAULT '🔨 $(user), has sido baneado por usar: $(word)'::character varying,
    CONSTRAINT chk_strike_actions CHECK ((((strike1_action)::text = ANY (ARRAY[('warning'::character varying)::text, ('delete'::character varying)::text, ('timeout_30s'::character varying)::text, ('timeout_1m'::character varying)::text, ('timeout_5m'::character varying)::text, ('timeout_10m'::character varying)::text, ('timeout_30m'::character varying)::text, ('timeout_1h'::character varying)::text, ('ban'::character varying)::text])) AND ((strike2_action)::text = ANY (ARRAY[('warning'::character varying)::text, ('delete'::character varying)::text, ('timeout_30s'::character varying)::text, ('timeout_1m'::character varying)::text, ('timeout_5m'::character varying)::text, ('timeout_10m'::character varying)::text, ('timeout_30m'::character varying)::text, ('timeout_1h'::character varying)::text, ('ban'::character varying)::text])) AND ((strike3_action)::text = ANY (ARRAY[('warning'::character varying)::text, ('delete'::character varying)::text, ('timeout_30s'::character varying)::text, ('timeout_1m'::character varying)::text, ('timeout_5m'::character varying)::text, ('timeout_10m'::character varying)::text, ('timeout_30m'::character varying)::text, ('timeout_1h'::character varying)::text, ('ban'::character varying)::text])) AND ((strike4_action)::text = ANY (ARRAY[('warning'::character varying)::text, ('delete'::character varying)::text, ('timeout_30s'::character varying)::text, ('timeout_1m'::character varying)::text, ('timeout_5m'::character varying)::text, ('timeout_10m'::character varying)::text, ('timeout_30m'::character varying)::text, ('timeout_1h'::character varying)::text, ('ban'::character varying)::text])) AND ((strike5_action)::text = ANY (ARRAY[('warning'::character varying)::text, ('delete'::character varying)::text, ('timeout_30s'::character varying)::text, ('timeout_1m'::character varying)::text, ('timeout_5m'::character varying)::text, ('timeout_10m'::character varying)::text, ('timeout_30m'::character varying)::text, ('timeout_1h'::character varying)::text, ('ban'::character varying)::text])))),
    CONSTRAINT chk_strike_expiration CHECK (((strike_expiration)::text = ANY (ARRAY[('5min'::character varying)::text, ('10min'::character varying)::text, ('15min'::character varying)::text, ('30min'::character varying)::text, ('1hour'::character varying)::text, ('never'::character varying)::text]))),
    CONSTRAINT chk_sub_immunity CHECK (((sub_immunity)::text = ANY (ARRAY[('total'::character varying)::text, ('escalamiento'::character varying)::text]))),
    CONSTRAINT chk_vip_immunity CHECK (((vip_immunity)::text = ANY (ARRAY[('total'::character varying)::text, ('escalamiento'::character varying)::text])))
);


--
-- Name: moderation_configs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.moderation_configs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: moderation_configs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.moderation_configs_id_seq OWNED BY public.moderation_configs.id;


--
-- Name: moderation_filters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.moderation_filters (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    channel_name character varying(100) NOT NULL,
    filter_key character varying(30) NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    severity character varying(20) DEFAULT 'leve'::character varying NOT NULL,
    settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    message character varying(500),
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_moderation_filter_severity CHECK (((severity)::text = ANY ((ARRAY['leve'::character varying, 'medio'::character varying, 'severo'::character varying])::text[])))
);


--
-- Name: moderation_filters_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.moderation_filters_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: moderation_filters_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.moderation_filters_id_seq OWNED BY public.moderation_filters.id;


--
-- Name: moderation_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.moderation_logs (
    id bigint NOT NULL,
    channel_name character varying(100) NOT NULL,
    username character varying(100) NOT NULL,
    detected_word character varying(500) NOT NULL,
    severity character varying(20) NOT NULL,
    action_taken character varying(50) NOT NULL,
    strike_level integer DEFAULT 0 NOT NULL,
    full_message text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    user_id bigint NOT NULL,
    filter_key character varying(30) DEFAULT 'banned_words'::character varying NOT NULL,
    executed_by character varying(100),
    undone_at timestamp without time zone,
    undone_by character varying(100),
    target_user_id character varying(50),
    CONSTRAINT chk_log_severity CHECK (((severity)::text = ANY ((ARRAY['leve'::character varying, 'medio'::character varying, 'severo'::character varying, 'comando'::character varying])::text[])))
);


--
-- Name: moderation_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.moderation_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: moderation_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.moderation_logs_id_seq OWNED BY public.moderation_logs.id;


--
-- Name: moderation_panic; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.moderation_panic (
    channel_name character varying(100) NOT NULL,
    user_id bigint NOT NULL,
    settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    active boolean DEFAULT false NOT NULL,
    started_at timestamp without time zone,
    ends_at timestamp without time zone,
    triggered_by character varying(100),
    reason character varying(200),
    previous_chat_settings jsonb,
    shield_applied boolean DEFAULT false NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: now_playing_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.now_playing_configs (
    id integer NOT NULL,
    user_id bigint NOT NULL,
    channel_name character varying(100) NOT NULL,
    is_enabled boolean DEFAULT false NOT NULL,
    provider character varying(20) DEFAULT 'lastfm'::character varying NOT NULL,
    lastfm_username character varying(100),
    spotify_access_token text,
    spotify_refresh_token text,
    spotify_token_expires_at timestamp without time zone,
    polling_interval integer DEFAULT 5 NOT NULL,
    config_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    spotify_slot_assigned boolean DEFAULT false NOT NULL,
    spotify_slot_assigned_at timestamp with time zone,
    spotify_slot_email character varying(255),
    spotify_slot_requested boolean DEFAULT false NOT NULL,
    spotify_is_premium boolean DEFAULT false NOT NULL,
    spotify_slot_requested_at timestamp with time zone
);


--
-- Name: now_playing_configs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.now_playing_configs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: now_playing_configs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.now_playing_configs_id_seq OWNED BY public.now_playing_configs.id;


--
-- Name: oauth_access_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.oauth_access_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    token character varying(64) NOT NULL,
    application_id uuid NOT NULL,
    user_id bigint NOT NULL,
    scopes text[] DEFAULT '{}'::text[] NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    revoked boolean DEFAULT false NOT NULL,
    revoked_reason character varying(255),
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    ip_address character varying(45),
    user_agent character varying(500),
    was_pkce_used boolean DEFAULT false NOT NULL
);


--
-- Name: oauth_applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.oauth_applications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id bigint NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    client_id character varying(50) NOT NULL,
    client_secret_hash character varying(255) NOT NULL,
    redirect_uris text[] DEFAULT '{}'::text[] NOT NULL,
    scopes text[] DEFAULT '{}'::text[] NOT NULL,
    icon_url character varying(500),
    website_url character varying(500),
    is_active boolean DEFAULT true NOT NULL,
    is_verified boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone
);


--
-- Name: oauth_app_stats; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.oauth_app_stats AS
 SELECT a.id AS app_id,
    a.name AS app_name,
    a.owner_id,
    a.client_id,
    a.is_active,
    a.is_verified,
    a.created_at,
    count(DISTINCT t.user_id) AS unique_users,
    count(t.id) AS total_tokens,
    count(t.id) FILTER (WHERE ((t.revoked = false) AND (t.expires_at > now()))) AS active_tokens,
    max(t.created_at) AS last_token_at
   FROM (public.oauth_applications a
     LEFT JOIN public.oauth_access_tokens t ON ((t.application_id = a.id)))
  GROUP BY a.id, a.name, a.owner_id, a.client_id, a.is_active, a.is_verified, a.created_at;


--
-- Name: oauth_authorization_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.oauth_authorization_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(64) NOT NULL,
    application_id uuid NOT NULL,
    user_id bigint NOT NULL,
    scopes text[] DEFAULT '{}'::text[] NOT NULL,
    redirect_uri character varying(500) NOT NULL,
    code_challenge character varying(128),
    code_challenge_method character varying(10),
    state character varying(128),
    expires_at timestamp without time zone NOT NULL,
    used boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: oauth_refresh_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.oauth_refresh_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    token character varying(64) NOT NULL,
    access_token_id uuid NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    revoked boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    used_at timestamp without time zone
);


--
-- Name: pet_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pet_configs (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    config_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pet_configs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pet_configs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pet_configs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pet_configs_id_seq OWNED BY public.pet_configs.id;


--
-- Name: pet_seen_chatters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pet_seen_chatters (
    channel_user_id bigint NOT NULL,
    chatter_login character varying(100) NOT NULL,
    first_seen_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: player_card_instances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.player_card_instances (
    id bigint NOT NULL,
    card_id uuid NOT NULL,
    owner_account_id bigint NOT NULL,
    level smallint DEFAULT 0 NOT NULL,
    origin character varying(10) NOT NULL,
    catalog_value integer DEFAULT 0 NOT NULL,
    status character varying(30) DEFAULT 'active'::character varying NOT NULL,
    pending_target_level smallint,
    payment_amount_due integer,
    payment_deadline_at timestamp without time zone,
    source_pull_id bigint,
    acquired_at timestamp without time zone DEFAULT now() NOT NULL,
    destroyed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    upgrade_used boolean DEFAULT false NOT NULL,
    attempt_started_at timestamp without time zone,
    CONSTRAINT chk_pci_level CHECK (((level >= 0) AND (level <= 10))),
    CONSTRAINT chk_pci_origin CHECK (((origin)::text = ANY ((ARRAY['claimed'::character varying, 'pulled'::character varying, 'free_pack'::character varying])::text[]))),
    CONSTRAINT chk_pci_pending_level CHECK (((pending_target_level IS NULL) OR ((pending_target_level >= 0) AND (pending_target_level <= 10)))),
    CONSTRAINT chk_pci_status CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'grading_in_progress'::character varying, 'frozen_pending_payment'::character varying, 'destroyed'::character varying])::text[])))
);


--
-- Name: player_card_instances_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.player_card_instances_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: player_card_instances_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.player_card_instances_id_seq OWNED BY public.player_card_instances.id;


--
-- Name: player_pack_inventory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.player_pack_inventory (
    id bigint NOT NULL,
    owner_account_id bigint NOT NULL,
    sobre_tier_id integer NOT NULL,
    purchased_at timestamp without time zone DEFAULT now() NOT NULL,
    price_paid integer NOT NULL,
    is_free boolean DEFAULT false NOT NULL,
    CONSTRAINT chk_ppi_price CHECK ((price_paid >= 0))
);


--
-- Name: player_pack_inventory_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.player_pack_inventory_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: player_pack_inventory_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.player_pack_inventory_id_seq OWNED BY public.player_pack_inventory.id;


--
-- Name: player_pity_counter; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.player_pity_counter (
    owner_account_id bigint NOT NULL,
    cards_since_last_sr_plus integer DEFAULT 0 NOT NULL,
    last_reset_at timestamp without time zone
);


--
-- Name: public_command_overrides; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.public_command_overrides (
    id integer NOT NULL,
    user_id bigint NOT NULL,
    category character varying(20) NOT NULL,
    command_key character varying(100) NOT NULL,
    hidden boolean DEFAULT false NOT NULL,
    public_description text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: public_command_overrides_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.public_command_overrides_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: public_command_overrides_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.public_command_overrides_id_seq OWNED BY public.public_command_overrides.id;


--
-- Name: raffle_participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.raffle_participants (
    id integer NOT NULL,
    raffle_id integer NOT NULL,
    username character varying(100) NOT NULL,
    twitch_user_id bigint,
    tickets integer DEFAULT 1 NOT NULL,
    entry_method character varying(50) DEFAULT 'command'::character varying NOT NULL,
    metadata_json jsonb,
    joined_at timestamp without time zone DEFAULT now() NOT NULL,
    is_disqualified boolean DEFAULT false NOT NULL,
    disqualification_reason character varying(255),
    CONSTRAINT raffle_participants_entry_method_check CHECK (((entry_method)::text = ANY (ARRAY[('command'::character varying)::text, ('automatic'::character varying)::text, ('bits'::character varying)::text, ('subscription'::character varying)::text, ('channelpoints'::character varying)::text, ('watchtime'::character varying)::text])))
);


--
-- Name: raffle_participants_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.raffle_participants_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: raffle_participants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.raffle_participants_id_seq OWNED BY public.raffle_participants.id;


--
-- Name: raffle_winners; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.raffle_winners (
    id integer NOT NULL,
    raffle_id integer NOT NULL,
    participant_id integer NOT NULL,
    username character varying(100) NOT NULL,
    "position" integer NOT NULL,
    won_at timestamp without time zone DEFAULT now() NOT NULL,
    has_confirmed boolean DEFAULT false NOT NULL,
    confirmed_at timestamp without time zone,
    was_rerolled boolean DEFAULT false NOT NULL,
    reroll_reason character varying(255)
);


--
-- Name: raffle_winners_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.raffle_winners_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: raffle_winners_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.raffle_winners_id_seq OWNED BY public.raffle_winners.id;


--
-- Name: raffles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.raffles (
    id integer NOT NULL,
    channel_name character varying(100) NOT NULL,
    name character varying(200) NOT NULL,
    description character varying(500),
    winners_count integer DEFAULT 1 NOT NULL,
    status character varying(20) DEFAULT 'open'::character varying NOT NULL,
    config_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    closed_at timestamp without time zone,
    drawn_at timestamp without time zone,
    created_by bigint NOT NULL,
    total_participants integer DEFAULT 0 NOT NULL,
    total_tickets integer DEFAULT 0 NOT NULL,
    user_id bigint NOT NULL,
    CONSTRAINT raffles_status_check CHECK (((status)::text = ANY (ARRAY[('open'::character varying)::text, ('closed'::character varying)::text, ('completed'::character varying)::text, ('cancelled'::character varying)::text])))
);


--
-- Name: raffles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.raffles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: raffles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.raffles_id_seq OWNED BY public.raffles.id;


--
-- Name: rank_card_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rank_card_configs (
    id bigint NOT NULL,
    guild_id text NOT NULL,
    config_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    background_url text,
    template_id text DEFAULT 'default'::text,
    width integer DEFAULT 1400 NOT NULL,
    height integer DEFAULT 400 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: rank_card_configs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.rank_card_configs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rank_card_configs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.rank_card_configs_id_seq OWNED BY public.rank_card_configs.id;


--
-- Name: rank_card_level_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rank_card_level_configs (
    id bigint NOT NULL,
    guild_id text NOT NULL,
    level_min integer DEFAULT 0 NOT NULL,
    level_max integer,
    role_id bigint,
    config_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    background_url text,
    template_id text DEFAULT 'default'::text,
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: rank_card_level_configs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.rank_card_level_configs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rank_card_level_configs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.rank_card_level_configs_id_seq OWNED BY public.rank_card_level_configs.id;


--
-- Name: ruleta_command_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ruleta_command_configs (
    id integer NOT NULL,
    user_id bigint NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    command_name character varying(50) DEFAULT '!ruleta'::character varying NOT NULL,
    chance_percent integer DEFAULT 17 NOT NULL,
    min_timeout_seconds integer DEFAULT 60 NOT NULL,
    max_timeout_seconds integer DEFAULT 60 NOT NULL,
    cooldown_global integer DEFAULT 10 NOT NULL,
    cooldown_user integer DEFAULT 30 NOT NULL,
    permission character varying(20) DEFAULT 'everyone'::character varying NOT NULL,
    allow_self_target boolean DEFAULT true NOT NULL,
    allow_target_moderators boolean DEFAULT false NOT NULL,
    use_self_messages boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    hit_messages jsonb DEFAULT '["🔫💥 BANG! @{shooter} le disparó a @{target} — {seconds}s de timeout"]'::jsonb NOT NULL,
    miss_messages jsonb DEFAULT '["🔫 *click* @{shooter} apuntó a @{target}... y sobrevivió"]'::jsonb NOT NULL,
    self_hit_messages jsonb DEFAULT '["🔫💥 @{shooter} se apuntó a sí mismo... BANG! {seconds}s de timeout"]'::jsonb NOT NULL,
    self_miss_messages jsonb DEFAULT '["🔫 @{shooter} se apuntó a sí mismo... *click* sobrevivió de milagro"]'::jsonb NOT NULL,
    protected_users jsonb DEFAULT '[]'::jsonb NOT NULL,
    blocked_users jsonb DEFAULT '[]'::jsonb NOT NULL
);


--
-- Name: ruleta_command_configs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ruleta_command_configs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ruleta_command_configs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ruleta_command_configs_id_seq OWNED BY public.ruleta_command_configs.id;


--
-- Name: ruleta_mod_restores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ruleta_mod_restores (
    id integer NOT NULL,
    channel_login character varying(255) NOT NULL,
    target_username character varying(255) NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    processed boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: ruleta_mod_restores_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ruleta_mod_restores_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ruleta_mod_restores_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ruleta_mod_restores_id_seq OWNED BY public.ruleta_mod_restores.id;


--
-- Name: scripted_commands; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scripted_commands (
    "Id" bigint NOT NULL,
    user_id bigint NOT NULL,
    channel_name character varying(100) NOT NULL,
    command_name character varying(100) NOT NULL,
    script_content text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: scripted_commands_Id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.scripted_commands ALTER COLUMN "Id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."scripted_commands_Id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: shoutout_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shoutout_configs (
    id bigint NOT NULL,
    username character varying(100) NOT NULL,
    duration integer NOT NULL,
    cooldown integer NOT NULL,
    show_debug_timer boolean NOT NULL,
    shoutout_text character varying(500),
    text_lines jsonb NOT NULL,
    styles jsonb NOT NULL,
    layout jsonb NOT NULL,
    animation_type character varying(50) NOT NULL,
    animation_speed character varying(50) NOT NULL,
    text_outline_enabled boolean NOT NULL,
    text_outline_color character varying(50) NOT NULL,
    text_outline_width integer NOT NULL,
    container_border_enabled boolean NOT NULL,
    container_border_color character varying(50) NOT NULL,
    container_border_width integer NOT NULL,
    blacklist jsonb NOT NULL,
    whitelist jsonb NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    user_id bigint NOT NULL,
    settings jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: shoutout_configs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.shoutout_configs ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.shoutout_configs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: shoutout_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shoutout_history (
    id bigint NOT NULL,
    channel_name character varying(100) NOT NULL,
    target_user character varying(100) NOT NULL,
    executed_by character varying(100) NOT NULL,
    clip_url character varying(500),
    clip_id character varying(100),
    clip_local_path character varying(500),
    profile_image_url character varying(500),
    game_name character varying(200),
    executed_at timestamp with time zone NOT NULL,
    user_id bigint NOT NULL
);


--
-- Name: shoutout_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.shoutout_history ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.shoutout_history_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: song_request_bans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.song_request_bans (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    ban_type character varying(20) NOT NULL,
    value character varying(200) NOT NULL,
    label character varying(300) DEFAULT ''::character varying NOT NULL,
    created_by character varying(100),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_song_request_bans_type CHECK (((ban_type)::text = ANY ((ARRAY['track'::character varying, 'author'::character varying, 'user'::character varying])::text[])))
);


--
-- Name: song_request_bans_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.song_request_bans_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: song_request_bans_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.song_request_bans_id_seq OWNED BY public.song_request_bans.id;


--
-- Name: song_request_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.song_request_configs (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    channel_name character varying(100) NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    requests_open boolean DEFAULT true NOT NULL,
    settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    overlay_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_paused boolean DEFAULT false NOT NULL,
    player_key character varying(64),
    volume integer DEFAULT 50 NOT NULL,
    fallback_cursor integer DEFAULT 0 NOT NULL,
    active_playlist_id bigint,
    is_stopped boolean DEFAULT false NOT NULL
);


--
-- Name: song_request_configs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.song_request_configs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: song_request_configs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.song_request_configs_id_seq OWNED BY public.song_request_configs.id;


--
-- Name: song_request_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.song_request_history (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    track_id bigint NOT NULL,
    requested_platform character varying(20),
    requested_by_login character varying(100),
    requested_by_name character varying(100),
    origin_source character varying(30),
    origin_url character varying(500),
    end_reason character varying(20) DEFAULT 'finished'::character varying NOT NULL,
    is_favorite boolean DEFAULT false NOT NULL,
    played_at timestamp with time zone DEFAULT now() NOT NULL,
    requested_at timestamp with time zone
);


--
-- Name: song_request_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.song_request_history_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: song_request_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.song_request_history_id_seq OWNED BY public.song_request_history.id;


--
-- Name: song_request_listen_daily; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.song_request_listen_daily (
    playlist_id bigint NOT NULL,
    day date NOT NULL,
    listens integer DEFAULT 0 NOT NULL,
    seconds bigint DEFAULT 0 NOT NULL,
    web_requests integer DEFAULT 0 NOT NULL
);


--
-- Name: song_request_listen_tracks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.song_request_listen_tracks (
    playlist_id bigint NOT NULL,
    track_id bigint NOT NULL,
    day date NOT NULL,
    listens integer DEFAULT 0 NOT NULL
);


--
-- Name: song_request_listen_unplayable; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.song_request_listen_unplayable (
    playlist_id bigint NOT NULL,
    track_id bigint NOT NULL,
    reports integer DEFAULT 1 NOT NULL,
    first_reported timestamp with time zone DEFAULT now() NOT NULL,
    last_reported timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: song_request_listen_visitors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.song_request_listen_visitors (
    playlist_id bigint NOT NULL,
    day date NOT NULL,
    visitor_id character varying(36) NOT NULL
);


--
-- Name: song_request_pending; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.song_request_pending (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    playlist_id bigint,
    track_id bigint NOT NULL,
    requested_platform character varying(20) NOT NULL,
    requested_by_id character varying(100),
    requested_by_login character varying(100) NOT NULL,
    requested_by_name character varying(100) NOT NULL,
    reply_channel character varying(100),
    origin_source character varying(30),
    origin_url character varying(500),
    origin_title character varying(300),
    origin_artist character varying(200),
    origin_thumbnail_url character varying(500),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: song_request_pending_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.song_request_pending_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: song_request_pending_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.song_request_pending_id_seq OWNED BY public.song_request_pending.id;


--
-- Name: song_request_playlist_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.song_request_playlist_items (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    track_id bigint NOT NULL,
    "position" integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    playlist_id bigint NOT NULL,
    added_by_platform character varying(10),
    added_by_id character varying(64),
    added_by_login character varying(100),
    added_by_name character varying(100)
);


--
-- Name: song_request_playlist_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.song_request_playlist_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: song_request_playlist_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.song_request_playlist_items_id_seq OWNED BY public.song_request_playlist_items.id;


--
-- Name: song_request_playlist_votes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.song_request_playlist_votes (
    id bigint NOT NULL,
    playlist_id bigint NOT NULL,
    item_id bigint NOT NULL,
    platform character varying(20) NOT NULL,
    login character varying(100) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: song_request_playlist_votes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.song_request_playlist_votes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: song_request_playlist_votes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.song_request_playlist_votes_id_seq OWNED BY public.song_request_playlist_votes.id;


--
-- Name: song_request_playlists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.song_request_playlists (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    name character varying(60) NOT NULL,
    visibility character varying(10) DEFAULT 'private'::character varying NOT NULL,
    contribution character varying(10) DEFAULT 'owner'::character varying NOT NULL,
    is_fallback boolean DEFAULT false NOT NULL,
    shuffle boolean DEFAULT false NOT NULL,
    cursor integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    requirements jsonb DEFAULT '{}'::jsonb NOT NULL,
    voting_enabled boolean DEFAULT false NOT NULL,
    sort_by_votes boolean DEFAULT false NOT NULL,
    share_code character varying(16) NOT NULL
);


--
-- Name: song_request_playlists_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.song_request_playlists_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: song_request_playlists_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.song_request_playlists_id_seq OWNED BY public.song_request_playlists.id;


--
-- Name: song_request_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.song_request_queue (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    track_id bigint NOT NULL,
    "position" integer NOT NULL,
    status character varying(20) DEFAULT 'queued'::character varying NOT NULL,
    requested_platform character varying(20) NOT NULL,
    requested_by_id character varying(100),
    requested_by_login character varying(100) NOT NULL,
    requested_by_name character varying(100) DEFAULT ''::character varying NOT NULL,
    origin_source character varying(30),
    origin_url character varying(500),
    origin_title character varying(300),
    origin_artist character varying(200),
    origin_thumbnail_url character varying(500),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_song_request_queue_status CHECK (((status)::text = ANY ((ARRAY['queued'::character varying, 'playing'::character varying])::text[])))
);


--
-- Name: song_request_queue_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.song_request_queue_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: song_request_queue_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.song_request_queue_id_seq OWNED BY public.song_request_queue.id;


--
-- Name: song_request_tracks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.song_request_tracks (
    id bigint NOT NULL,
    source character varying(30) NOT NULL,
    source_id character varying(100) NOT NULL,
    title character varying(300) DEFAULT ''::character varying NOT NULL,
    artist character varying(200) DEFAULT ''::character varying NOT NULL,
    author_id character varying(100),
    duration_seconds integer,
    view_count bigint,
    thumbnail_url character varying(500),
    availability character varying(30),
    live_status character varying(30),
    is_embeddable boolean DEFAULT true NOT NULL,
    age_restricted boolean DEFAULT false NOT NULL,
    resolved_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: song_request_tracks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.song_request_tracks_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: song_request_tracks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.song_request_tracks_id_seq OWNED BY public.song_request_tracks.id;


--
-- Name: song_request_trusted; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.song_request_trusted (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    platform character varying(20) NOT NULL,
    login character varying(100) NOT NULL,
    display_name character varying(100) NOT NULL,
    created_by character varying(100),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: song_request_trusted_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.song_request_trusted_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: song_request_trusted_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.song_request_trusted_id_seq OWNED BY public.song_request_trusted.id;


--
-- Name: sound_alert_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sound_alert_configs (
    id bigint NOT NULL,
    username character varying(100) NOT NULL,
    global_volume integer DEFAULT 70 NOT NULL,
    global_enabled boolean DEFAULT true NOT NULL,
    duration integer DEFAULT 10 NOT NULL,
    text_lines jsonb DEFAULT '[]'::jsonb NOT NULL,
    styles jsonb DEFAULT '{}'::jsonb NOT NULL,
    layout jsonb DEFAULT '{}'::jsonb NOT NULL,
    animation_type character varying(50) DEFAULT 'fade'::character varying NOT NULL,
    animation_speed character varying(50) DEFAULT 'normal'::character varying NOT NULL,
    text_outline_enabled boolean DEFAULT false NOT NULL,
    text_outline_color character varying(50) DEFAULT '#000000'::character varying NOT NULL,
    text_outline_width integer DEFAULT 2 NOT NULL,
    cooldown_ms integer DEFAULT 500 NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    user_id bigint NOT NULL,
    CONSTRAINT sound_alert_configs_cooldown_ms_check CHECK ((cooldown_ms >= 0)),
    CONSTRAINT sound_alert_configs_duration_check CHECK (((duration >= 3) AND (duration <= 30))),
    CONSTRAINT sound_alert_configs_global_volume_check CHECK (((global_volume >= 0) AND (global_volume <= 100)))
);


--
-- Name: sound_alert_configs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sound_alert_configs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sound_alert_configs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sound_alert_configs_id_seq OWNED BY public.sound_alert_configs.id;


--
-- Name: sound_alert_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sound_alert_files (
    id bigint NOT NULL,
    username character varying(100) NOT NULL,
    reward_id character varying(100) NOT NULL,
    reward_title character varying(200) NOT NULL,
    file_type character varying(20) NOT NULL,
    file_path character varying(500) NOT NULL,
    file_name character varying(255) NOT NULL,
    file_size bigint DEFAULT 0 NOT NULL,
    duration_seconds numeric(10,2) DEFAULT 0 NOT NULL,
    volume integer,
    enabled boolean DEFAULT true NOT NULL,
    play_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    image_path character varying(500),
    image_name character varying(255),
    is_system_file boolean DEFAULT false,
    user_id bigint NOT NULL,
    show_image boolean DEFAULT true NOT NULL,
    image_url character varying(1000),
    image_source character varying(20) DEFAULT 'upload'::character varying NOT NULL,
    CONSTRAINT sound_alert_files_file_type_check CHECK (((file_type)::text = ANY ((ARRAY['sound'::character varying, 'video'::character varying, 'image'::character varying])::text[]))),
    CONSTRAINT sound_alert_files_volume_check CHECK (((volume IS NULL) OR ((volume >= 0) AND (volume <= 100))))
);


--
-- Name: sound_alert_files_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sound_alert_files_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sound_alert_files_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sound_alert_files_id_seq OWNED BY public.sound_alert_files.id;


--
-- Name: sound_alert_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sound_alert_history (
    id bigint NOT NULL,
    channel_name character varying(100) NOT NULL,
    reward_id character varying(100) NOT NULL,
    reward_title character varying(200) NOT NULL,
    file_path character varying(500),
    redeemed_by character varying(100) NOT NULL,
    redeemed_by_id character varying(100),
    redeemed_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    played_successfully boolean DEFAULT true NOT NULL,
    error_message character varying(500),
    user_id bigint NOT NULL
);


--
-- Name: sound_alert_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sound_alert_history_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sound_alert_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sound_alert_history_id_seq OWNED BY public.sound_alert_history.id;


--
-- Name: sound_alert_reward_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sound_alert_reward_files (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    reward_id character varying(100) NOT NULL,
    reward_title character varying(200) DEFAULT ''::character varying NOT NULL,
    media_file_id integer,
    system_file_path character varying(500),
    volume integer,
    enabled boolean DEFAULT true NOT NULL,
    image_path character varying(500),
    image_name character varying(255),
    show_image boolean DEFAULT true NOT NULL,
    image_url character varying(1000),
    image_source character varying(20) DEFAULT 'upload'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_sound_alert_reward_files_exactly_one_source CHECK (((((media_file_id IS NOT NULL))::integer + ((system_file_path IS NOT NULL))::integer) = 1))
);


--
-- Name: sound_alert_reward_files_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sound_alert_reward_files_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sound_alert_reward_files_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sound_alert_reward_files_id_seq OWNED BY public.sound_alert_reward_files.id;


--
-- Name: speak_chat_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.speak_chat_configs (
    id integer NOT NULL,
    user_id bigint NOT NULL,
    channel_name character varying(100) NOT NULL,
    is_enabled boolean DEFAULT false NOT NULL,
    config_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: speak_chat_configs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.speak_chat_configs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: speak_chat_configs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.speak_chat_configs_id_seq OWNED BY public.speak_chat_configs.id;


--
-- Name: speak_chat_usage_backup; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.speak_chat_usage_backup (
    id integer NOT NULL,
    user_id bigint NOT NULL,
    year integer NOT NULL,
    month integer NOT NULL,
    chars_used bigint DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: speak_chat_usage_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.speak_chat_usage_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: speak_chat_usage_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.speak_chat_usage_id_seq OWNED BY public.speak_chat_usage_backup.id;


--
-- Name: stream_chat_activities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stream_chat_activities (
    id integer NOT NULL,
    channel_id character varying(255) NOT NULL,
    user_id character varying(255) NOT NULL,
    username character varying(100) NOT NULL,
    stream_id character varying(255),
    message_count integer DEFAULT 0 NOT NULL,
    last_message_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: stream_chat_activities_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stream_chat_activities_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stream_chat_activities_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.stream_chat_activities_id_seq OWNED BY public.stream_chat_activities.id;


--
-- Name: stream_watch_times; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stream_watch_times (
    id integer NOT NULL,
    channel_id character varying(255) NOT NULL,
    user_id character varying(255) NOT NULL,
    username character varying(100) NOT NULL,
    stream_id character varying(255),
    total_minutes integer DEFAULT 0 NOT NULL,
    last_seen_at timestamp without time zone DEFAULT now() NOT NULL,
    is_active boolean DEFAULT false NOT NULL,
    session_started_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: stream_watch_times_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stream_watch_times_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stream_watch_times_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.stream_watch_times_id_seq OWNED BY public.stream_watch_times.id;


--
-- Name: supporter_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supporter_payments (
    id integer NOT NULL,
    user_id bigint,
    twitch_login character varying(100),
    amount numeric(10,2) NOT NULL,
    currency character varying(10) DEFAULT 'USD'::character varying,
    paypal_order_id character varying(255),
    tier character varying(50),
    billing_type character varying(20),
    discount_code_id integer,
    payment_type character varying(20) DEFAULT 'tier'::character varying,
    captured_at timestamp without time zone DEFAULT now() NOT NULL,
    charged_amount numeric(10,2),
    charged_currency character varying(3),
    provider character varying(20),
    customer_email character varying(255),
    customer_name character varying(200),
    customer_country character varying(2),
    customer_doc_type character varying(30),
    customer_doc_number character varying(20),
    invoice_status character varying(20),
    invoice_document_id integer,
    invoice_type character varying(20),
    invoice_series character varying(10),
    invoice_number integer,
    invoice_error text,
    invoice_attempts integer DEFAULT 0 NOT NULL,
    invoice_last_attempt_at timestamp without time zone,
    prefer_factura boolean DEFAULT false NOT NULL,
    is_test boolean DEFAULT false NOT NULL
);


--
-- Name: supporter_payments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.supporter_payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: supporter_payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.supporter_payments_id_seq OWNED BY public.supporter_payments.id;


--
-- Name: supporters_page_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supporters_page_config (
    id integer NOT NULL,
    config_json text DEFAULT '{}'::text NOT NULL,
    tiers_json text DEFAULT '[]'::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: supporters_page_config_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.supporters_page_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: supporters_page_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.supporters_page_config_id_seq OWNED BY public.supporters_page_config.id;


--
-- Name: system_admins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_admins (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    username character varying(100) NOT NULL,
    role character varying(50) DEFAULT 'admin'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: system_admins_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.system_admins_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: system_admins_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.system_admins_id_seq OWNED BY public.system_admins.id;


--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_settings (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    bot_enabled boolean DEFAULT true NOT NULL,
    commands_enabled boolean DEFAULT true NOT NULL,
    command_cooldown integer DEFAULT 5 NOT NULL,
    timers_enabled boolean DEFAULT true NOT NULL,
    timer_min_messages integer DEFAULT 5 NOT NULL,
    auto_moderation_enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    timer_global_cooldown_seconds integer DEFAULT 30 NOT NULL,
    message_count_since_last_timer integer DEFAULT 0 NOT NULL
);


--
-- Name: system_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.system_settings ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.system_settings_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: tcg_free_pack_claims; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tcg_free_pack_claims (
    owner_account_id bigint NOT NULL,
    sobre_tier_id integer NOT NULL,
    claimed_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: tier_features; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tier_features (
    id integer NOT NULL,
    tier character varying(20) NOT NULL,
    feature_key character varying(50) NOT NULL,
    feature_value character varying(255) NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tier_features_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tier_features_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tier_features_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tier_features_id_seq OWNED BY public.tier_features.id;


--
-- Name: tier_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tier_history (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    previous_tier character varying(20),
    new_tier character varying(20) NOT NULL,
    change_reason character varying(100),
    source character varying(50),
    source_reference character varying(255),
    changed_by bigint,
    changed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tier_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tier_history_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tier_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tier_history_id_seq OWNED BY public.tier_history.id;


--
-- Name: timer_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.timer_configs (
    id integer NOT NULL,
    user_id bigint NOT NULL,
    channel_name character varying(100) NOT NULL,
    default_duration integer DEFAULT 300 NOT NULL,
    auto_start boolean DEFAULT false NOT NULL,
    display_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    progressbar_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    style_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    animation_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    theme_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    events_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    commands_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    alerts_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    goal_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    advanced_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    history_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    canvas_width integer DEFAULT 1000 NOT NULL,
    canvas_height integer DEFAULT 300 NOT NULL,
    time_zone character varying(100) DEFAULT 'UTC'::character varying,
    max_chances integer DEFAULT 0 NOT NULL,
    resurrection_message text,
    game_over_message text,
    widgets_config jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: timer_configs_backup_tiers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.timer_configs_backup_tiers (
    id integer,
    channel_name character varying(100),
    events_config jsonb,
    user_id bigint NOT NULL
);


--
-- Name: timer_configs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.timer_configs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: timer_configs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.timer_configs_id_seq OWNED BY public.timer_configs.id;


--
-- Name: timer_event_cooldowns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.timer_event_cooldowns (
    id bigint NOT NULL,
    channel_name character varying(255) NOT NULL,
    event_type character varying(50) NOT NULL,
    user_id character varying(255) NOT NULL,
    user_name character varying(255),
    last_triggered_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: timer_event_cooldowns_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.timer_event_cooldowns_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: timer_event_cooldowns_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.timer_event_cooldowns_id_seq OWNED BY public.timer_event_cooldowns.id;


--
-- Name: timer_event_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.timer_event_logs (
    id integer NOT NULL,
    channel_name character varying(100) NOT NULL,
    event_type character varying(50) NOT NULL,
    username character varying(100) NOT NULL,
    user_id character varying(50),
    time_added integer NOT NULL,
    details character varying(500),
    event_data jsonb,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    timer_session_id integer
);


--
-- Name: timer_event_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.timer_event_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: timer_event_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.timer_event_logs_id_seq OWNED BY public.timer_event_logs.id;


--
-- Name: timer_happyhour; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.timer_happyhour (
    id integer NOT NULL,
    user_id bigint NOT NULL,
    name character varying(100) NOT NULL,
    description character varying(255),
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    multiplier numeric(5,2) DEFAULT 2.0 NOT NULL,
    days_of_week jsonb DEFAULT '[true, true, true, true, true, true, true]'::jsonb NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    event_types jsonb
);


--
-- Name: timer_happyhour_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.timer_happyhour_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: timer_happyhour_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.timer_happyhour_id_seq OWNED BY public.timer_happyhour.id;


--
-- Name: timer_manual_happyhour; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.timer_manual_happyhour (
    id integer NOT NULL,
    user_id bigint NOT NULL,
    channel_name character varying(100) NOT NULL,
    multiplier double precision DEFAULT 2.0 NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    event_types jsonb
);


--
-- Name: timer_manual_happyhour_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.timer_manual_happyhour_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: timer_manual_happyhour_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.timer_manual_happyhour_id_seq OWNED BY public.timer_manual_happyhour.id;


--
-- Name: timer_media_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.timer_media_files (
    id integer NOT NULL,
    channel_name character varying(100) NOT NULL,
    file_type character varying(20) NOT NULL,
    file_path character varying(500) NOT NULL,
    file_name character varying(255) NOT NULL,
    file_size bigint NOT NULL,
    duration_seconds double precision,
    uploaded_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    original_file_name character varying(255) DEFAULT ''::character varying NOT NULL,
    category character varying(100),
    thumbnail_path character varying(500),
    usage_count integer DEFAULT 0 NOT NULL,
    updated_at timestamp without time zone,
    user_id bigint NOT NULL
);


--
-- Name: timer_media_files_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.timer_media_files_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: timer_media_files_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.timer_media_files_id_seq OWNED BY public.timer_media_files.id;


--
-- Name: timer_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.timer_schedules (
    id integer NOT NULL,
    user_id bigint NOT NULL,
    name character varying(100) NOT NULL,
    reason character varying(255),
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    days_of_week jsonb DEFAULT '[true, true, true, true, true, true, true]'::jsonb NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: timer_schedules_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.timer_schedules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: timer_schedules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.timer_schedules_id_seq OWNED BY public.timer_schedules.id;


--
-- Name: timer_session_backups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.timer_session_backups (
    id integer NOT NULL,
    channel_name character varying(100) NOT NULL,
    remaining_seconds integer NOT NULL,
    total_elapsed_seconds integer NOT NULL,
    total_duration_at_snapshot integer NOT NULL,
    reason character varying(255),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    timer_session_id integer,
    user_id bigint NOT NULL
);


--
-- Name: timer_session_backups_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.timer_session_backups_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: timer_session_backups_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.timer_session_backups_id_seq OWNED BY public.timer_session_backups.id;


--
-- Name: timer_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.timer_sessions (
    id integer NOT NULL,
    channel_name character varying(100) NOT NULL,
    started_at timestamp with time zone NOT NULL,
    ended_at timestamp with time zone,
    initial_duration integer NOT NULL,
    total_added_time integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id bigint NOT NULL
);


--
-- Name: timer_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.timer_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: timer_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.timer_sessions_id_seq OWNED BY public.timer_sessions.id;


--
-- Name: timer_states; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.timer_states (
    id integer NOT NULL,
    channel_name character varying(100) NOT NULL,
    status character varying(20) DEFAULT 'stopped'::character varying NOT NULL,
    time_remaining integer DEFAULT 0 NOT NULL,
    total_time integer DEFAULT 0 NOT NULL,
    started_at timestamp with time zone,
    paused_at timestamp with time zone,
    stopped_at timestamp with time zone,
    elapsed_paused_time integer DEFAULT 0 NOT NULL,
    is_visible boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    current_session_id integer,
    used_chances integer DEFAULT 0 NOT NULL,
    user_id bigint NOT NULL
);


--
-- Name: timer_states_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.timer_states_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: timer_states_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.timer_states_id_seq OWNED BY public.timer_states.id;


--
-- Name: timer_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.timer_templates (
    id integer NOT NULL,
    user_id bigint NOT NULL,
    name character varying(100) NOT NULL,
    description character varying(255),
    icon character varying(10) DEFAULT '📋'::character varying NOT NULL,
    default_duration integer NOT NULL,
    auto_start boolean DEFAULT false NOT NULL,
    canvas_width integer DEFAULT 1000 NOT NULL,
    canvas_height integer DEFAULT 300 NOT NULL,
    display_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    progressbar_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    style_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    animation_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    theme_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    events_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    alerts_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    goal_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: timer_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.timer_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: timer_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.timer_templates_id_seq OWNED BY public.timer_templates.id;


--
-- Name: timers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.timers (
    id integer NOT NULL,
    channel_name character varying(100) NOT NULL,
    name character varying(100) NOT NULL,
    message character varying(500) NOT NULL,
    interval_minutes integer DEFAULT 0 NOT NULL,
    interval_messages integer DEFAULT 0 NOT NULL,
    stream_status character varying(20) DEFAULT 'online'::character varying NOT NULL,
    priority integer DEFAULT 1 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    created_by bigint NOT NULL,
    last_executed_at timestamp without time zone,
    execution_count integer DEFAULT 0 NOT NULL,
    messages_since_last_execution integer DEFAULT 0 NOT NULL,
    category_name character varying(255),
    user_id bigint NOT NULL,
    CONSTRAINT timers_min_interval_messages CHECK ((interval_messages >= 5)),
    CONSTRAINT timers_min_interval_minutes CHECK ((interval_minutes >= 5))
);


--
-- Name: timers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.timers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: timers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.timers_id_seq OWNED BY public.timers.id;


--
-- Name: tips_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tips_configs (
    id integer NOT NULL,
    user_id bigint NOT NULL,
    channel_name character varying(100) NOT NULL,
    is_enabled boolean DEFAULT false NOT NULL,
    paypal_email character varying(500),
    paypal_connected boolean DEFAULT false NOT NULL,
    currency character varying(10) DEFAULT 'USD'::character varying NOT NULL,
    min_amount numeric(10,2) DEFAULT 1.00 NOT NULL,
    max_amount numeric(10,2) DEFAULT 500.00 NOT NULL,
    suggested_amounts character varying(100) DEFAULT '5,10,25,50,100'::character varying NOT NULL,
    page_title character varying(200) DEFAULT 'Support My Stream!'::character varying NOT NULL,
    page_description character varying(1000),
    page_accent_color character varying(50) DEFAULT '#9146FF'::character varying NOT NULL,
    page_background_image character varying(500),
    alert_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    timer_integration_enabled boolean DEFAULT false NOT NULL,
    seconds_per_currency integer DEFAULT 60 NOT NULL,
    max_message_length integer DEFAULT 255 NOT NULL,
    cooldown_seconds integer DEFAULT 0 NOT NULL,
    bad_words_filter boolean DEFAULT true NOT NULL,
    require_message boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    alert_mode character varying(20) DEFAULT 'timer'::character varying,
    basic_alert_sound character varying(500),
    basic_alert_volume integer DEFAULT 80,
    basic_alert_duration integer DEFAULT 5000,
    basic_alert_animation character varying(20) DEFAULT 'fade'::character varying,
    basic_alert_message character varying(500) DEFAULT '¡{donorName} donó {amount}! {message}'::character varying,
    basic_alert_tts jsonb,
    basic_alert_overlay jsonb,
    tips_alert_config jsonb,
    time_unit character varying(20) DEFAULT 'seconds'::character varying NOT NULL
);


--
-- Name: tips_configs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tips_configs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tips_configs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tips_configs_id_seq OWNED BY public.tips_configs.id;


--
-- Name: tips_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tips_history (
    id integer NOT NULL,
    channel_name character varying(100) NOT NULL,
    donor_name character varying(100) NOT NULL,
    donor_email character varying(255),
    amount numeric(10,2) NOT NULL,
    currency character varying(10) DEFAULT 'USD'::character varying NOT NULL,
    message character varying(500),
    paypal_transaction_id character varying(100),
    status character varying(50) DEFAULT 'completed'::character varying NOT NULL,
    time_added integer DEFAULT 0 NOT NULL,
    alert_shown boolean DEFAULT false NOT NULL,
    donated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id bigint NOT NULL
);


--
-- Name: tips_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tips_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tips_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tips_history_id_seq OWNED BY public.tips_history.id;


--
-- Name: title_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.title_history (
    id bigint NOT NULL,
    channel_login character varying(100) NOT NULL,
    title character varying(500) NOT NULL,
    changed_by character varying(100) NOT NULL,
    changed_at timestamp with time zone NOT NULL,
    user_id bigint NOT NULL
);


--
-- Name: title_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.title_history ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.title_history_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: tournament_blue_shell_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tournament_blue_shell_rules (
    id bigint NOT NULL,
    tournament_edition_id bigint NOT NULL,
    cooldown_by_rank jsonb DEFAULT '[]'::jsonb NOT NULL,
    reverse_chance_by_rank jsonb DEFAULT '[]'::jsonb NOT NULL,
    max_inventory smallint DEFAULT 3 NOT NULL,
    throw_block_window_minutes smallint DEFAULT 15 NOT NULL,
    disable_last_n_hours smallint DEFAULT 48 NOT NULL,
    daily_drop_enabled boolean DEFAULT false NOT NULL,
    daily_drop_challenge_template character varying(500),
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: tournament_blue_shell_rules_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tournament_blue_shell_rules_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tournament_blue_shell_rules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tournament_blue_shell_rules_id_seq OWNED BY public.tournament_blue_shell_rules.id;


--
-- Name: tournament_divisions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tournament_divisions (
    id bigint NOT NULL,
    tournament_edition_id bigint NOT NULL,
    name character varying(100) DEFAULT 'General'::character varying NOT NULL,
    sort_order smallint DEFAULT 0 NOT NULL,
    min_lp_threshold integer,
    max_lp_threshold integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: tournament_divisions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tournament_divisions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tournament_divisions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tournament_divisions_id_seq OWNED BY public.tournament_divisions.id;


--
-- Name: tournament_editions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tournament_editions (
    id bigint NOT NULL,
    channel_owner_id bigint NOT NULL,
    name character varying(255) NOT NULL,
    slug character varying(100) NOT NULL,
    short_label character varying(50),
    mode character varying(30) DEFAULT 'solo_q_climb'::character varying NOT NULL,
    bracket_format character varying(30),
    status character varying(30) DEFAULT 'draft'::character varying NOT NULL,
    game character varying(30) DEFAULT 'lol'::character varying NOT NULL,
    region character varying(20) DEFAULT 'euw1'::character varying NOT NULL,
    starts_at timestamp without time zone,
    ends_at timestamp without time zone,
    check_in_opens_at timestamp without time zone,
    check_in_closes_at timestamp without time zone,
    team_size smallint,
    best_of smallint,
    logo_url character varying(500),
    primary_color character varying(20),
    secondary_color character varying(20),
    prize_pool_total numeric(12,2),
    meta_title character varying(200),
    meta_description character varying(500),
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    shell_item_name character varying(60) DEFAULT 'Ficha de Castigo'::character varying NOT NULL,
    aegis_mechanic_name character varying(60) DEFAULT 'Factor Suerte'::character varying NOT NULL,
    banner_url character varying(500),
    theme character varying(10) DEFAULT 'dark'::character varying NOT NULL
);


--
-- Name: tournament_editions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tournament_editions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tournament_editions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tournament_editions_id_seq OWNED BY public.tournament_editions.id;


--
-- Name: tournament_fortnite_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tournament_fortnite_configs (
    id bigint NOT NULL,
    tournament_edition_id bigint NOT NULL,
    placement_points jsonb DEFAULT '[]'::jsonb NOT NULL,
    points_per_elimination integer DEFAULT 1 NOT NULL,
    tiebreakers text[] DEFAULT '{wins,eliminations,avg_placement,last_game_placement}'::text[] NOT NULL,
    max_players_per_lobby smallint DEFAULT 100 NOT NULL,
    fill_solos_randomly boolean DEFAULT true NOT NULL,
    match_point_threshold integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    proof_mode character varying(20) DEFAULT 'always'::character varying NOT NULL,
    report_window_minutes integer DEFAULT 30 NOT NULL,
    missing_report_zero boolean DEFAULT true NOT NULL,
    public_screenshots boolean DEFAULT false NOT NULL,
    ai_screenshot_reading boolean DEFAULT false NOT NULL
);


--
-- Name: tournament_fortnite_configs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tournament_fortnite_configs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tournament_fortnite_configs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tournament_fortnite_configs_id_seq OWNED BY public.tournament_fortnite_configs.id;


--
-- Name: tournament_fortnite_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tournament_fortnite_files (
    id bigint NOT NULL,
    tournament_edition_id bigint NOT NULL,
    file_name character varying(80) NOT NULL,
    content_type character varying(40) NOT NULL,
    kind character varying(20) NOT NULL,
    uploaded_by_user_id bigint NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    ai_placement smallint,
    ai_eliminations smallint,
    ai_note character varying(200),
    ai_read_at timestamp without time zone
);


--
-- Name: tournament_fortnite_files_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tournament_fortnite_files_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tournament_fortnite_files_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tournament_fortnite_files_id_seq OWNED BY public.tournament_fortnite_files.id;


--
-- Name: tournament_fortnite_games; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tournament_fortnite_games (
    id bigint NOT NULL,
    session_id bigint NOT NULL,
    game_number smallint NOT NULL,
    status character varying(20) DEFAULT 'waiting'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    custom_code character varying(60),
    revealed_at timestamp without time zone,
    started_at timestamp without time zone,
    ended_at timestamp without time zone,
    shells_evaluated_at timestamp without time zone
);


--
-- Name: tournament_fortnite_games_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tournament_fortnite_games_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tournament_fortnite_games_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tournament_fortnite_games_id_seq OWNED BY public.tournament_fortnite_games.id;


--
-- Name: tournament_fortnite_group_teams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tournament_fortnite_group_teams (
    id bigint NOT NULL,
    group_id bigint NOT NULL,
    team_id bigint NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: tournament_fortnite_group_teams_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tournament_fortnite_group_teams_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tournament_fortnite_group_teams_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tournament_fortnite_group_teams_id_seq OWNED BY public.tournament_fortnite_group_teams.id;


--
-- Name: tournament_fortnite_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tournament_fortnite_groups (
    id bigint NOT NULL,
    tournament_edition_id bigint NOT NULL,
    name character varying(60) NOT NULL,
    sort_order smallint DEFAULT 0 NOT NULL,
    is_final boolean DEFAULT false NOT NULL,
    qualify_count smallint,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: tournament_fortnite_groups_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tournament_fortnite_groups_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tournament_fortnite_groups_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tournament_fortnite_groups_id_seq OWNED BY public.tournament_fortnite_groups.id;


--
-- Name: tournament_fortnite_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tournament_fortnite_reports (
    id bigint NOT NULL,
    game_id bigint NOT NULL,
    participant_id bigint NOT NULL,
    team_id bigint,
    placement smallint NOT NULL,
    eliminations smallint NOT NULL,
    screenshot_file_id bigint,
    submitted_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: tournament_fortnite_reports_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tournament_fortnite_reports_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tournament_fortnite_reports_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tournament_fortnite_reports_id_seq OWNED BY public.tournament_fortnite_reports.id;


--
-- Name: tournament_fortnite_result_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tournament_fortnite_result_audit (
    id bigint NOT NULL,
    tournament_edition_id bigint NOT NULL,
    game_id bigint NOT NULL,
    team_id bigint NOT NULL,
    action character varying(20) NOT NULL,
    actor_user_id bigint,
    actor_name character varying(100) DEFAULT ''::character varying NOT NULL,
    before_json jsonb,
    after_json jsonb,
    reason text,
    evidence_file_ids bigint[] DEFAULT '{}'::bigint[] NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: tournament_fortnite_result_audit_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tournament_fortnite_result_audit_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tournament_fortnite_result_audit_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tournament_fortnite_result_audit_id_seq OWNED BY public.tournament_fortnite_result_audit.id;


--
-- Name: tournament_fortnite_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tournament_fortnite_results (
    id bigint NOT NULL,
    game_id bigint NOT NULL,
    team_id bigint NOT NULL,
    placement smallint,
    eliminations smallint DEFAULT 0 NOT NULL,
    status character varying(20) NOT NULL,
    source character varying(20) NOT NULL,
    reviewed_by_user_id bigint,
    reviewed_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: tournament_fortnite_results_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tournament_fortnite_results_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tournament_fortnite_results_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tournament_fortnite_results_id_seq OWNED BY public.tournament_fortnite_results.id;


--
-- Name: tournament_fortnite_session_checkins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tournament_fortnite_session_checkins (
    id bigint NOT NULL,
    session_id bigint NOT NULL,
    participant_id bigint NOT NULL,
    checked_in_by character varying(10) DEFAULT 'self'::character varying NOT NULL,
    checked_in_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: tournament_fortnite_session_checkins_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tournament_fortnite_session_checkins_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tournament_fortnite_session_checkins_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tournament_fortnite_session_checkins_id_seq OWNED BY public.tournament_fortnite_session_checkins.id;


--
-- Name: tournament_fortnite_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tournament_fortnite_sessions (
    id bigint NOT NULL,
    tournament_edition_id bigint NOT NULL,
    group_id bigint,
    name character varying(80) NOT NULL,
    scheduled_at timestamp without time zone,
    status character varying(20) DEFAULT 'scheduled'::character varying NOT NULL,
    sort_order smallint DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    shells_evaluated_at timestamp without time zone
);


--
-- Name: tournament_fortnite_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tournament_fortnite_sessions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tournament_fortnite_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tournament_fortnite_sessions_id_seq OWNED BY public.tournament_fortnite_sessions.id;


--
-- Name: tournament_games; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tournament_games (
    id bigint NOT NULL,
    tournament_match_id bigint NOT NULL,
    game_number smallint NOT NULL,
    winner_team_id bigint,
    riot_match_id character varying(50),
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: tournament_games_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tournament_games_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tournament_games_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tournament_games_id_seq OWNED BY public.tournament_games.id;


--
-- Name: tournament_lp_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tournament_lp_snapshots (
    id bigint NOT NULL,
    tournament_participant_id bigint NOT NULL,
    riot_match_id character varying(50) NOT NULL,
    occurred_at timestamp without time zone NOT NULL,
    lp_before integer,
    lp_after integer,
    result character varying(10) NOT NULL,
    champion character varying(50),
    kills smallint DEFAULT 0 NOT NULL,
    deaths smallint DEFAULT 0 NOT NULL,
    assists smallint DEFAULT 0 NOT NULL,
    cs_per_min numeric(5,2),
    damage_dealt integer,
    vision_score smallint,
    duration_seconds integer DEFAULT 0 NOT NULL,
    aegis_triggered boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    blue_shell_evaluated_at timestamp without time zone,
    penta_kills smallint DEFAULT 0 NOT NULL
);


--
-- Name: tournament_lp_snapshots_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tournament_lp_snapshots_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tournament_lp_snapshots_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tournament_lp_snapshots_id_seq OWNED BY public.tournament_lp_snapshots.id;


--
-- Name: tournament_matches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tournament_matches (
    id bigint NOT NULL,
    tournament_edition_id bigint NOT NULL,
    round_number smallint NOT NULL,
    bracket_position smallint NOT NULL,
    team_a_id bigint,
    team_b_id bigint,
    winner_team_id bigint,
    status character varying(20) DEFAULT 'scheduled'::character varying NOT NULL,
    scheduled_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    bracket_side character varying(20)
);


--
-- Name: tournament_matches_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tournament_matches_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tournament_matches_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tournament_matches_id_seq OWNED BY public.tournament_matches.id;


--
-- Name: tournament_overlay_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tournament_overlay_configs (
    id bigint NOT NULL,
    tournament_participant_id bigint NOT NULL,
    token character varying(64) NOT NULL,
    enabled_widgets jsonb DEFAULT '["lp-actual", "shell-inventory", "racha"]'::jsonb NOT NULL,
    theme character varying(20) DEFAULT 'dark'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: tournament_overlay_configs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tournament_overlay_configs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tournament_overlay_configs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tournament_overlay_configs_id_seq OWNED BY public.tournament_overlay_configs.id;


--
-- Name: tournament_participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tournament_participants (
    id bigint NOT NULL,
    tournament_edition_id bigint NOT NULL,
    tournament_division_id bigint,
    account_id bigint,
    discord_user_id character varying(30),
    display_name character varying(150) NOT NULL,
    riot_id character varying(50),
    riot_tag_line character varying(10),
    riot_puuid character varying(100),
    primary_role character varying(20),
    nationality character varying(5),
    twitch_channel character varying(100),
    kick_channel character varying(100),
    twitter_handle character varying(100),
    team_id bigint,
    is_captain boolean DEFAULT false NOT NULL,
    eligibility_flags text[] DEFAULT '{}'::text[] NOT NULL,
    status character varying(30) DEFAULT 'pending_approval'::character varying NOT NULL,
    registered_via character varying(20) DEFAULT 'web'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    approved_at timestamp without time zone,
    is_substitute boolean DEFAULT false NOT NULL,
    linked_riot_account_id bigint,
    smurf_flag_note text,
    game_account_id bigint,
    game_account_name character varying(100),
    game_account_verified boolean DEFAULT false NOT NULL
);


--
-- Name: tournament_participants_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tournament_participants_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tournament_participants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tournament_participants_id_seq OWNED BY public.tournament_participants.id;


--
-- Name: tournament_prize_tiers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tournament_prize_tiers (
    id bigint NOT NULL,
    tournament_edition_id bigint NOT NULL,
    tournament_division_id bigint,
    name character varying(150) NOT NULL,
    amount numeric(12,2),
    amount_hidden boolean DEFAULT false NOT NULL,
    scope character varying(20) DEFAULT 'by_rank'::character varying NOT NULL,
    rank smallint,
    role character varying(20),
    metric_key character varying(40),
    sort_order smallint DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    description text
);


--
-- Name: tournament_prize_tiers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tournament_prize_tiers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tournament_prize_tiers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tournament_prize_tiers_id_seq OWNED BY public.tournament_prize_tiers.id;


--
-- Name: tournament_punishment_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tournament_punishment_types (
    id bigint NOT NULL,
    tournament_edition_id bigint NOT NULL,
    name character varying(150) NOT NULL,
    description character varying(500),
    allows_reverse boolean DEFAULT true NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: tournament_punishment_types_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tournament_punishment_types_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tournament_punishment_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tournament_punishment_types_id_seq OWNED BY public.tournament_punishment_types.id;


--
-- Name: tournament_riot_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tournament_riot_configs (
    id bigint NOT NULL,
    channel_owner_id bigint NOT NULL,
    api_key character varying(500) NOT NULL,
    key_type character varying(20) DEFAULT 'development'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    last_validated_at timestamp without time zone,
    last_error_at timestamp without time zone,
    last_error_message character varying(500),
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: tournament_riot_configs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tournament_riot_configs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tournament_riot_configs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tournament_riot_configs_id_seq OWNED BY public.tournament_riot_configs.id;


--
-- Name: tournament_rule_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tournament_rule_documents (
    id bigint NOT NULL,
    tournament_edition_id bigint NOT NULL,
    type character varying(20) NOT NULL,
    content_markdown text DEFAULT ''::text NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    updated_by_user_id bigint,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: tournament_rule_documents_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tournament_rule_documents_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tournament_rule_documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tournament_rule_documents_id_seq OWNED BY public.tournament_rule_documents.id;


--
-- Name: tournament_shell_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tournament_shell_events (
    id bigint NOT NULL,
    tournament_edition_id bigint NOT NULL,
    type character varying(20) NOT NULL,
    source_participant_id bigint NOT NULL,
    target_participant_id bigint,
    trigger_id bigint,
    punishment_type_id bigint,
    was_reverse boolean DEFAULT false NOT NULL,
    was_lost_full boolean DEFAULT false NOT NULL,
    fulfilled_at timestamp without time zone,
    fulfilled_by_staff_id bigint,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: tournament_shell_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tournament_shell_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tournament_shell_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tournament_shell_events_id_seq OWNED BY public.tournament_shell_events.id;


--
-- Name: tournament_shell_inventories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tournament_shell_inventories (
    id bigint NOT NULL,
    tournament_participant_id bigint NOT NULL,
    count smallint DEFAULT 0 NOT NULL,
    total_obtained integer DEFAULT 0 NOT NULL,
    total_thrown integer DEFAULT 0 NOT NULL,
    total_received integer DEFAULT 0 NOT NULL,
    total_stolen integer DEFAULT 0 NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: tournament_shell_inventories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tournament_shell_inventories_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tournament_shell_inventories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tournament_shell_inventories_id_seq OWNED BY public.tournament_shell_inventories.id;


--
-- Name: tournament_shell_triggers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tournament_shell_triggers (
    id bigint NOT NULL,
    tournament_edition_id bigint NOT NULL,
    name character varying(150) NOT NULL,
    condition_type character varying(40) NOT NULL,
    stat_field character varying(20),
    threshold_value numeric(10,2) DEFAULT 0 NOT NULL,
    shells_granted smallint DEFAULT 1 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    streak_length smallint
);


--
-- Name: tournament_shell_triggers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tournament_shell_triggers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tournament_shell_triggers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tournament_shell_triggers_id_seq OWNED BY public.tournament_shell_triggers.id;


--
-- Name: tournament_sponsors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tournament_sponsors (
    id bigint NOT NULL,
    tournament_edition_id bigint NOT NULL,
    name character varying(150) NOT NULL,
    logo_url character varying(500),
    cta_text character varying(150),
    cta_url character varying(500),
    amount_sponsored numeric(12,2),
    slots jsonb DEFAULT '[]'::jsonb NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    sort_order smallint DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: tournament_sponsors_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tournament_sponsors_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tournament_sponsors_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tournament_sponsors_id_seq OWNED BY public.tournament_sponsors.id;


--
-- Name: tournament_teams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tournament_teams (
    id bigint NOT NULL,
    tournament_edition_id bigint NOT NULL,
    name character varying(150) NOT NULL,
    logo_url character varying(500),
    seed smallint,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    join_code character varying(12),
    seed_locked boolean DEFAULT false NOT NULL
);


--
-- Name: tournament_teams_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tournament_teams_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tournament_teams_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tournament_teams_id_seq OWNED BY public.tournament_teams.id;


--
-- Name: tournament_win_conditions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tournament_win_conditions (
    id bigint NOT NULL,
    tournament_edition_id bigint NOT NULL,
    condition_type character varying(40) DEFAULT 'first_tower'::character varying NOT NULL,
    threshold_value numeric DEFAULT 1 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    name character varying(100) DEFAULT ''::character varying NOT NULL
);


--
-- Name: tournament_win_conditions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tournament_win_conditions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tournament_win_conditions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tournament_win_conditions_id_seq OWNED BY public.tournament_win_conditions.id;


--
-- Name: tts_cache_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tts_cache_entries (
    id integer NOT NULL,
    hash character varying(64) NOT NULL,
    voice_id character varying(50) NOT NULL,
    engine character varying(20) NOT NULL,
    language_code character varying(20) NOT NULL,
    text_content text NOT NULL,
    file_path character varying(500) NOT NULL,
    file_size_bytes bigint DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    last_used_at timestamp without time zone DEFAULT now() NOT NULL,
    usage_count integer DEFAULT 1 NOT NULL
);


--
-- Name: tts_cache_entries_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tts_cache_entries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tts_cache_entries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tts_cache_entries_id_seq OWNED BY public.tts_cache_entries.id;


--
-- Name: tts_credit_balances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tts_credit_balances (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    monthly_period date NOT NULL,
    monthly_granted bigint DEFAULT 0 NOT NULL,
    monthly_used bigint DEFAULT 0 NOT NULL,
    purchased_balance bigint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    standard_granted bigint DEFAULT 0 NOT NULL,
    standard_used bigint DEFAULT 0 NOT NULL
);


--
-- Name: tts_credit_balances_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tts_credit_balances_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tts_credit_balances_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tts_credit_balances_id_seq OWNED BY public.tts_credit_balances.id;


--
-- Name: tts_credit_ledger; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tts_credit_ledger (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    type character varying(20) NOT NULL,
    credits bigint NOT NULL,
    bucket character varying(20) DEFAULT 'none'::character varying NOT NULL,
    feature character varying(30),
    engine character varying(20),
    chars integer,
    voice character varying(50),
    language character varying(20),
    gateway character varying(20),
    external_id character varying(120),
    granted_by bigint,
    note text
);


--
-- Name: tts_credit_ledger_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tts_credit_ledger_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tts_credit_ledger_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tts_credit_ledger_id_seq OWNED BY public.tts_credit_ledger.id;


--
-- Name: upgrade_attempt_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.upgrade_attempt_log (
    id bigint NOT NULL,
    instance_id bigint NOT NULL,
    owner_account_id bigint NOT NULL,
    card_id uuid NOT NULL,
    from_level smallint NOT NULL,
    to_level smallint NOT NULL,
    result character varying(30) NOT NULL,
    success_probability_used numeric(5,2) NOT NULL,
    cost_charged integer,
    rolled_at timestamp without time zone DEFAULT now() NOT NULL,
    resolved_at timestamp without time zone,
    CONSTRAINT chk_ual_from_level CHECK ((from_level = 0)),
    CONSTRAINT chk_ual_result CHECK (((result)::text = ANY ((ARRAY['fail'::character varying, 'success_paid'::character varying, 'success_expired_unpaid'::character varying])::text[]))),
    CONSTRAINT chk_ual_to_level CHECK (((to_level >= 0) AND (to_level <= 10)))
);


--
-- Name: upgrade_attempt_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.upgrade_attempt_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: upgrade_attempt_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.upgrade_attempt_log_id_seq OWNED BY public.upgrade_attempt_log.id;


--
-- Name: user_access; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_access (
    "Id" bigint NOT NULL,
    user_id bigint NOT NULL,
    authorized_user_id bigint NOT NULL,
    permission_level character varying(50) NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: user_access_Id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.user_access ALTER COLUMN "Id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."user_access_Id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: user_achievements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_achievements (
    id bigint NOT NULL,
    guild_id character varying(30) NOT NULL,
    user_id character varying(30) NOT NULL,
    achievement_id bigint NOT NULL,
    unlocked_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: user_achievements_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_achievements_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_achievements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_achievements_id_seq OWNED BY public.user_achievements.id;


--
-- Name: user_channel_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_channel_permissions (
    "Id" bigint NOT NULL,
    channel_owner_id bigint NOT NULL,
    granted_user_id bigint NOT NULL,
    access_level character varying(50) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    granted_by bigint NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    is_hidden boolean DEFAULT false NOT NULL,
    alias character varying(30)
);


--
-- Name: user_channel_permissions_Id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.user_channel_permissions ALTER COLUMN "Id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."user_channel_permissions_Id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: user_coins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_coins (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    balance bigint DEFAULT 0 NOT NULL,
    total_earned bigint DEFAULT 0 NOT NULL,
    total_spent bigint DEFAULT 0 NOT NULL,
    total_transferred_in bigint DEFAULT 0 NOT NULL,
    total_transferred_out bigint DEFAULT 0 NOT NULL,
    first_purchase_at timestamp without time zone,
    economy_status text DEFAULT 'normal'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_economy_status CHECK ((economy_status = ANY (ARRAY['normal'::text, 'flagged'::text, 'banned_economy'::text])))
);


--
-- Name: user_coins_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_coins_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_coins_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_coins_id_seq OWNED BY public.user_coins.id;


--
-- Name: user_fortnite_sprites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_fortnite_sprites (
    id integer NOT NULL,
    user_id bigint NOT NULL,
    sprite_id integer NOT NULL,
    obtained_at timestamp without time zone DEFAULT now() NOT NULL,
    platform character varying(20) DEFAULT 'web'::character varying NOT NULL
);


--
-- Name: user_fortnite_sprites_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_fortnite_sprites_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_fortnite_sprites_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_fortnite_sprites_id_seq OWNED BY public.user_fortnite_sprites.id;


--
-- Name: user_riot_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_riot_accounts (
    id bigint NOT NULL,
    account_id bigint NOT NULL,
    riot_id character varying(64) NOT NULL,
    riot_tag_line character varying(16) NOT NULL,
    region character varying(8) NOT NULL,
    puuid character varying(128) NOT NULL,
    verification_challenge_icon_id integer,
    verification_started_at timestamp with time zone,
    verified_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_riot_accounts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_riot_accounts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_riot_accounts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_riot_accounts_id_seq OWNED BY public.user_riot_accounts.id;


--
-- Name: user_spirit_notification_prefs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_spirit_notification_prefs (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    notify_twitch_chat boolean DEFAULT false NOT NULL,
    notify_discord_dm boolean DEFAULT false NOT NULL,
    last_notified_twitch_at timestamp without time zone,
    last_notified_discord_at timestamp without time zone,
    last_seen_dashboard_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: user_spirit_notification_prefs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_spirit_notification_prefs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_spirit_notification_prefs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_spirit_notification_prefs_id_seq OWNED BY public.user_spirit_notification_prefs.id;


--
-- Name: user_strikes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_strikes (
    id bigint NOT NULL,
    channel_name character varying(100) NOT NULL,
    username character varying(100) NOT NULL,
    strike_level integer DEFAULT 1 NOT NULL,
    last_infraction_at timestamp without time zone DEFAULT now() NOT NULL,
    expires_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    user_id bigint NOT NULL,
    CONSTRAINT chk_strike_level CHECK (((strike_level >= 0) AND (strike_level <= 5)))
);


--
-- Name: user_strikes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_strikes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_strikes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_strikes_id_seq OWNED BY public.user_strikes.id;


--
-- Name: user_subscription_tiers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_subscription_tiers (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    tier character varying(20) DEFAULT 'free'::character varying NOT NULL,
    tier_started_at timestamp with time zone DEFAULT now() NOT NULL,
    tier_expires_at timestamp with time zone,
    source character varying(50),
    source_reference character varying(255),
    amount_paid numeric(10,2),
    currency character varying(10),
    notes text,
    granted_by bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_valid_tier CHECK (((tier)::text = ANY (ARRAY[('free'::character varying)::text, ('supporter'::character varying)::text, ('premium'::character varying)::text, ('fundador'::character varying)::text, ('admin'::character varying)::text])))
);


--
-- Name: user_subscription_tiers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_subscription_tiers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_subscription_tiers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_subscription_tiers_id_seq OWNED BY public.user_subscription_tiers.id;


--
-- Name: user_xp; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_xp (
    id bigint NOT NULL,
    guild_id character varying(30) NOT NULL,
    user_id character varying(30) NOT NULL,
    username character varying(100) DEFAULT ''::character varying NOT NULL,
    avatar_url character varying(500),
    xp bigint DEFAULT 0 NOT NULL,
    level integer DEFAULT 0 NOT NULL,
    total_messages bigint DEFAULT 0 NOT NULL,
    voice_minutes bigint DEFAULT 0 NOT NULL,
    last_xp_at timestamp without time zone,
    streak_days integer DEFAULT 0 NOT NULL,
    last_active_date date,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: user_xp_global; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_xp_global (
    id bigint NOT NULL,
    user_id character varying(30) NOT NULL,
    xp bigint DEFAULT 0 NOT NULL,
    level integer DEFAULT 0 NOT NULL,
    total_servers_active integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: user_xp_global_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_xp_global_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_xp_global_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_xp_global_id_seq OWNED BY public.user_xp_global.id;


--
-- Name: user_xp_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_xp_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_xp_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_xp_id_seq OWNED BY public.user_xp.id;


--
-- Name: username_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.username_history (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    old_login character varying(100) NOT NULL,
    new_login character varying(100) NOT NULL,
    changed_at timestamp without time zone DEFAULT now() NOT NULL,
    detected_by character varying(50) DEFAULT 'auth'::character varying NOT NULL
);


--
-- Name: username_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.username_history_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: username_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.username_history_id_seq OWNED BY public.username_history.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id bigint NOT NULL,
    twitch_id character varying(50),
    login character varying(100),
    display_name character varying(150) NOT NULL,
    email character varying(255) NOT NULL,
    profile_image_url character varying(500) NOT NULL,
    offline_image_url character varying(500) NOT NULL,
    broadcaster_type character varying(50) NOT NULL,
    view_count integer NOT NULL,
    description character varying(500) NOT NULL,
    access_token character varying(500) NOT NULL,
    refresh_token character varying(500) NOT NULL,
    token_expiration timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    is_active boolean NOT NULL,
    unique_id character varying(50) NOT NULL,
    preferred_language character varying(10) DEFAULT NULL::character varying,
    language_preference_updated_at timestamp without time zone,
    discord_id text,
    discord_username text,
    discord_avatar text,
    discord_email text,
    discord_access_token text,
    discord_refresh_token text,
    discord_token_expiration timestamp without time zone,
    auth_provider text DEFAULT 'twitch'::text NOT NULL,
    referral_code text,
    kick_id character varying(50),
    kick_username character varying(150),
    kick_profile_pic character varying(500),
    kick_access_token text,
    kick_refresh_token text,
    kick_token_expiration timestamp with time zone,
    account_id bigint,
    is_hidden_from_carousel boolean DEFAULT false NOT NULL
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.users ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: watchtime_command_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.watchtime_command_configs (
    id integer NOT NULL,
    user_id bigint NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    command_name character varying(50) DEFAULT '!watchtime'::character varying NOT NULL,
    cooldown_global integer DEFAULT 5 NOT NULL,
    cooldown_user integer DEFAULT 30 NOT NULL,
    permission character varying(20) DEFAULT 'everyone'::character varying NOT NULL,
    track_lurkers boolean DEFAULT true NOT NULL,
    min_minutes_to_respond integer DEFAULT 0 NOT NULL,
    time_format character varying(20) DEFAULT 'full'::character varying NOT NULL,
    show_position boolean DEFAULT true NOT NULL,
    only_when_live boolean DEFAULT false NOT NULL,
    custom_message text DEFAULT '@{user} llevas {hours} hora(s) {minutes} minuto(s) viendo el stream'::text NOT NULL,
    use_first_time_message boolean DEFAULT true NOT NULL,
    first_time_message text DEFAULT '@{user} ¡es tu primera vez en el stream! Ya llevas {hours} hora(s) {minutes} minuto(s) — ¡bienvenido/a!'::text NOT NULL,
    use_not_enough_time_message boolean DEFAULT true NOT NULL,
    not_enough_time_message text DEFAULT '@{user} aún llevas muy poco tiempo, ¡sigue viendo el stream!'::text NOT NULL,
    use_offline_message boolean DEFAULT false NOT NULL,
    offline_message text DEFAULT '@{user} el stream no está en vivo ahora mismo'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: watchtime_command_configs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.watchtime_command_configs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: watchtime_command_configs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.watchtime_command_configs_id_seq OWNED BY public.watchtime_command_configs.id;


--
-- Name: wheel_pending_deliveries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wheel_pending_deliveries (
    id integer NOT NULL,
    wheel_id integer NOT NULL,
    spin_id bigint NOT NULL,
    viewer_user_id bigint,
    viewer_login character varying(100) NOT NULL,
    prize jsonb NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    resolved_by bigint,
    resolved_at timestamp without time zone,
    notes character varying(500),
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    reason character varying(200),
    CONSTRAINT chk_wheel_deliveries_resolved CHECK ((((status)::text = 'pending'::text) OR (resolved_at IS NOT NULL))),
    CONSTRAINT chk_wheel_deliveries_status CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'done'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- Name: wheel_pending_deliveries_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.wheel_pending_deliveries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: wheel_pending_deliveries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.wheel_pending_deliveries_id_seq OWNED BY public.wheel_pending_deliveries.id;


--
-- Name: wheel_raffle_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wheel_raffle_configs (
    id integer NOT NULL,
    wheel_id integer NOT NULL,
    entry_command character varying(30) DEFAULT '!djoin'::character varying NOT NULL,
    entry_methods jsonb DEFAULT '["command"]'::jsonb NOT NULL,
    window_mode character varying(20) DEFAULT 'manual'::character varying NOT NULL,
    window_seconds integer,
    entry_cost_credits integer DEFAULT 0 NOT NULL,
    max_entries_per_viewer integer DEFAULT 1 NOT NULL,
    weight_sources jsonb DEFAULT '{}'::jsonb NOT NULL,
    requirements jsonb DEFAULT '{}'::jsonb NOT NULL,
    winners_count integer DEFAULT 1 NOT NULL,
    draw_mode character varying(20) DEFAULT 'single'::character varying NOT NULL,
    remove_winner_from_pool boolean DEFAULT true NOT NULL,
    clear_on_stream_end boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    is_open boolean DEFAULT false NOT NULL,
    window_opened_at timestamp without time zone,
    window_closes_at timestamp without time zone,
    CONSTRAINT chk_wheel_raffle_command CHECK (((entry_command)::text ~ '^![a-zA-Z0-9_-]+$'::text)),
    CONSTRAINT chk_wheel_raffle_cost CHECK ((entry_cost_credits >= 0)),
    CONSTRAINT chk_wheel_raffle_draw CHECK (((draw_mode)::text = ANY ((ARRAY['single'::character varying, 'multi'::character varying, 'remove_and_continue'::character varying])::text[]))),
    CONSTRAINT chk_wheel_raffle_max CHECK ((max_entries_per_viewer > 0)),
    CONSTRAINT chk_wheel_raffle_secs CHECK ((((window_mode)::text <> 'timed'::text) OR ((window_seconds IS NOT NULL) AND (window_seconds > 0)))),
    CONSTRAINT chk_wheel_raffle_window CHECK (((window_mode)::text = ANY ((ARRAY['manual'::character varying, 'timed'::character varying, 'always_open'::character varying])::text[]))),
    CONSTRAINT chk_wheel_raffle_winners CHECK ((winners_count > 0))
);


--
-- Name: wheel_raffle_configs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.wheel_raffle_configs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: wheel_raffle_configs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.wheel_raffle_configs_id_seq OWNED BY public.wheel_raffle_configs.id;


--
-- Name: wheel_raffle_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wheel_raffle_entries (
    id integer NOT NULL,
    wheel_id integer NOT NULL,
    viewer_user_id bigint,
    viewer_login character varying(100) NOT NULL,
    entries integer DEFAULT 1 NOT NULL,
    weight numeric(7,3) DEFAULT 1 NOT NULL,
    weight_breakdown jsonb DEFAULT '{}'::jsonb NOT NULL,
    joined_at timestamp without time zone DEFAULT now() NOT NULL,
    has_won boolean DEFAULT false NOT NULL,
    won_at timestamp without time zone,
    CONSTRAINT chk_wheel_raffle_entries CHECK ((entries > 0)),
    CONSTRAINT chk_wheel_raffle_weight CHECK ((weight >= (0)::numeric))
);


--
-- Name: wheel_raffle_entries_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.wheel_raffle_entries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: wheel_raffle_entries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.wheel_raffle_entries_id_seq OWNED BY public.wheel_raffle_entries.id;


--
-- Name: wheel_segments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wheel_segments (
    id integer NOT NULL,
    wheel_id integer NOT NULL,
    label character varying(60) NOT NULL,
    weight numeric(7,3) DEFAULT 1 NOT NULL,
    color character varying(9),
    icon character varying(100),
    display_order integer DEFAULT 0 NOT NULL,
    prize jsonb DEFAULT '{"type": "nothing", "params": {}}'::jsonb NOT NULL,
    stock_total integer,
    stock_per_viewer integer,
    stock_window character varying(20) DEFAULT 'ever'::character varying NOT NULL,
    stock_remaining integer,
    is_enabled boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    stock_reset_at timestamp without time zone,
    CONSTRAINT chk_wheel_segments_color CHECK (((color IS NULL) OR ((color)::text ~ '^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$'::text))),
    CONSTRAINT chk_wheel_segments_label CHECK ((length(TRIM(BOTH FROM label)) > 0)),
    CONSTRAINT chk_wheel_segments_stock CHECK (((stock_total IS NULL) OR (stock_total >= 0))),
    CONSTRAINT chk_wheel_segments_weight CHECK ((weight >= (0)::numeric)),
    CONSTRAINT chk_wheel_segments_window CHECK (((stock_window)::text = ANY ((ARRAY['stream'::character varying, 'day'::character varying, 'ever'::character varying])::text[])))
);


--
-- Name: wheel_segments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.wheel_segments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: wheel_segments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.wheel_segments_id_seq OWNED BY public.wheel_segments.id;


--
-- Name: wheel_spins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wheel_spins (
    id bigint NOT NULL,
    wheel_id integer NOT NULL,
    mode character varying(10) NOT NULL,
    spinner_user_id bigint,
    spinner_login character varying(100),
    trigger_source character varying(20) NOT NULL,
    credits_spent integer DEFAULT 0 NOT NULL,
    result_segment_id integer,
    result_prize jsonb,
    delivery_status character varying(20) DEFAULT 'delivered'::character varying NOT NULL,
    raffle_winner jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_wheel_spins_credits CHECK ((credits_spent >= 0)),
    CONSTRAINT chk_wheel_spins_mode CHECK (((mode)::text = ANY ((ARRAY['prizes'::character varying, 'raffle'::character varying])::text[]))),
    CONSTRAINT chk_wheel_spins_status CHECK (((delivery_status)::text = ANY ((ARRAY['delivered'::character varying, 'pending'::character varying, 'failed'::character varying])::text[]))),
    CONSTRAINT chk_wheel_spins_trigger CHECK (((trigger_source)::text = ANY ((ARRAY['command'::character varying, 'panel'::character varying, 'auto'::character varying, 'raffle_draw'::character varying])::text[])))
);


--
-- Name: wheel_spins_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.wheel_spins_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: wheel_spins_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.wheel_spins_id_seq OWNED BY public.wheel_spins.id;


--
-- Name: wheel_wallet_sources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wheel_wallet_sources (
    id integer NOT NULL,
    wheel_id integer NOT NULL,
    source character varying(20) NOT NULL,
    is_enabled boolean DEFAULT false NOT NULL,
    rate_numerator integer DEFAULT 1 NOT NULL,
    rate_denominator integer DEFAULT 1 NOT NULL,
    cap_per_event integer,
    channel_points_reward_id character varying(100),
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    channel_points_reward_title character varying(150),
    tier2_multiplier numeric(5,2) DEFAULT 1 NOT NULL,
    tier3_multiplier numeric(5,2) DEFAULT 1 NOT NULL,
    CONSTRAINT chk_wheel_sources_cap CHECK (((cap_per_event IS NULL) OR (cap_per_event > 0))),
    CONSTRAINT chk_wheel_sources_den CHECK ((rate_denominator > 0)),
    CONSTRAINT chk_wheel_sources_name CHECK (((source)::text = ANY ((ARRAY['bits'::character varying, 'gift_sub'::character varying, 'donation'::character varying, 'channel_points'::character varying, 'deca_coins'::character varying])::text[]))),
    CONSTRAINT chk_wheel_sources_num CHECK ((rate_numerator > 0)),
    CONSTRAINT chk_wheel_sources_reward CHECK ((((source)::text <> 'channel_points'::text) OR (NOT is_enabled) OR (channel_points_reward_id IS NOT NULL)))
);


--
-- Name: wheel_wallet_sources_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.wheel_wallet_sources_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: wheel_wallet_sources_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.wheel_wallet_sources_id_seq OWNED BY public.wheel_wallet_sources.id;


--
-- Name: wheel_wallets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wheel_wallets (
    id integer NOT NULL,
    channel_id bigint NOT NULL,
    viewer_user_id bigint,
    viewer_login character varying(100) NOT NULL,
    credits integer DEFAULT 0 NOT NULL,
    lifetime_credits integer DEFAULT 0 NOT NULL,
    last_activity_at timestamp without time zone DEFAULT now() NOT NULL,
    pity_counter integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    spins_this_stream integer DEFAULT 0 NOT NULL,
    last_spin_at timestamp without time zone,
    CONSTRAINT chk_wheel_wallets_credits CHECK ((credits >= 0)),
    CONSTRAINT chk_wheel_wallets_lifetime CHECK ((lifetime_credits >= 0)),
    CONSTRAINT chk_wheel_wallets_pity CHECK ((pity_counter >= 0)),
    CONSTRAINT chk_wheel_wallets_spins_stream CHECK ((spins_this_stream >= 0))
);


--
-- Name: wheel_wallets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.wheel_wallets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: wheel_wallets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.wheel_wallets_id_seq OWNED BY public.wheel_wallets.id;


--
-- Name: wheels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wheels (
    id integer NOT NULL,
    channel_id bigint NOT NULL,
    name character varying(80) NOT NULL,
    mode character varying(10) NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    is_active boolean DEFAULT false NOT NULL,
    credit_label character varying(30) DEFAULT 'creditos'::character varying NOT NULL,
    spin_price integer DEFAULT 100 NOT NULL,
    is_accumulable boolean DEFAULT true NOT NULL,
    overflow_policy character varying(20) DEFAULT 'discard'::character varying NOT NULL,
    multi_fit_policy character varying(20) DEFAULT 'most_spins'::character varying NOT NULL,
    credit_expiry character varying(20) DEFAULT 'never'::character varying NOT NULL,
    credit_expiry_days integer,
    no_repeat_scope character varying(20) DEFAULT 'off'::character varying NOT NULL,
    pity_enabled boolean DEFAULT false NOT NULL,
    pity_threshold integer,
    allow_multi_spin boolean DEFAULT false NOT NULL,
    max_multi_spin integer DEFAULT 10 NOT NULL,
    slug character varying(40) NOT NULL,
    credits_public boolean DEFAULT false NOT NULL,
    visual_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    announce_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    spin_command character varying(30) DEFAULT '!dgirar'::character varying NOT NULL,
    balance_command character varying(30) DEFAULT '!dcreditos'::character varying NOT NULL,
    command_enabled boolean DEFAULT true NOT NULL,
    auto_spin boolean DEFAULT false NOT NULL,
    spin_cooldown_seconds integer DEFAULT 0 NOT NULL,
    max_spins_per_stream integer,
    max_coins_per_hour integer,
    buy_command character varying(50) DEFAULT '!dcomprar'::character varying NOT NULL,
    CONSTRAINT chk_wheels_balance_command CHECK (((balance_command)::text ~ '^![a-zA-Z0-9_-]+$'::text)),
    CONSTRAINT chk_wheels_buy_command CHECK (((buy_command)::text ~ '^![a-zA-Z0-9_-]+$'::text)),
    CONSTRAINT chk_wheels_commands_differ CHECK (((spin_command)::text <> (balance_command)::text)),
    CONSTRAINT chk_wheels_cooldown CHECK ((spin_cooldown_seconds >= 0)),
    CONSTRAINT chk_wheels_expiry CHECK (((credit_expiry)::text = ANY ((ARRAY['never'::character varying, 'stream_end'::character varying, 'days'::character varying])::text[]))),
    CONSTRAINT chk_wheels_expiry_days CHECK ((((credit_expiry)::text <> 'days'::text) OR ((credit_expiry_days IS NOT NULL) AND (credit_expiry_days > 0)))),
    CONSTRAINT chk_wheels_max_coins CHECK (((max_coins_per_hour IS NULL) OR (max_coins_per_hour > 0))),
    CONSTRAINT chk_wheels_max_spins CHECK (((max_spins_per_stream IS NULL) OR (max_spins_per_stream > 0))),
    CONSTRAINT chk_wheels_mode CHECK (((mode)::text = ANY ((ARRAY['prizes'::character varying, 'raffle'::character varying])::text[]))),
    CONSTRAINT chk_wheels_multifit CHECK (((multi_fit_policy)::text = ANY ((ARRAY['most_expensive'::character varying, 'most_spins'::character varying, 'viewer_choice'::character varying])::text[]))),
    CONSTRAINT chk_wheels_multispin CHECK (((max_multi_spin >= 1) AND (max_multi_spin <= 100))),
    CONSTRAINT chk_wheels_name CHECK ((length(TRIM(BOTH FROM name)) > 0)),
    CONSTRAINT chk_wheels_norepeat CHECK (((no_repeat_scope)::text = ANY ((ARRAY['off'::character varying, 'per_viewer'::character varying, 'global'::character varying])::text[]))),
    CONSTRAINT chk_wheels_overflow CHECK (((overflow_policy)::text = ANY ((ARRAY['discard'::character varying, 'cheapest_spins'::character varying])::text[]))),
    CONSTRAINT chk_wheels_pity CHECK (((NOT pity_enabled) OR ((pity_threshold IS NOT NULL) AND (pity_threshold > 0)))),
    CONSTRAINT chk_wheels_price CHECK ((spin_price > 0)),
    CONSTRAINT chk_wheels_slug CHECK (((slug)::text ~ '^[a-z0-9][a-z0-9-]*$'::text)),
    CONSTRAINT chk_wheels_spin_command CHECK (((spin_command)::text ~ '^![a-zA-Z0-9_-]+$'::text))
);


--
-- Name: wheels_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.wheels_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: wheels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.wheels_id_seq OWNED BY public.wheels.id;


--
-- Name: xp_achievements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.xp_achievements (
    id bigint NOT NULL,
    guild_id character varying(30),
    achievement_key character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    description character varying(300) DEFAULT ''::character varying NOT NULL,
    icon character varying(10) DEFAULT '🏆'::character varying NOT NULL,
    condition_type character varying(30) DEFAULT 'messages'::character varying NOT NULL,
    condition_value integer DEFAULT 1 NOT NULL,
    is_system boolean DEFAULT false NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: xp_achievements_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.xp_achievements_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: xp_achievements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.xp_achievements_id_seq OWNED BY public.xp_achievements.id;


--
-- Name: xp_boosts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.xp_boosts (
    id bigint NOT NULL,
    guild_id character varying(30) NOT NULL,
    multiplier double precision DEFAULT 2.0 NOT NULL,
    activated_by_user_id character varying(30) NOT NULL,
    activated_by_username character varying(100) DEFAULT ''::character varying NOT NULL,
    starts_at timestamp without time zone DEFAULT now() NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: xp_boosts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.xp_boosts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: xp_boosts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.xp_boosts_id_seq OWNED BY public.xp_boosts.id;


--
-- Name: xp_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.xp_configs (
    id bigint NOT NULL,
    guild_id character varying(30) NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    difficulty_preset character varying(20) DEFAULT 'normal'::character varying NOT NULL,
    custom_multiplier double precision DEFAULT 1.0 NOT NULL,
    xp_min integer DEFAULT 15 NOT NULL,
    xp_max integer DEFAULT 25 NOT NULL,
    cooldown_seconds integer DEFAULT 60 NOT NULL,
    max_xp_per_hour integer DEFAULT 500 NOT NULL,
    min_message_length integer DEFAULT 5 NOT NULL,
    excluded_channels jsonb DEFAULT '[]'::jsonb NOT NULL,
    night_mode_enabled boolean DEFAULT false NOT NULL,
    night_mode_multiplier double precision DEFAULT 1.5 NOT NULL,
    levelup_channel_id character varying(30),
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    achievement_channel_id character varying(30)
);


--
-- Name: xp_configs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.xp_configs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: xp_configs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.xp_configs_id_seq OWNED BY public.xp_configs.id;


--
-- Name: xp_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.xp_roles (
    id bigint NOT NULL,
    guild_id character varying(30) NOT NULL,
    level_required integer DEFAULT 1 NOT NULL,
    role_name character varying(100) NOT NULL,
    role_color character varying(10) DEFAULT '#95a5a6'::character varying NOT NULL,
    discord_role_id character varying(30),
    "position" integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: xp_roles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.xp_roles_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: xp_roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.xp_roles_id_seq OWNED BY public.xp_roles.id;


--
-- Name: xp_seasonal; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.xp_seasonal (
    id bigint NOT NULL,
    guild_id character varying(30) NOT NULL,
    user_id character varying(30) NOT NULL,
    username character varying(100) DEFAULT ''::character varying NOT NULL,
    year_month character varying(7) NOT NULL,
    xp_gained integer DEFAULT 0 NOT NULL,
    messages_count integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: xp_seasonal_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.xp_seasonal_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: xp_seasonal_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.xp_seasonal_id_seq OWNED BY public.xp_seasonal.id;


--
-- Name: xp_store_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.xp_store_items (
    id bigint NOT NULL,
    guild_id character varying(30) NOT NULL,
    name character varying(100) NOT NULL,
    description character varying(300) DEFAULT ''::character varying NOT NULL,
    icon character varying(10) DEFAULT '🎁'::character varying NOT NULL,
    cost integer DEFAULT 100 NOT NULL,
    item_type character varying(30) DEFAULT 'custom'::character varying NOT NULL,
    duration_hours double precision,
    max_stock integer DEFAULT 0 NOT NULL,
    current_stock integer DEFAULT 0 NOT NULL,
    role_id character varying(30),
    channel_id character varying(30),
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    announcement_channel_id character varying(30),
    custom_message character varying(500)
);


--
-- Name: xp_store_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.xp_store_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: xp_store_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.xp_store_items_id_seq OWNED BY public.xp_store_items.id;


--
-- Name: xp_store_purchases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.xp_store_purchases (
    id bigint NOT NULL,
    guild_id character varying(30) NOT NULL,
    user_id character varying(30) NOT NULL,
    username character varying(100) DEFAULT ''::character varying NOT NULL,
    item_id bigint NOT NULL,
    cost_paid integer NOT NULL,
    purchased_at timestamp without time zone DEFAULT now() NOT NULL,
    expires_at timestamp without time zone,
    is_active boolean DEFAULT true NOT NULL,
    status character varying(20) DEFAULT 'completed'::character varying NOT NULL
);


--
-- Name: xp_store_purchases_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.xp_store_purchases_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: xp_store_purchases_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.xp_store_purchases_id_seq OWNED BY public.xp_store_purchases.id;


--
-- Name: xp_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.xp_transactions (
    id bigint NOT NULL,
    guild_id character varying(30) NOT NULL,
    user_id character varying(30) NOT NULL,
    xp_amount integer NOT NULL,
    source character varying(30) DEFAULT 'message'::character varying NOT NULL,
    description character varying(200),
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: xp_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.xp_transactions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: xp_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.xp_transactions_id_seq OWNED BY public.xp_transactions.id;


--
-- Name: accounts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts ALTER COLUMN id SET DEFAULT nextval('public.accounts_id_seq'::regclass);


--
-- Name: admin_mod_actions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_mod_actions ALTER COLUMN id SET DEFAULT nextval('public.admin_mod_actions_id_seq'::regclass);


--
-- Name: ai_usage_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_usage_logs ALTER COLUMN id SET DEFAULT nextval('public.ai_usage_logs_id_seq'::regclass);


--
-- Name: banned_words id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.banned_words ALTER COLUMN id SET DEFAULT nextval('public.banned_words_id_seq'::regclass);


--
-- Name: billing_profiles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_profiles ALTER COLUMN id SET DEFAULT nextval('public.billing_profiles_id_seq'::regclass);


--
-- Name: bot_catalog id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_catalog ALTER COLUMN id SET DEFAULT nextval('public.bot_catalog_id_seq'::regclass);


--
-- Name: brand_assets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_assets ALTER COLUMN id SET DEFAULT nextval('public.brand_assets_id_seq'::regclass);


--
-- Name: card_event_banners id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.card_event_banners ALTER COLUMN id SET DEFAULT nextval('public.card_event_banners_id_seq'::regclass);


--
-- Name: card_level_art id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.card_level_art ALTER COLUMN id SET DEFAULT nextval('public.card_level_art_id_seq'::regclass);


--
-- Name: card_sobre_tiers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.card_sobre_tiers ALTER COLUMN id SET DEFAULT nextval('public.card_sobre_tiers_id_seq'::regclass);


--
-- Name: channel_bot_entries id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_bot_entries ALTER COLUMN id SET DEFAULT nextval('public.channel_bot_entries_id_seq'::regclass);


--
-- Name: channel_emote_reports id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_emote_reports ALTER COLUMN id SET DEFAULT nextval('public.channel_emote_reports_id_seq'::regclass);


--
-- Name: channel_emote_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_emote_settings ALTER COLUMN id SET DEFAULT nextval('public.channel_emote_settings_id_seq'::regclass);


--
-- Name: channel_emote_uploaders id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_emote_uploaders ALTER COLUMN id SET DEFAULT nextval('public.channel_emote_uploaders_id_seq'::regclass);


--
-- Name: channel_emotes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_emotes ALTER COLUMN id SET DEFAULT nextval('public.channel_emotes_id_seq'::regclass);


--
-- Name: channel_followers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_followers ALTER COLUMN id SET DEFAULT nextval('public.channel_followers_id_seq'::regclass);


--
-- Name: chat_overlay_configs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_overlay_configs ALTER COLUMN id SET DEFAULT nextval('public.chat_overlay_configs_id_seq'::regclass);


--
-- Name: coin_discount_codes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coin_discount_codes ALTER COLUMN id SET DEFAULT nextval('public.coin_discount_codes_id_seq'::regclass);


--
-- Name: coin_discount_uses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coin_discount_uses ALTER COLUMN id SET DEFAULT nextval('public.coin_discount_uses_id_seq'::regclass);


--
-- Name: coin_flags id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coin_flags ALTER COLUMN id SET DEFAULT nextval('public.coin_flags_id_seq'::regclass);


--
-- Name: coin_packages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coin_packages ALTER COLUMN id SET DEFAULT nextval('public.coin_packages_id_seq'::regclass);


--
-- Name: coin_pending_orders id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coin_pending_orders ALTER COLUMN id SET DEFAULT nextval('public.coin_pending_orders_id_seq'::regclass);


--
-- Name: coin_purchases id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coin_purchases ALTER COLUMN id SET DEFAULT nextval('public.coin_purchases_id_seq'::regclass);


--
-- Name: coin_referrals id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coin_referrals ALTER COLUMN id SET DEFAULT nextval('public.coin_referrals_id_seq'::regclass);


--
-- Name: coin_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coin_settings ALTER COLUMN id SET DEFAULT nextval('public.coin_settings_id_seq'::regclass);


--
-- Name: coin_transactions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coin_transactions ALTER COLUMN id SET DEFAULT nextval('public.coin_transactions_id_seq'::regclass);


--
-- Name: coin_transfers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coin_transfers ALTER COLUMN id SET DEFAULT nextval('public.coin_transfers_id_seq'::regclass);


--
-- Name: credit_packages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_packages ALTER COLUMN id SET DEFAULT nextval('public.credit_packages_id_seq'::regclass);


--
-- Name: credit_purchases id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_purchases ALTER COLUMN id SET DEFAULT nextval('public.credit_purchases_id_seq'::regclass);


--
-- Name: decatron_ai_channel_config id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.decatron_ai_channel_config ALTER COLUMN id SET DEFAULT nextval('public.decatron_ai_channel_config_id_seq'::regclass);


--
-- Name: decatron_ai_channel_permissions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.decatron_ai_channel_permissions ALTER COLUMN id SET DEFAULT nextval('public.decatron_ai_channel_permissions_id_seq'::regclass);


--
-- Name: decatron_ai_global_config id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.decatron_ai_global_config ALTER COLUMN id SET DEFAULT nextval('public.decatron_ai_global_config_id_seq'::regclass);


--
-- Name: decatron_ai_usage id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.decatron_ai_usage ALTER COLUMN id SET DEFAULT nextval('public.decatron_ai_usage_id_seq'::regclass);


--
-- Name: decatron_chat_config id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.decatron_chat_config ALTER COLUMN id SET DEFAULT nextval('public.decatron_chat_config_id_seq'::regclass);


--
-- Name: decatron_chat_messages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.decatron_chat_messages ALTER COLUMN id SET DEFAULT nextval('public.decatron_chat_messages_id_seq'::regclass);


--
-- Name: decatron_chat_permissions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.decatron_chat_permissions ALTER COLUMN id SET DEFAULT nextval('public.decatron_chat_permissions_id_seq'::regclass);


--
-- Name: design_versions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_versions ALTER COLUMN id SET DEFAULT nextval('public.design_versions_id_seq'::regclass);


--
-- Name: desktop_devices id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.desktop_devices ALTER COLUMN id SET DEFAULT nextval('public.live_translation_devices_id_seq'::regclass);


--
-- Name: discord_alert_messages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discord_alert_messages ALTER COLUMN id SET DEFAULT nextval('public.discord_alert_messages_id_seq'::regclass);


--
-- Name: discord_guild_configs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discord_guild_configs ALTER COLUMN id SET DEFAULT nextval('public.discord_guild_configs_id_seq'::regclass);


--
-- Name: discord_live_alerts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discord_live_alerts ALTER COLUMN id SET DEFAULT nextval('public.discord_live_alerts_id_seq'::regclass);


--
-- Name: discord_welcome_configs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discord_welcome_configs ALTER COLUMN id SET DEFAULT nextval('public.discord_welcome_configs_id_seq'::regclass);


--
-- Name: discount_codes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discount_codes ALTER COLUMN id SET DEFAULT nextval('public.discount_codes_id_seq'::regclass);


--
-- Name: email_campaigns id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_campaigns ALTER COLUMN id SET DEFAULT nextval('public.email_campaigns_id_seq'::regclass);


--
-- Name: email_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_logs ALTER COLUMN id SET DEFAULT nextval('public.email_logs_id_seq'::regclass);


--
-- Name: email_templates id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_templates ALTER COLUMN id SET DEFAULT nextval('public.email_templates_id_seq'::regclass);


--
-- Name: event_alerts_configs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_alerts_configs ALTER COLUMN id SET DEFAULT nextval('public.event_alerts_configs_id_seq'::regclass);


--
-- Name: fixed_costs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fixed_costs ALTER COLUMN id SET DEFAULT nextval('public.fixed_costs_id_seq'::regclass);


--
-- Name: follow_alert_configs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follow_alert_configs ALTER COLUMN id SET DEFAULT nextval('public.follow_alert_configs_id_seq'::regclass);


--
-- Name: follow_alert_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follow_alert_history ALTER COLUMN id SET DEFAULT nextval('public.follow_alert_history_id_seq'::regclass);


--
-- Name: follower_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follower_history ALTER COLUMN id SET DEFAULT nextval('public.follower_history_id_seq'::regclass);


--
-- Name: fortnite_sprites id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fortnite_sprites ALTER COLUMN id SET DEFAULT nextval('public.fortnite_sprites_id_seq'::regclass);


--
-- Name: gacha_achievements id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_achievements ALTER COLUMN id SET DEFAULT nextval('public.gacha_achievements_id_seq'::regclass);


--
-- Name: gacha_banners id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_banners ALTER COLUMN id SET DEFAULT nextval('public.gacha_banners_id_seq'::regclass);


--
-- Name: gacha_command_aliases id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_command_aliases ALTER COLUMN id SET DEFAULT nextval('public.gacha_command_aliases_id_seq'::regclass);


--
-- Name: gacha_command_configs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_command_configs ALTER COLUMN id SET DEFAULT nextval('public.gacha_command_configs_id_seq'::regclass);


--
-- Name: gacha_integration_configs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_integration_configs ALTER COLUMN id SET DEFAULT nextval('public.gacha_integration_configs_id_seq'::regclass);


--
-- Name: gacha_inventory id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_inventory ALTER COLUMN id SET DEFAULT nextval('public.gacha_inventory_id_seq'::regclass);


--
-- Name: gacha_item_restrictions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_item_restrictions ALTER COLUMN id SET DEFAULT nextval('public.gacha_item_restrictions_id_seq'::regclass);


--
-- Name: gacha_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_items ALTER COLUMN id SET DEFAULT nextval('public.gacha_items_id_seq'::regclass);


--
-- Name: gacha_overlay_configs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_overlay_configs ALTER COLUMN id SET DEFAULT nextval('public.gacha_overlay_configs_id_seq'::regclass);


--
-- Name: gacha_participants id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_participants ALTER COLUMN id SET DEFAULT nextval('public.gacha_participants_id_seq'::regclass);


--
-- Name: gacha_preferences id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_preferences ALTER COLUMN id SET DEFAULT nextval('public.gacha_preferences_id_seq'::regclass);


--
-- Name: gacha_pull_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_pull_logs ALTER COLUMN id SET DEFAULT nextval('public.gacha_pull_logs_id_seq'::regclass);


--
-- Name: gacha_rarity_configs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_rarity_configs ALTER COLUMN id SET DEFAULT nextval('public.gacha_rarity_configs_id_seq'::regclass);


--
-- Name: gacha_rarity_restrictions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_rarity_restrictions ALTER COLUMN id SET DEFAULT nextval('public.gacha_rarity_restrictions_id_seq'::regclass);


--
-- Name: gacha_showcases id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_showcases ALTER COLUMN id SET DEFAULT nextval('public.gacha_showcases_id_seq'::regclass);


--
-- Name: gacha_sound_configs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_sound_configs ALTER COLUMN id SET DEFAULT nextval('public.gacha_sound_configs_id_seq'::regclass);


--
-- Name: gacha_user_achievements id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_user_achievements ALTER COLUMN id SET DEFAULT nextval('public.gacha_user_achievements_id_seq'::regclass);


--
-- Name: gacha_viewer_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_viewer_settings ALTER COLUMN id SET DEFAULT nextval('public.gacha_viewer_settings_id_seq'::regclass);


--
-- Name: gacha_wishlists id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_wishlists ALTER COLUMN id SET DEFAULT nextval('public.gacha_wishlists_id_seq'::regclass);


--
-- Name: game_category_mappings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_category_mappings ALTER COLUMN id SET DEFAULT nextval('public.game_category_mappings_id_seq'::regclass);


--
-- Name: game_data_cache id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_data_cache ALTER COLUMN id SET DEFAULT nextval('public.game_data_cache_id_seq'::regclass);


--
-- Name: game_overlay_configs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_overlay_configs ALTER COLUMN id SET DEFAULT nextval('public.game_overlay_configs_id_seq'::regclass);


--
-- Name: game_overlay_promos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_overlay_promos ALTER COLUMN id SET DEFAULT nextval('public.game_overlay_promos_id_seq'::regclass);


--
-- Name: game_session_snapshots id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_session_snapshots ALTER COLUMN id SET DEFAULT nextval('public.game_session_snapshots_id_seq'::regclass);


--
-- Name: giveaway_blacklist id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.giveaway_blacklist ALTER COLUMN id SET DEFAULT nextval('public.giveaway_blacklist_id_seq'::regclass);


--
-- Name: giveaway_configs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.giveaway_configs ALTER COLUMN id SET DEFAULT nextval('public.giveaway_configs_id_seq'::regclass);


--
-- Name: giveaway_participants id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.giveaway_participants ALTER COLUMN id SET DEFAULT nextval('public.giveaway_participants_id_seq'::regclass);


--
-- Name: giveaway_sessions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.giveaway_sessions ALTER COLUMN id SET DEFAULT nextval('public.giveaway_sessions_id_seq'::regclass);


--
-- Name: giveaway_winner_cooldowns id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.giveaway_winner_cooldowns ALTER COLUMN id SET DEFAULT nextval('public.giveaway_winner_cooldowns_id_seq'::regclass);


--
-- Name: giveaway_winners id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.giveaway_winners ALTER COLUMN id SET DEFAULT nextval('public.giveaway_winners_id_seq'::regclass);


--
-- Name: global_emote_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.global_emote_log ALTER COLUMN id SET DEFAULT nextval('public.global_emote_log_id_seq'::regclass);


--
-- Name: global_emote_managers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.global_emote_managers ALTER COLUMN id SET DEFAULT nextval('public.global_emote_managers_id_seq'::regclass);


--
-- Name: global_emote_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.global_emote_requests ALTER COLUMN id SET DEFAULT nextval('public.global_emote_requests_id_seq'::regclass);


--
-- Name: global_emotes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.global_emotes ALTER COLUMN id SET DEFAULT nextval('public.global_emotes_id_seq'::regclass);


--
-- Name: linked_game_accounts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linked_game_accounts ALTER COLUMN id SET DEFAULT nextval('public.linked_game_accounts_id_seq'::regclass);


--
-- Name: live_overlay_configs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_overlay_configs ALTER COLUMN id SET DEFAULT nextval('public.live_overlay_configs_id_seq'::regclass);


--
-- Name: live_translation_sessions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_translation_sessions ALTER COLUMN id SET DEFAULT nextval('public.live_translation_sessions_id_seq'::regclass);


--
-- Name: live_translation_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_translation_settings ALTER COLUMN id SET DEFAULT nextval('public.live_translation_settings_id_seq'::regclass);


--
-- Name: lol_coach_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lol_coach_settings ALTER COLUMN id SET DEFAULT nextval('public.lol_coach_settings_id_seq'::regclass);


--
-- Name: lol_prediction_bets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lol_prediction_bets ALTER COLUMN id SET DEFAULT nextval('public.lol_prediction_bets_id_seq'::regclass);


--
-- Name: lol_prediction_points id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lol_prediction_points ALTER COLUMN id SET DEFAULT nextval('public.lol_prediction_points_id_seq'::regclass);


--
-- Name: lol_predictions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lol_predictions ALTER COLUMN id SET DEFAULT nextval('public.lol_predictions_id_seq'::regclass);


--
-- Name: moderation_command_configs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.moderation_command_configs ALTER COLUMN id SET DEFAULT nextval('public.moderation_command_configs_id_seq'::regclass);


--
-- Name: moderation_configs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.moderation_configs ALTER COLUMN id SET DEFAULT nextval('public.moderation_configs_id_seq'::regclass);


--
-- Name: moderation_filters id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.moderation_filters ALTER COLUMN id SET DEFAULT nextval('public.moderation_filters_id_seq'::regclass);


--
-- Name: moderation_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.moderation_logs ALTER COLUMN id SET DEFAULT nextval('public.moderation_logs_id_seq'::regclass);


--
-- Name: now_playing_configs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.now_playing_configs ALTER COLUMN id SET DEFAULT nextval('public.now_playing_configs_id_seq'::regclass);


--
-- Name: pet_configs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pet_configs ALTER COLUMN id SET DEFAULT nextval('public.pet_configs_id_seq'::regclass);


--
-- Name: player_card_instances id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_card_instances ALTER COLUMN id SET DEFAULT nextval('public.player_card_instances_id_seq'::regclass);


--
-- Name: player_pack_inventory id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_pack_inventory ALTER COLUMN id SET DEFAULT nextval('public.player_pack_inventory_id_seq'::regclass);


--
-- Name: public_command_overrides id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.public_command_overrides ALTER COLUMN id SET DEFAULT nextval('public.public_command_overrides_id_seq'::regclass);


--
-- Name: raffle_participants id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raffle_participants ALTER COLUMN id SET DEFAULT nextval('public.raffle_participants_id_seq'::regclass);


--
-- Name: raffle_winners id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raffle_winners ALTER COLUMN id SET DEFAULT nextval('public.raffle_winners_id_seq'::regclass);


--
-- Name: raffles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raffles ALTER COLUMN id SET DEFAULT nextval('public.raffles_id_seq'::regclass);


--
-- Name: rank_card_configs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rank_card_configs ALTER COLUMN id SET DEFAULT nextval('public.rank_card_configs_id_seq'::regclass);


--
-- Name: rank_card_level_configs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rank_card_level_configs ALTER COLUMN id SET DEFAULT nextval('public.rank_card_level_configs_id_seq'::regclass);


--
-- Name: ruleta_command_configs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ruleta_command_configs ALTER COLUMN id SET DEFAULT nextval('public.ruleta_command_configs_id_seq'::regclass);


--
-- Name: ruleta_mod_restores id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ruleta_mod_restores ALTER COLUMN id SET DEFAULT nextval('public.ruleta_mod_restores_id_seq'::regclass);


--
-- Name: song_request_bans id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.song_request_bans ALTER COLUMN id SET DEFAULT nextval('public.song_request_bans_id_seq'::regclass);


--
-- Name: song_request_configs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.song_request_configs ALTER COLUMN id SET DEFAULT nextval('public.song_request_configs_id_seq'::regclass);


--
-- Name: song_request_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.song_request_history ALTER COLUMN id SET DEFAULT nextval('public.song_request_history_id_seq'::regclass);


--
-- Name: song_request_pending id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.song_request_pending ALTER COLUMN id SET DEFAULT nextval('public.song_request_pending_id_seq'::regclass);


--
-- Name: song_request_playlist_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.song_request_playlist_items ALTER COLUMN id SET DEFAULT nextval('public.song_request_playlist_items_id_seq'::regclass);


--
-- Name: song_request_playlist_votes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.song_request_playlist_votes ALTER COLUMN id SET DEFAULT nextval('public.song_request_playlist_votes_id_seq'::regclass);


--
-- Name: song_request_playlists id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.song_request_playlists ALTER COLUMN id SET DEFAULT nextval('public.song_request_playlists_id_seq'::regclass);


--
-- Name: song_request_queue id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.song_request_queue ALTER COLUMN id SET DEFAULT nextval('public.song_request_queue_id_seq'::regclass);


--
-- Name: song_request_tracks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.song_request_tracks ALTER COLUMN id SET DEFAULT nextval('public.song_request_tracks_id_seq'::regclass);


--
-- Name: song_request_trusted id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.song_request_trusted ALTER COLUMN id SET DEFAULT nextval('public.song_request_trusted_id_seq'::regclass);


--
-- Name: sound_alert_configs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sound_alert_configs ALTER COLUMN id SET DEFAULT nextval('public.sound_alert_configs_id_seq'::regclass);


--
-- Name: sound_alert_files id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sound_alert_files ALTER COLUMN id SET DEFAULT nextval('public.sound_alert_files_id_seq'::regclass);


--
-- Name: sound_alert_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sound_alert_history ALTER COLUMN id SET DEFAULT nextval('public.sound_alert_history_id_seq'::regclass);


--
-- Name: sound_alert_reward_files id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sound_alert_reward_files ALTER COLUMN id SET DEFAULT nextval('public.sound_alert_reward_files_id_seq'::regclass);


--
-- Name: speak_chat_configs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.speak_chat_configs ALTER COLUMN id SET DEFAULT nextval('public.speak_chat_configs_id_seq'::regclass);


--
-- Name: speak_chat_usage_backup id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.speak_chat_usage_backup ALTER COLUMN id SET DEFAULT nextval('public.speak_chat_usage_id_seq'::regclass);


--
-- Name: stream_chat_activities id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stream_chat_activities ALTER COLUMN id SET DEFAULT nextval('public.stream_chat_activities_id_seq'::regclass);


--
-- Name: stream_watch_times id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stream_watch_times ALTER COLUMN id SET DEFAULT nextval('public.stream_watch_times_id_seq'::regclass);


--
-- Name: supporter_payments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supporter_payments ALTER COLUMN id SET DEFAULT nextval('public.supporter_payments_id_seq'::regclass);


--
-- Name: supporters_page_config id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supporters_page_config ALTER COLUMN id SET DEFAULT nextval('public.supporters_page_config_id_seq'::regclass);


--
-- Name: system_admins id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_admins ALTER COLUMN id SET DEFAULT nextval('public.system_admins_id_seq'::regclass);


--
-- Name: tier_features id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tier_features ALTER COLUMN id SET DEFAULT nextval('public.tier_features_id_seq'::regclass);


--
-- Name: tier_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tier_history ALTER COLUMN id SET DEFAULT nextval('public.tier_history_id_seq'::regclass);


--
-- Name: timer_configs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timer_configs ALTER COLUMN id SET DEFAULT nextval('public.timer_configs_id_seq'::regclass);


--
-- Name: timer_event_cooldowns id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timer_event_cooldowns ALTER COLUMN id SET DEFAULT nextval('public.timer_event_cooldowns_id_seq'::regclass);


--
-- Name: timer_event_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timer_event_logs ALTER COLUMN id SET DEFAULT nextval('public.timer_event_logs_id_seq'::regclass);


--
-- Name: timer_happyhour id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timer_happyhour ALTER COLUMN id SET DEFAULT nextval('public.timer_happyhour_id_seq'::regclass);


--
-- Name: timer_manual_happyhour id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timer_manual_happyhour ALTER COLUMN id SET DEFAULT nextval('public.timer_manual_happyhour_id_seq'::regclass);


--
-- Name: timer_media_files id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timer_media_files ALTER COLUMN id SET DEFAULT nextval('public.timer_media_files_id_seq'::regclass);


--
-- Name: timer_schedules id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timer_schedules ALTER COLUMN id SET DEFAULT nextval('public.timer_schedules_id_seq'::regclass);


--
-- Name: timer_session_backups id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timer_session_backups ALTER COLUMN id SET DEFAULT nextval('public.timer_session_backups_id_seq'::regclass);


--
-- Name: timer_sessions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timer_sessions ALTER COLUMN id SET DEFAULT nextval('public.timer_sessions_id_seq'::regclass);


--
-- Name: timer_states id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timer_states ALTER COLUMN id SET DEFAULT nextval('public.timer_states_id_seq'::regclass);


--
-- Name: timer_templates id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timer_templates ALTER COLUMN id SET DEFAULT nextval('public.timer_templates_id_seq'::regclass);


--
-- Name: timers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timers ALTER COLUMN id SET DEFAULT nextval('public.timers_id_seq'::regclass);


--
-- Name: tips_configs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tips_configs ALTER COLUMN id SET DEFAULT nextval('public.tips_configs_id_seq'::regclass);


--
-- Name: tips_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tips_history ALTER COLUMN id SET DEFAULT nextval('public.tips_history_id_seq'::regclass);


--
-- Name: tournament_blue_shell_rules id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_blue_shell_rules ALTER COLUMN id SET DEFAULT nextval('public.tournament_blue_shell_rules_id_seq'::regclass);


--
-- Name: tournament_divisions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_divisions ALTER COLUMN id SET DEFAULT nextval('public.tournament_divisions_id_seq'::regclass);


--
-- Name: tournament_editions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_editions ALTER COLUMN id SET DEFAULT nextval('public.tournament_editions_id_seq'::regclass);


--
-- Name: tournament_fortnite_configs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_fortnite_configs ALTER COLUMN id SET DEFAULT nextval('public.tournament_fortnite_configs_id_seq'::regclass);


--
-- Name: tournament_fortnite_files id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_fortnite_files ALTER COLUMN id SET DEFAULT nextval('public.tournament_fortnite_files_id_seq'::regclass);


--
-- Name: tournament_fortnite_games id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_fortnite_games ALTER COLUMN id SET DEFAULT nextval('public.tournament_fortnite_games_id_seq'::regclass);


--
-- Name: tournament_fortnite_group_teams id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_fortnite_group_teams ALTER COLUMN id SET DEFAULT nextval('public.tournament_fortnite_group_teams_id_seq'::regclass);


--
-- Name: tournament_fortnite_groups id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_fortnite_groups ALTER COLUMN id SET DEFAULT nextval('public.tournament_fortnite_groups_id_seq'::regclass);


--
-- Name: tournament_fortnite_reports id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_fortnite_reports ALTER COLUMN id SET DEFAULT nextval('public.tournament_fortnite_reports_id_seq'::regclass);


--
-- Name: tournament_fortnite_result_audit id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_fortnite_result_audit ALTER COLUMN id SET DEFAULT nextval('public.tournament_fortnite_result_audit_id_seq'::regclass);


--
-- Name: tournament_fortnite_results id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_fortnite_results ALTER COLUMN id SET DEFAULT nextval('public.tournament_fortnite_results_id_seq'::regclass);


--
-- Name: tournament_fortnite_session_checkins id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_fortnite_session_checkins ALTER COLUMN id SET DEFAULT nextval('public.tournament_fortnite_session_checkins_id_seq'::regclass);


--
-- Name: tournament_fortnite_sessions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_fortnite_sessions ALTER COLUMN id SET DEFAULT nextval('public.tournament_fortnite_sessions_id_seq'::regclass);


--
-- Name: tournament_games id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_games ALTER COLUMN id SET DEFAULT nextval('public.tournament_games_id_seq'::regclass);


--
-- Name: tournament_lp_snapshots id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_lp_snapshots ALTER COLUMN id SET DEFAULT nextval('public.tournament_lp_snapshots_id_seq'::regclass);


--
-- Name: tournament_matches id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_matches ALTER COLUMN id SET DEFAULT nextval('public.tournament_matches_id_seq'::regclass);


--
-- Name: tournament_overlay_configs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_overlay_configs ALTER COLUMN id SET DEFAULT nextval('public.tournament_overlay_configs_id_seq'::regclass);


--
-- Name: tournament_participants id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_participants ALTER COLUMN id SET DEFAULT nextval('public.tournament_participants_id_seq'::regclass);


--
-- Name: tournament_prize_tiers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_prize_tiers ALTER COLUMN id SET DEFAULT nextval('public.tournament_prize_tiers_id_seq'::regclass);


--
-- Name: tournament_punishment_types id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_punishment_types ALTER COLUMN id SET DEFAULT nextval('public.tournament_punishment_types_id_seq'::regclass);


--
-- Name: tournament_riot_configs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_riot_configs ALTER COLUMN id SET DEFAULT nextval('public.tournament_riot_configs_id_seq'::regclass);


--
-- Name: tournament_rule_documents id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_rule_documents ALTER COLUMN id SET DEFAULT nextval('public.tournament_rule_documents_id_seq'::regclass);


--
-- Name: tournament_shell_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_shell_events ALTER COLUMN id SET DEFAULT nextval('public.tournament_shell_events_id_seq'::regclass);


--
-- Name: tournament_shell_inventories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_shell_inventories ALTER COLUMN id SET DEFAULT nextval('public.tournament_shell_inventories_id_seq'::regclass);


--
-- Name: tournament_shell_triggers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_shell_triggers ALTER COLUMN id SET DEFAULT nextval('public.tournament_shell_triggers_id_seq'::regclass);


--
-- Name: tournament_sponsors id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_sponsors ALTER COLUMN id SET DEFAULT nextval('public.tournament_sponsors_id_seq'::regclass);


--
-- Name: tournament_teams id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_teams ALTER COLUMN id SET DEFAULT nextval('public.tournament_teams_id_seq'::regclass);


--
-- Name: tournament_win_conditions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_win_conditions ALTER COLUMN id SET DEFAULT nextval('public.tournament_win_conditions_id_seq'::regclass);


--
-- Name: tts_cache_entries id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tts_cache_entries ALTER COLUMN id SET DEFAULT nextval('public.tts_cache_entries_id_seq'::regclass);


--
-- Name: tts_credit_balances id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tts_credit_balances ALTER COLUMN id SET DEFAULT nextval('public.tts_credit_balances_id_seq'::regclass);


--
-- Name: tts_credit_ledger id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tts_credit_ledger ALTER COLUMN id SET DEFAULT nextval('public.tts_credit_ledger_id_seq'::regclass);


--
-- Name: upgrade_attempt_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.upgrade_attempt_log ALTER COLUMN id SET DEFAULT nextval('public.upgrade_attempt_log_id_seq'::regclass);


--
-- Name: user_achievements id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_achievements ALTER COLUMN id SET DEFAULT nextval('public.user_achievements_id_seq'::regclass);


--
-- Name: user_coins id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_coins ALTER COLUMN id SET DEFAULT nextval('public.user_coins_id_seq'::regclass);


--
-- Name: user_fortnite_sprites id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_fortnite_sprites ALTER COLUMN id SET DEFAULT nextval('public.user_fortnite_sprites_id_seq'::regclass);


--
-- Name: user_riot_accounts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_riot_accounts ALTER COLUMN id SET DEFAULT nextval('public.user_riot_accounts_id_seq'::regclass);


--
-- Name: user_spirit_notification_prefs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_spirit_notification_prefs ALTER COLUMN id SET DEFAULT nextval('public.user_spirit_notification_prefs_id_seq'::regclass);


--
-- Name: user_strikes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_strikes ALTER COLUMN id SET DEFAULT nextval('public.user_strikes_id_seq'::regclass);


--
-- Name: user_subscription_tiers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_subscription_tiers ALTER COLUMN id SET DEFAULT nextval('public.user_subscription_tiers_id_seq'::regclass);


--
-- Name: user_xp id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_xp ALTER COLUMN id SET DEFAULT nextval('public.user_xp_id_seq'::regclass);


--
-- Name: user_xp_global id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_xp_global ALTER COLUMN id SET DEFAULT nextval('public.user_xp_global_id_seq'::regclass);


--
-- Name: username_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.username_history ALTER COLUMN id SET DEFAULT nextval('public.username_history_id_seq'::regclass);


--
-- Name: watchtime_command_configs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.watchtime_command_configs ALTER COLUMN id SET DEFAULT nextval('public.watchtime_command_configs_id_seq'::regclass);


--
-- Name: wheel_pending_deliveries id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wheel_pending_deliveries ALTER COLUMN id SET DEFAULT nextval('public.wheel_pending_deliveries_id_seq'::regclass);


--
-- Name: wheel_raffle_configs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wheel_raffle_configs ALTER COLUMN id SET DEFAULT nextval('public.wheel_raffle_configs_id_seq'::regclass);


--
-- Name: wheel_raffle_entries id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wheel_raffle_entries ALTER COLUMN id SET DEFAULT nextval('public.wheel_raffle_entries_id_seq'::regclass);


--
-- Name: wheel_segments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wheel_segments ALTER COLUMN id SET DEFAULT nextval('public.wheel_segments_id_seq'::regclass);


--
-- Name: wheel_spins id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wheel_spins ALTER COLUMN id SET DEFAULT nextval('public.wheel_spins_id_seq'::regclass);


--
-- Name: wheel_wallet_sources id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wheel_wallet_sources ALTER COLUMN id SET DEFAULT nextval('public.wheel_wallet_sources_id_seq'::regclass);


--
-- Name: wheel_wallets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wheel_wallets ALTER COLUMN id SET DEFAULT nextval('public.wheel_wallets_id_seq'::regclass);


--
-- Name: wheels id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wheels ALTER COLUMN id SET DEFAULT nextval('public.wheels_id_seq'::regclass);


--
-- Name: xp_achievements id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.xp_achievements ALTER COLUMN id SET DEFAULT nextval('public.xp_achievements_id_seq'::regclass);


--
-- Name: xp_boosts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.xp_boosts ALTER COLUMN id SET DEFAULT nextval('public.xp_boosts_id_seq'::regclass);


--
-- Name: xp_configs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.xp_configs ALTER COLUMN id SET DEFAULT nextval('public.xp_configs_id_seq'::regclass);


--
-- Name: xp_roles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.xp_roles ALTER COLUMN id SET DEFAULT nextval('public.xp_roles_id_seq'::regclass);


--
-- Name: xp_seasonal id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.xp_seasonal ALTER COLUMN id SET DEFAULT nextval('public.xp_seasonal_id_seq'::regclass);


--
-- Name: xp_store_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.xp_store_items ALTER COLUMN id SET DEFAULT nextval('public.xp_store_items_id_seq'::regclass);


--
-- Name: xp_store_purchases id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.xp_store_purchases ALTER COLUMN id SET DEFAULT nextval('public.xp_store_purchases_id_seq'::regclass);


--
-- Name: xp_transactions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.xp_transactions ALTER COLUMN id SET DEFAULT nextval('public.xp_transactions_id_seq'::regclass);


--
-- Name: __EFMigrationsHistory PK___EFMigrationsHistory; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."__EFMigrationsHistory"
    ADD CONSTRAINT "PK___EFMigrationsHistory" PRIMARY KEY ("MigrationId");


--
-- Name: bot_tokens PK_bot_tokens; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_tokens
    ADD CONSTRAINT "PK_bot_tokens" PRIMARY KEY ("Id");


--
-- Name: categories PK_categories; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT "PK_categories" PRIMARY KEY ("Id");


--
-- Name: chat_messages PK_chat_messages; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT "PK_chat_messages" PRIMARY KEY ("Id");


--
-- Name: command_counters PK_command_counters; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.command_counters
    ADD CONSTRAINT "PK_command_counters" PRIMARY KEY (id);


--
-- Name: command_settings PK_command_settings; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.command_settings
    ADD CONSTRAINT "PK_command_settings" PRIMARY KEY ("Id");


--
-- Name: command_uses PK_command_uses; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.command_uses
    ADD CONSTRAINT "PK_command_uses" PRIMARY KEY (id);


--
-- Name: custom_commands PK_custom_commands; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_commands
    ADD CONSTRAINT "PK_custom_commands" PRIMARY KEY ("Id");


--
-- Name: gacha_linked_accounts PK_gacha_linked_accounts; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_linked_accounts
    ADD CONSTRAINT "PK_gacha_linked_accounts" PRIMARY KEY (id);


--
-- Name: game_aliases PK_game_aliases; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_aliases
    ADD CONSTRAINT "PK_game_aliases" PRIMARY KEY (alias);


--
-- Name: game_cache PK_game_cache; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_cache
    ADD CONSTRAINT "PK_game_cache" PRIMARY KEY (game_id);


--
-- Name: game_history PK_game_history; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_history
    ADD CONSTRAINT "PK_game_history" PRIMARY KEY ("Id");


--
-- Name: micro_game_commands PK_micro_game_commands; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.micro_game_commands
    ADD CONSTRAINT "PK_micro_game_commands" PRIMARY KEY ("Id");


--
-- Name: scripted_commands PK_scripted_commands; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scripted_commands
    ADD CONSTRAINT "PK_scripted_commands" PRIMARY KEY ("Id");


--
-- Name: shoutout_configs PK_shoutout_configs; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shoutout_configs
    ADD CONSTRAINT "PK_shoutout_configs" PRIMARY KEY (id);


--
-- Name: shoutout_history PK_shoutout_history; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shoutout_history
    ADD CONSTRAINT "PK_shoutout_history" PRIMARY KEY (id);


--
-- Name: system_settings PK_system_settings; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT "PK_system_settings" PRIMARY KEY (id);


--
-- Name: title_history PK_title_history; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.title_history
    ADD CONSTRAINT "PK_title_history" PRIMARY KEY (id);


--
-- Name: user_access PK_user_access; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_access
    ADD CONSTRAINT "PK_user_access" PRIMARY KEY ("Id");


--
-- Name: user_channel_permissions PK_user_channel_permissions; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_channel_permissions
    ADD CONSTRAINT "PK_user_channel_permissions" PRIMARY KEY ("Id");


--
-- Name: users PK_users; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "PK_users" PRIMARY KEY (id);


--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);


--
-- Name: admin_mod_actions admin_mod_actions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_mod_actions
    ADD CONSTRAINT admin_mod_actions_pkey PRIMARY KEY (id);


--
-- Name: ai_usage_logs ai_usage_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_usage_logs
    ADD CONSTRAINT ai_usage_logs_pkey PRIMARY KEY (id);


--
-- Name: banned_words banned_words_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.banned_words
    ADD CONSTRAINT banned_words_pkey PRIMARY KEY (id);


--
-- Name: billing_profiles billing_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_profiles
    ADD CONSTRAINT billing_profiles_pkey PRIMARY KEY (id);


--
-- Name: billing_profiles billing_profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_profiles
    ADD CONSTRAINT billing_profiles_user_id_key UNIQUE (user_id);


--
-- Name: bot_catalog bot_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_catalog
    ADD CONSTRAINT bot_catalog_pkey PRIMARY KEY (id);


--
-- Name: brand_assets brand_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_assets
    ADD CONSTRAINT brand_assets_pkey PRIMARY KEY (id);


--
-- Name: brand_slots brand_slots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_slots
    ADD CONSTRAINT brand_slots_pkey PRIMARY KEY (slot_key);


--
-- Name: card_event_banners card_event_banners_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.card_event_banners
    ADD CONSTRAINT card_event_banners_pkey PRIMARY KEY (id);


--
-- Name: card_level_art card_level_art_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.card_level_art
    ADD CONSTRAINT card_level_art_pkey PRIMARY KEY (id);


--
-- Name: card_sobre_tiers card_sobre_tiers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.card_sobre_tiers
    ADD CONSTRAINT card_sobre_tiers_pkey PRIMARY KEY (id);


--
-- Name: cards cards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cards
    ADD CONSTRAINT cards_pkey PRIMARY KEY (id);


--
-- Name: channel_bot_entries channel_bot_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_bot_entries
    ADD CONSTRAINT channel_bot_entries_pkey PRIMARY KEY (id);


--
-- Name: channel_emote_reports channel_emote_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_emote_reports
    ADD CONSTRAINT channel_emote_reports_pkey PRIMARY KEY (id);


--
-- Name: channel_emote_settings channel_emote_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_emote_settings
    ADD CONSTRAINT channel_emote_settings_pkey PRIMARY KEY (id);


--
-- Name: channel_emote_uploaders channel_emote_uploaders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_emote_uploaders
    ADD CONSTRAINT channel_emote_uploaders_pkey PRIMARY KEY (id);


--
-- Name: channel_emotes channel_emotes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_emotes
    ADD CONSTRAINT channel_emotes_pkey PRIMARY KEY (id);


--
-- Name: channel_followers channel_followers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_followers
    ADD CONSTRAINT channel_followers_pkey PRIMARY KEY (id);


--
-- Name: chat_overlay_configs chat_overlay_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_overlay_configs
    ADD CONSTRAINT chat_overlay_configs_pkey PRIMARY KEY (id);


--
-- Name: coin_discount_codes coin_discount_codes_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coin_discount_codes
    ADD CONSTRAINT coin_discount_codes_code_key UNIQUE (code);


--
-- Name: coin_discount_codes coin_discount_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coin_discount_codes
    ADD CONSTRAINT coin_discount_codes_pkey PRIMARY KEY (id);


--
-- Name: coin_discount_uses coin_discount_uses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coin_discount_uses
    ADD CONSTRAINT coin_discount_uses_pkey PRIMARY KEY (id);


--
-- Name: coin_flags coin_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coin_flags
    ADD CONSTRAINT coin_flags_pkey PRIMARY KEY (id);


--
-- Name: coin_packages coin_packages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coin_packages
    ADD CONSTRAINT coin_packages_pkey PRIMARY KEY (id);


--
-- Name: coin_pending_orders coin_pending_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coin_pending_orders
    ADD CONSTRAINT coin_pending_orders_pkey PRIMARY KEY (id);


--
-- Name: coin_purchases coin_purchases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coin_purchases
    ADD CONSTRAINT coin_purchases_pkey PRIMARY KEY (id);


--
-- Name: coin_referrals coin_referrals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coin_referrals
    ADD CONSTRAINT coin_referrals_pkey PRIMARY KEY (id);


--
-- Name: coin_settings coin_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coin_settings
    ADD CONSTRAINT coin_settings_pkey PRIMARY KEY (id);


--
-- Name: coin_transactions coin_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coin_transactions
    ADD CONSTRAINT coin_transactions_pkey PRIMARY KEY (id);


--
-- Name: coin_transfers coin_transfers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coin_transfers
    ADD CONSTRAINT coin_transfers_pkey PRIMARY KEY (id);


--
-- Name: credit_packages credit_packages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_packages
    ADD CONSTRAINT credit_packages_pkey PRIMARY KEY (id);


--
-- Name: credit_purchases credit_purchases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_purchases
    ADD CONSTRAINT credit_purchases_pkey PRIMARY KEY (id);


--
-- Name: credit_rates credit_rates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_rates
    ADD CONSTRAINT credit_rates_pkey PRIMARY KEY (engine);


--
-- Name: decatron_ai_channel_config decatron_ai_channel_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.decatron_ai_channel_config
    ADD CONSTRAINT decatron_ai_channel_config_pkey PRIMARY KEY (id);


--
-- Name: decatron_ai_channel_permissions decatron_ai_channel_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.decatron_ai_channel_permissions
    ADD CONSTRAINT decatron_ai_channel_permissions_pkey PRIMARY KEY (id);


--
-- Name: decatron_ai_global_config decatron_ai_global_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.decatron_ai_global_config
    ADD CONSTRAINT decatron_ai_global_config_pkey PRIMARY KEY (id);


--
-- Name: decatron_ai_usage decatron_ai_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.decatron_ai_usage
    ADD CONSTRAINT decatron_ai_usage_pkey PRIMARY KEY (id);


--
-- Name: decatron_chat_config decatron_chat_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.decatron_chat_config
    ADD CONSTRAINT decatron_chat_config_pkey PRIMARY KEY (id);


--
-- Name: decatron_chat_conversations decatron_chat_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.decatron_chat_conversations
    ADD CONSTRAINT decatron_chat_conversations_pkey PRIMARY KEY (id);


--
-- Name: decatron_chat_messages decatron_chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.decatron_chat_messages
    ADD CONSTRAINT decatron_chat_messages_pkey PRIMARY KEY (id);


--
-- Name: decatron_chat_permissions decatron_chat_permissions_channel_owner_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.decatron_chat_permissions
    ADD CONSTRAINT decatron_chat_permissions_channel_owner_id_user_id_key UNIQUE (channel_owner_id, user_id);


--
-- Name: decatron_chat_permissions decatron_chat_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.decatron_chat_permissions
    ADD CONSTRAINT decatron_chat_permissions_pkey PRIMARY KEY (id);


--
-- Name: design_versions design_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_versions
    ADD CONSTRAINT design_versions_pkey PRIMARY KEY (id);


--
-- Name: discord_alert_messages discord_alert_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discord_alert_messages
    ADD CONSTRAINT discord_alert_messages_pkey PRIMARY KEY (id);


--
-- Name: discord_guild_configs discord_guild_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discord_guild_configs
    ADD CONSTRAINT discord_guild_configs_pkey PRIMARY KEY (id);


--
-- Name: discord_live_alerts discord_live_alerts_guild_id_channel_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discord_live_alerts
    ADD CONSTRAINT discord_live_alerts_guild_id_channel_name_key UNIQUE (guild_id, channel_name);


--
-- Name: discord_live_alerts discord_live_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discord_live_alerts
    ADD CONSTRAINT discord_live_alerts_pkey PRIMARY KEY (id);


--
-- Name: discord_welcome_configs discord_welcome_configs_guild_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discord_welcome_configs
    ADD CONSTRAINT discord_welcome_configs_guild_id_key UNIQUE (guild_id);


--
-- Name: discord_welcome_configs discord_welcome_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discord_welcome_configs
    ADD CONSTRAINT discord_welcome_configs_pkey PRIMARY KEY (id);


--
-- Name: discount_codes discount_codes_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discount_codes
    ADD CONSTRAINT discount_codes_code_key UNIQUE (code);


--
-- Name: discount_codes discount_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discount_codes
    ADD CONSTRAINT discount_codes_pkey PRIMARY KEY (id);


--
-- Name: email_campaigns email_campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_campaigns
    ADD CONSTRAINT email_campaigns_pkey PRIMARY KEY (id);


--
-- Name: email_logs email_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_logs
    ADD CONSTRAINT email_logs_pkey PRIMARY KEY (id);


--
-- Name: email_templates email_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_pkey PRIMARY KEY (id);


--
-- Name: event_alerts_configs event_alerts_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_alerts_configs
    ADD CONSTRAINT event_alerts_configs_pkey PRIMARY KEY (id);


--
-- Name: finance_settings finance_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_settings
    ADD CONSTRAINT finance_settings_pkey PRIMARY KEY (id);


--
-- Name: fixed_costs fixed_costs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fixed_costs
    ADD CONSTRAINT fixed_costs_pkey PRIMARY KEY (id);


--
-- Name: follow_alert_configs follow_alert_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follow_alert_configs
    ADD CONSTRAINT follow_alert_configs_pkey PRIMARY KEY (id);


--
-- Name: follow_alert_history follow_alert_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follow_alert_history
    ADD CONSTRAINT follow_alert_history_pkey PRIMARY KEY (id);


--
-- Name: follower_history follower_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follower_history
    ADD CONSTRAINT follower_history_pkey PRIMARY KEY (id);


--
-- Name: fortnite_sprites fortnite_sprites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fortnite_sprites
    ADD CONSTRAINT fortnite_sprites_pkey PRIMARY KEY (id);


--
-- Name: fortnite_sprites fortnite_sprites_sprite_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fortnite_sprites
    ADD CONSTRAINT fortnite_sprites_sprite_key_key UNIQUE (sprite_key);


--
-- Name: gacha_achievements gacha_achievements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_achievements
    ADD CONSTRAINT gacha_achievements_pkey PRIMARY KEY (id);


--
-- Name: gacha_banners gacha_banners_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_banners
    ADD CONSTRAINT gacha_banners_pkey PRIMARY KEY (id);


--
-- Name: gacha_command_aliases gacha_command_aliases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_command_aliases
    ADD CONSTRAINT gacha_command_aliases_pkey PRIMARY KEY (id);


--
-- Name: gacha_command_configs gacha_command_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_command_configs
    ADD CONSTRAINT gacha_command_configs_pkey PRIMARY KEY (id);


--
-- Name: gacha_integration_configs gacha_integration_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_integration_configs
    ADD CONSTRAINT gacha_integration_configs_pkey PRIMARY KEY (id);


--
-- Name: gacha_inventory gacha_inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_inventory
    ADD CONSTRAINT gacha_inventory_pkey PRIMARY KEY (id);


--
-- Name: gacha_item_restrictions gacha_item_restrictions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_item_restrictions
    ADD CONSTRAINT gacha_item_restrictions_pkey PRIMARY KEY (id);


--
-- Name: gacha_items gacha_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_items
    ADD CONSTRAINT gacha_items_pkey PRIMARY KEY (id);


--
-- Name: gacha_overlay_configs gacha_overlay_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_overlay_configs
    ADD CONSTRAINT gacha_overlay_configs_pkey PRIMARY KEY (id);


--
-- Name: gacha_participants gacha_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_participants
    ADD CONSTRAINT gacha_participants_pkey PRIMARY KEY (id);


--
-- Name: gacha_preferences gacha_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_preferences
    ADD CONSTRAINT gacha_preferences_pkey PRIMARY KEY (id);


--
-- Name: gacha_pull_logs gacha_pull_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_pull_logs
    ADD CONSTRAINT gacha_pull_logs_pkey PRIMARY KEY (id);


--
-- Name: gacha_rarity_configs gacha_rarity_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_rarity_configs
    ADD CONSTRAINT gacha_rarity_configs_pkey PRIMARY KEY (id);


--
-- Name: gacha_rarity_restrictions gacha_rarity_restrictions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_rarity_restrictions
    ADD CONSTRAINT gacha_rarity_restrictions_pkey PRIMARY KEY (id);


--
-- Name: gacha_showcases gacha_showcases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_showcases
    ADD CONSTRAINT gacha_showcases_pkey PRIMARY KEY (id);


--
-- Name: gacha_sound_configs gacha_sound_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_sound_configs
    ADD CONSTRAINT gacha_sound_configs_pkey PRIMARY KEY (id);


--
-- Name: gacha_user_achievements gacha_user_achievements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_user_achievements
    ADD CONSTRAINT gacha_user_achievements_pkey PRIMARY KEY (id);


--
-- Name: gacha_viewer_settings gacha_viewer_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_viewer_settings
    ADD CONSTRAINT gacha_viewer_settings_pkey PRIMARY KEY (id);


--
-- Name: gacha_wishlists gacha_wishlists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_wishlists
    ADD CONSTRAINT gacha_wishlists_pkey PRIMARY KEY (id);


--
-- Name: game_category_mappings game_category_mappings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_category_mappings
    ADD CONSTRAINT game_category_mappings_pkey PRIMARY KEY (id);


--
-- Name: game_category_mappings game_category_mappings_platform_category_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_category_mappings
    ADD CONSTRAINT game_category_mappings_platform_category_id_key UNIQUE (platform, category_id);


--
-- Name: game_data_cache game_data_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_data_cache
    ADD CONSTRAINT game_data_cache_pkey PRIMARY KEY (id);


--
-- Name: game_data_cache game_data_cache_provider_external_id_kind_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_data_cache
    ADD CONSTRAINT game_data_cache_provider_external_id_kind_key UNIQUE (provider, external_id, kind);


--
-- Name: game_overlay_configs game_overlay_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_overlay_configs
    ADD CONSTRAINT game_overlay_configs_pkey PRIMARY KEY (id);


--
-- Name: game_overlay_configs game_overlay_configs_user_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_overlay_configs
    ADD CONSTRAINT game_overlay_configs_user_id_slug_key UNIQUE (user_id, slug);


--
-- Name: game_overlay_promo_settings game_overlay_promo_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_overlay_promo_settings
    ADD CONSTRAINT game_overlay_promo_settings_pkey PRIMARY KEY (id);


--
-- Name: game_overlay_promos game_overlay_promos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_overlay_promos
    ADD CONSTRAINT game_overlay_promos_pkey PRIMARY KEY (id);


--
-- Name: game_session_snapshots game_session_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_session_snapshots
    ADD CONSTRAINT game_session_snapshots_pkey PRIMARY KEY (id);


--
-- Name: giveaway_blacklist giveaway_blacklist_channel_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.giveaway_blacklist
    ADD CONSTRAINT giveaway_blacklist_channel_id_user_id_key UNIQUE (channel_id, user_id);


--
-- Name: giveaway_blacklist giveaway_blacklist_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.giveaway_blacklist
    ADD CONSTRAINT giveaway_blacklist_pkey PRIMARY KEY (id);


--
-- Name: giveaway_configs giveaway_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.giveaway_configs
    ADD CONSTRAINT giveaway_configs_pkey PRIMARY KEY (id);


--
-- Name: giveaway_participants giveaway_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.giveaway_participants
    ADD CONSTRAINT giveaway_participants_pkey PRIMARY KEY (id);


--
-- Name: giveaway_sessions giveaway_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.giveaway_sessions
    ADD CONSTRAINT giveaway_sessions_pkey PRIMARY KEY (id);


--
-- Name: giveaway_winner_cooldowns giveaway_winner_cooldowns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.giveaway_winner_cooldowns
    ADD CONSTRAINT giveaway_winner_cooldowns_pkey PRIMARY KEY (id);


--
-- Name: giveaway_winners giveaway_winners_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.giveaway_winners
    ADD CONSTRAINT giveaway_winners_pkey PRIMARY KEY (id);


--
-- Name: global_emote_log global_emote_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.global_emote_log
    ADD CONSTRAINT global_emote_log_pkey PRIMARY KEY (id);


--
-- Name: global_emote_managers global_emote_managers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.global_emote_managers
    ADD CONSTRAINT global_emote_managers_pkey PRIMARY KEY (id);


--
-- Name: global_emote_requests global_emote_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.global_emote_requests
    ADD CONSTRAINT global_emote_requests_pkey PRIMARY KEY (id);


--
-- Name: global_emotes global_emotes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.global_emotes
    ADD CONSTRAINT global_emotes_pkey PRIMARY KEY (id);


--
-- Name: banned_words idx_banned_word_channel_word; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.banned_words
    ADD CONSTRAINT idx_banned_word_channel_word UNIQUE (channel_name, word);


--
-- Name: channel_followers idx_channel_followers_broadcaster_user; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_followers
    ADD CONSTRAINT idx_channel_followers_broadcaster_user UNIQUE (broadcaster_id, user_id);


--
-- Name: moderation_configs idx_moderation_config_channel; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.moderation_configs
    ADD CONSTRAINT idx_moderation_config_channel UNIQUE (channel_name);


--
-- Name: invoicing_settings invoicing_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoicing_settings
    ADD CONSTRAINT invoicing_settings_pkey PRIMARY KEY (id);


--
-- Name: linked_game_accounts linked_game_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linked_game_accounts
    ADD CONSTRAINT linked_game_accounts_pkey PRIMARY KEY (id);


--
-- Name: live_overlay_configs live_overlay_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_overlay_configs
    ADD CONSTRAINT live_overlay_configs_pkey PRIMARY KEY (id);


--
-- Name: desktop_devices live_translation_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.desktop_devices
    ADD CONSTRAINT live_translation_devices_pkey PRIMARY KEY (id);


--
-- Name: desktop_devices live_translation_devices_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.desktop_devices
    ADD CONSTRAINT live_translation_devices_token_hash_key UNIQUE (token_hash);


--
-- Name: live_translation_sessions live_translation_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_translation_sessions
    ADD CONSTRAINT live_translation_sessions_pkey PRIMARY KEY (id);


--
-- Name: live_translation_settings live_translation_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_translation_settings
    ADD CONSTRAINT live_translation_settings_pkey PRIMARY KEY (id);


--
-- Name: live_translation_settings live_translation_settings_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_translation_settings
    ADD CONSTRAINT live_translation_settings_user_id_key UNIQUE (user_id);


--
-- Name: lol_coach_settings lol_coach_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lol_coach_settings
    ADD CONSTRAINT lol_coach_settings_pkey PRIMARY KEY (id);


--
-- Name: lol_coach_settings lol_coach_settings_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lol_coach_settings
    ADD CONSTRAINT lol_coach_settings_user_id_key UNIQUE (user_id);


--
-- Name: lol_prediction_bets lol_prediction_bets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lol_prediction_bets
    ADD CONSTRAINT lol_prediction_bets_pkey PRIMARY KEY (id);


--
-- Name: lol_prediction_bets lol_prediction_bets_prediction_id_viewer_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lol_prediction_bets
    ADD CONSTRAINT lol_prediction_bets_prediction_id_viewer_key UNIQUE (prediction_id, viewer);


--
-- Name: lol_prediction_points lol_prediction_points_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lol_prediction_points
    ADD CONSTRAINT lol_prediction_points_pkey PRIMARY KEY (id);


--
-- Name: lol_prediction_points lol_prediction_points_user_id_viewer_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lol_prediction_points
    ADD CONSTRAINT lol_prediction_points_user_id_viewer_key UNIQUE (user_id, viewer);


--
-- Name: lol_predictions lol_predictions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lol_predictions
    ADD CONSTRAINT lol_predictions_pkey PRIMARY KEY (id);


--
-- Name: moderation_command_configs moderation_command_configs_channel_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.moderation_command_configs
    ADD CONSTRAINT moderation_command_configs_channel_name_key UNIQUE (channel_name);


--
-- Name: moderation_command_configs moderation_command_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.moderation_command_configs
    ADD CONSTRAINT moderation_command_configs_pkey PRIMARY KEY (id);


--
-- Name: moderation_configs moderation_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.moderation_configs
    ADD CONSTRAINT moderation_configs_pkey PRIMARY KEY (id);


--
-- Name: moderation_filters moderation_filters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.moderation_filters
    ADD CONSTRAINT moderation_filters_pkey PRIMARY KEY (id);


--
-- Name: moderation_logs moderation_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.moderation_logs
    ADD CONSTRAINT moderation_logs_pkey PRIMARY KEY (id);


--
-- Name: moderation_panic moderation_panic_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.moderation_panic
    ADD CONSTRAINT moderation_panic_pkey PRIMARY KEY (channel_name);


--
-- Name: now_playing_configs now_playing_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.now_playing_configs
    ADD CONSTRAINT now_playing_configs_pkey PRIMARY KEY (id);


--
-- Name: oauth_access_tokens oauth_access_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oauth_access_tokens
    ADD CONSTRAINT oauth_access_tokens_pkey PRIMARY KEY (id);


--
-- Name: oauth_access_tokens oauth_access_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oauth_access_tokens
    ADD CONSTRAINT oauth_access_tokens_token_key UNIQUE (token);


--
-- Name: oauth_applications oauth_applications_client_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oauth_applications
    ADD CONSTRAINT oauth_applications_client_id_key UNIQUE (client_id);


--
-- Name: oauth_applications oauth_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oauth_applications
    ADD CONSTRAINT oauth_applications_pkey PRIMARY KEY (id);


--
-- Name: oauth_authorization_codes oauth_authorization_codes_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oauth_authorization_codes
    ADD CONSTRAINT oauth_authorization_codes_code_key UNIQUE (code);


--
-- Name: oauth_authorization_codes oauth_authorization_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oauth_authorization_codes
    ADD CONSTRAINT oauth_authorization_codes_pkey PRIMARY KEY (id);


--
-- Name: oauth_refresh_tokens oauth_refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oauth_refresh_tokens
    ADD CONSTRAINT oauth_refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: oauth_refresh_tokens oauth_refresh_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oauth_refresh_tokens
    ADD CONSTRAINT oauth_refresh_tokens_token_key UNIQUE (token);


--
-- Name: pet_configs pet_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pet_configs
    ADD CONSTRAINT pet_configs_pkey PRIMARY KEY (id);


--
-- Name: pet_seen_chatters pet_seen_chatters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pet_seen_chatters
    ADD CONSTRAINT pet_seen_chatters_pkey PRIMARY KEY (channel_user_id, chatter_login);


--
-- Name: player_card_instances player_card_instances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_card_instances
    ADD CONSTRAINT player_card_instances_pkey PRIMARY KEY (id);


--
-- Name: player_pack_inventory player_pack_inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_pack_inventory
    ADD CONSTRAINT player_pack_inventory_pkey PRIMARY KEY (id);


--
-- Name: player_pity_counter player_pity_counter_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_pity_counter
    ADD CONSTRAINT player_pity_counter_pkey PRIMARY KEY (owner_account_id);


--
-- Name: public_command_overrides public_command_overrides_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.public_command_overrides
    ADD CONSTRAINT public_command_overrides_pkey PRIMARY KEY (id);


--
-- Name: raffle_participants raffle_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raffle_participants
    ADD CONSTRAINT raffle_participants_pkey PRIMARY KEY (id);


--
-- Name: raffle_winners raffle_winners_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raffle_winners
    ADD CONSTRAINT raffle_winners_pkey PRIMARY KEY (id);


--
-- Name: raffles raffles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raffles
    ADD CONSTRAINT raffles_pkey PRIMARY KEY (id);


--
-- Name: rank_card_configs rank_card_configs_guild_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rank_card_configs
    ADD CONSTRAINT rank_card_configs_guild_id_key UNIQUE (guild_id);


--
-- Name: rank_card_configs rank_card_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rank_card_configs
    ADD CONSTRAINT rank_card_configs_pkey PRIMARY KEY (id);


--
-- Name: rank_card_level_configs rank_card_level_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rank_card_level_configs
    ADD CONSTRAINT rank_card_level_configs_pkey PRIMARY KEY (id);


--
-- Name: ruleta_command_configs ruleta_command_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ruleta_command_configs
    ADD CONSTRAINT ruleta_command_configs_pkey PRIMARY KEY (id);


--
-- Name: ruleta_mod_restores ruleta_mod_restores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ruleta_mod_restores
    ADD CONSTRAINT ruleta_mod_restores_pkey PRIMARY KEY (id);


--
-- Name: song_request_bans song_request_bans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.song_request_bans
    ADD CONSTRAINT song_request_bans_pkey PRIMARY KEY (id);


--
-- Name: song_request_configs song_request_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.song_request_configs
    ADD CONSTRAINT song_request_configs_pkey PRIMARY KEY (id);


--
-- Name: song_request_playlist_items song_request_fallback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.song_request_playlist_items
    ADD CONSTRAINT song_request_fallback_pkey PRIMARY KEY (id);


--
-- Name: song_request_history song_request_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.song_request_history
    ADD CONSTRAINT song_request_history_pkey PRIMARY KEY (id);


--
-- Name: song_request_listen_daily song_request_listen_daily_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.song_request_listen_daily
    ADD CONSTRAINT song_request_listen_daily_pkey PRIMARY KEY (playlist_id, day);


--
-- Name: song_request_listen_tracks song_request_listen_tracks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.song_request_listen_tracks
    ADD CONSTRAINT song_request_listen_tracks_pkey PRIMARY KEY (playlist_id, track_id, day);


--
-- Name: song_request_listen_unplayable song_request_listen_unplayable_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.song_request_listen_unplayable
    ADD CONSTRAINT song_request_listen_unplayable_pkey PRIMARY KEY (playlist_id, track_id);


--
-- Name: song_request_listen_visitors song_request_listen_visitors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.song_request_listen_visitors
    ADD CONSTRAINT song_request_listen_visitors_pkey PRIMARY KEY (playlist_id, day, visitor_id);


--
-- Name: song_request_pending song_request_pending_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.song_request_pending
    ADD CONSTRAINT song_request_pending_pkey PRIMARY KEY (id);


--
-- Name: song_request_playlist_votes song_request_playlist_votes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.song_request_playlist_votes
    ADD CONSTRAINT song_request_playlist_votes_pkey PRIMARY KEY (id);


--
-- Name: song_request_playlists song_request_playlists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.song_request_playlists
    ADD CONSTRAINT song_request_playlists_pkey PRIMARY KEY (id);


--
-- Name: song_request_queue song_request_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.song_request_queue
    ADD CONSTRAINT song_request_queue_pkey PRIMARY KEY (id);


--
-- Name: song_request_tracks song_request_tracks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.song_request_tracks
    ADD CONSTRAINT song_request_tracks_pkey PRIMARY KEY (id);


--
-- Name: song_request_trusted song_request_trusted_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.song_request_trusted
    ADD CONSTRAINT song_request_trusted_pkey PRIMARY KEY (id);


--
-- Name: sound_alert_configs sound_alert_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sound_alert_configs
    ADD CONSTRAINT sound_alert_configs_pkey PRIMARY KEY (id);


--
-- Name: sound_alert_files sound_alert_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sound_alert_files
    ADD CONSTRAINT sound_alert_files_pkey PRIMARY KEY (id);


--
-- Name: sound_alert_history sound_alert_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sound_alert_history
    ADD CONSTRAINT sound_alert_history_pkey PRIMARY KEY (id);


--
-- Name: sound_alert_reward_files sound_alert_reward_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sound_alert_reward_files
    ADD CONSTRAINT sound_alert_reward_files_pkey PRIMARY KEY (id);


--
-- Name: speak_chat_configs speak_chat_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.speak_chat_configs
    ADD CONSTRAINT speak_chat_configs_pkey PRIMARY KEY (id);


--
-- Name: speak_chat_usage_backup speak_chat_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.speak_chat_usage_backup
    ADD CONSTRAINT speak_chat_usage_pkey PRIMARY KEY (id);


--
-- Name: speak_chat_usage_backup speak_chat_usage_user_id_year_month_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.speak_chat_usage_backup
    ADD CONSTRAINT speak_chat_usage_user_id_year_month_key UNIQUE (user_id, year, month);


--
-- Name: stream_chat_activities stream_chat_activities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stream_chat_activities
    ADD CONSTRAINT stream_chat_activities_pkey PRIMARY KEY (id);


--
-- Name: stream_watch_times stream_watch_times_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stream_watch_times
    ADD CONSTRAINT stream_watch_times_pkey PRIMARY KEY (id);


--
-- Name: supporter_payments supporter_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supporter_payments
    ADD CONSTRAINT supporter_payments_pkey PRIMARY KEY (id);


--
-- Name: supporters_page_config supporters_page_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supporters_page_config
    ADD CONSTRAINT supporters_page_config_pkey PRIMARY KEY (id);


--
-- Name: system_admins system_admins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_admins
    ADD CONSTRAINT system_admins_pkey PRIMARY KEY (id);


--
-- Name: system_admins system_admins_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_admins
    ADD CONSTRAINT system_admins_user_id_key UNIQUE (user_id);


--
-- Name: tcg_free_pack_claims tcg_free_pack_claims_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tcg_free_pack_claims
    ADD CONSTRAINT tcg_free_pack_claims_pkey PRIMARY KEY (owner_account_id, sobre_tier_id);


--
-- Name: tier_features tier_features_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tier_features
    ADD CONSTRAINT tier_features_pkey PRIMARY KEY (id);


--
-- Name: tier_features tier_features_tier_feature_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tier_features
    ADD CONSTRAINT tier_features_tier_feature_key_key UNIQUE (tier, feature_key);


--
-- Name: tier_history tier_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tier_history
    ADD CONSTRAINT tier_history_pkey PRIMARY KEY (id);


--
-- Name: timer_configs timer_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timer_configs
    ADD CONSTRAINT timer_configs_pkey PRIMARY KEY (id);


--
-- Name: timer_event_cooldowns timer_event_cooldowns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timer_event_cooldowns
    ADD CONSTRAINT timer_event_cooldowns_pkey PRIMARY KEY (id);


--
-- Name: timer_event_logs timer_event_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timer_event_logs
    ADD CONSTRAINT timer_event_logs_pkey PRIMARY KEY (id);


--
-- Name: timer_happyhour timer_happyhour_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timer_happyhour
    ADD CONSTRAINT timer_happyhour_pkey PRIMARY KEY (id);


--
-- Name: timer_manual_happyhour timer_manual_happyhour_channel_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timer_manual_happyhour
    ADD CONSTRAINT timer_manual_happyhour_channel_name_key UNIQUE (channel_name);


--
-- Name: timer_manual_happyhour timer_manual_happyhour_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timer_manual_happyhour
    ADD CONSTRAINT timer_manual_happyhour_pkey PRIMARY KEY (id);


--
-- Name: timer_media_files timer_media_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timer_media_files
    ADD CONSTRAINT timer_media_files_pkey PRIMARY KEY (id);


--
-- Name: timer_schedules timer_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timer_schedules
    ADD CONSTRAINT timer_schedules_pkey PRIMARY KEY (id);


--
-- Name: timer_session_backups timer_session_backups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timer_session_backups
    ADD CONSTRAINT timer_session_backups_pkey PRIMARY KEY (id);


--
-- Name: timer_sessions timer_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timer_sessions
    ADD CONSTRAINT timer_sessions_pkey PRIMARY KEY (id);


--
-- Name: timer_states timer_states_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timer_states
    ADD CONSTRAINT timer_states_pkey PRIMARY KEY (id);


--
-- Name: timer_templates timer_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timer_templates
    ADD CONSTRAINT timer_templates_pkey PRIMARY KEY (id);


--
-- Name: timers timers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timers
    ADD CONSTRAINT timers_pkey PRIMARY KEY (id);


--
-- Name: tips_configs tips_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tips_configs
    ADD CONSTRAINT tips_configs_pkey PRIMARY KEY (id);


--
-- Name: tips_history tips_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tips_history
    ADD CONSTRAINT tips_history_pkey PRIMARY KEY (id);


--
-- Name: tournament_blue_shell_rules tournament_blue_shell_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_blue_shell_rules
    ADD CONSTRAINT tournament_blue_shell_rules_pkey PRIMARY KEY (id);


--
-- Name: tournament_blue_shell_rules tournament_blue_shell_rules_tournament_edition_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_blue_shell_rules
    ADD CONSTRAINT tournament_blue_shell_rules_tournament_edition_id_key UNIQUE (tournament_edition_id);


--
-- Name: tournament_divisions tournament_divisions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_divisions
    ADD CONSTRAINT tournament_divisions_pkey PRIMARY KEY (id);


--
-- Name: tournament_editions tournament_editions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_editions
    ADD CONSTRAINT tournament_editions_pkey PRIMARY KEY (id);


--
-- Name: tournament_fortnite_configs tournament_fortnite_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_fortnite_configs
    ADD CONSTRAINT tournament_fortnite_configs_pkey PRIMARY KEY (id);


--
-- Name: tournament_fortnite_configs tournament_fortnite_configs_tournament_edition_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_fortnite_configs
    ADD CONSTRAINT tournament_fortnite_configs_tournament_edition_id_key UNIQUE (tournament_edition_id);


--
-- Name: tournament_fortnite_files tournament_fortnite_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_fortnite_files
    ADD CONSTRAINT tournament_fortnite_files_pkey PRIMARY KEY (id);


--
-- Name: tournament_fortnite_games tournament_fortnite_games_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_fortnite_games
    ADD CONSTRAINT tournament_fortnite_games_pkey PRIMARY KEY (id);


--
-- Name: tournament_fortnite_games tournament_fortnite_games_session_id_game_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_fortnite_games
    ADD CONSTRAINT tournament_fortnite_games_session_id_game_number_key UNIQUE (session_id, game_number);


--
-- Name: tournament_fortnite_group_teams tournament_fortnite_group_teams_group_id_team_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_fortnite_group_teams
    ADD CONSTRAINT tournament_fortnite_group_teams_group_id_team_id_key UNIQUE (group_id, team_id);


--
-- Name: tournament_fortnite_group_teams tournament_fortnite_group_teams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_fortnite_group_teams
    ADD CONSTRAINT tournament_fortnite_group_teams_pkey PRIMARY KEY (id);


--
-- Name: tournament_fortnite_groups tournament_fortnite_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_fortnite_groups
    ADD CONSTRAINT tournament_fortnite_groups_pkey PRIMARY KEY (id);


--
-- Name: tournament_fortnite_reports tournament_fortnite_reports_game_id_participant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_fortnite_reports
    ADD CONSTRAINT tournament_fortnite_reports_game_id_participant_id_key UNIQUE (game_id, participant_id);


--
-- Name: tournament_fortnite_reports tournament_fortnite_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_fortnite_reports
    ADD CONSTRAINT tournament_fortnite_reports_pkey PRIMARY KEY (id);


--
-- Name: tournament_fortnite_result_audit tournament_fortnite_result_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_fortnite_result_audit
    ADD CONSTRAINT tournament_fortnite_result_audit_pkey PRIMARY KEY (id);


--
-- Name: tournament_fortnite_results tournament_fortnite_results_game_id_team_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_fortnite_results
    ADD CONSTRAINT tournament_fortnite_results_game_id_team_id_key UNIQUE (game_id, team_id);


--
-- Name: tournament_fortnite_results tournament_fortnite_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_fortnite_results
    ADD CONSTRAINT tournament_fortnite_results_pkey PRIMARY KEY (id);


--
-- Name: tournament_fortnite_session_checkins tournament_fortnite_session_check_session_id_participant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_fortnite_session_checkins
    ADD CONSTRAINT tournament_fortnite_session_check_session_id_participant_id_key UNIQUE (session_id, participant_id);


--
-- Name: tournament_fortnite_session_checkins tournament_fortnite_session_checkins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_fortnite_session_checkins
    ADD CONSTRAINT tournament_fortnite_session_checkins_pkey PRIMARY KEY (id);


--
-- Name: tournament_fortnite_sessions tournament_fortnite_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_fortnite_sessions
    ADD CONSTRAINT tournament_fortnite_sessions_pkey PRIMARY KEY (id);


--
-- Name: tournament_games tournament_games_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_games
    ADD CONSTRAINT tournament_games_pkey PRIMARY KEY (id);


--
-- Name: tournament_lp_snapshots tournament_lp_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_lp_snapshots
    ADD CONSTRAINT tournament_lp_snapshots_pkey PRIMARY KEY (id);


--
-- Name: tournament_matches tournament_matches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_matches
    ADD CONSTRAINT tournament_matches_pkey PRIMARY KEY (id);


--
-- Name: tournament_overlay_configs tournament_overlay_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_overlay_configs
    ADD CONSTRAINT tournament_overlay_configs_pkey PRIMARY KEY (id);


--
-- Name: tournament_overlay_configs tournament_overlay_configs_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_overlay_configs
    ADD CONSTRAINT tournament_overlay_configs_token_key UNIQUE (token);


--
-- Name: tournament_overlay_configs tournament_overlay_configs_tournament_participant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_overlay_configs
    ADD CONSTRAINT tournament_overlay_configs_tournament_participant_id_key UNIQUE (tournament_participant_id);


--
-- Name: tournament_participants tournament_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_participants
    ADD CONSTRAINT tournament_participants_pkey PRIMARY KEY (id);


--
-- Name: tournament_prize_tiers tournament_prize_tiers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_prize_tiers
    ADD CONSTRAINT tournament_prize_tiers_pkey PRIMARY KEY (id);


--
-- Name: tournament_punishment_types tournament_punishment_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_punishment_types
    ADD CONSTRAINT tournament_punishment_types_pkey PRIMARY KEY (id);


--
-- Name: tournament_riot_configs tournament_riot_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_riot_configs
    ADD CONSTRAINT tournament_riot_configs_pkey PRIMARY KEY (id);


--
-- Name: tournament_rule_documents tournament_rule_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_rule_documents
    ADD CONSTRAINT tournament_rule_documents_pkey PRIMARY KEY (id);


--
-- Name: tournament_shell_events tournament_shell_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_shell_events
    ADD CONSTRAINT tournament_shell_events_pkey PRIMARY KEY (id);


--
-- Name: tournament_shell_inventories tournament_shell_inventories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_shell_inventories
    ADD CONSTRAINT tournament_shell_inventories_pkey PRIMARY KEY (id);


--
-- Name: tournament_shell_inventories tournament_shell_inventories_tournament_participant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_shell_inventories
    ADD CONSTRAINT tournament_shell_inventories_tournament_participant_id_key UNIQUE (tournament_participant_id);


--
-- Name: tournament_shell_triggers tournament_shell_triggers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_shell_triggers
    ADD CONSTRAINT tournament_shell_triggers_pkey PRIMARY KEY (id);


--
-- Name: tournament_sponsors tournament_sponsors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_sponsors
    ADD CONSTRAINT tournament_sponsors_pkey PRIMARY KEY (id);


--
-- Name: tournament_teams tournament_teams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_teams
    ADD CONSTRAINT tournament_teams_pkey PRIMARY KEY (id);


--
-- Name: tournament_win_conditions tournament_win_conditions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_win_conditions
    ADD CONSTRAINT tournament_win_conditions_pkey PRIMARY KEY (id);


--
-- Name: tts_cache_entries tts_cache_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tts_cache_entries
    ADD CONSTRAINT tts_cache_entries_pkey PRIMARY KEY (id);


--
-- Name: tts_credit_balances tts_credit_balances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tts_credit_balances
    ADD CONSTRAINT tts_credit_balances_pkey PRIMARY KEY (id);


--
-- Name: tts_credit_ledger tts_credit_ledger_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tts_credit_ledger
    ADD CONSTRAINT tts_credit_ledger_pkey PRIMARY KEY (id);


--
-- Name: timer_configs uk_timer_config_channel; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timer_configs
    ADD CONSTRAINT uk_timer_config_channel UNIQUE (channel_name);


--
-- Name: stream_chat_activities unique_channel_user_chat; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stream_chat_activities
    ADD CONSTRAINT unique_channel_user_chat UNIQUE (channel_id, user_id);


--
-- Name: stream_watch_times unique_channel_user_watch; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stream_watch_times
    ADD CONSTRAINT unique_channel_user_watch UNIQUE (channel_id, user_id);


--
-- Name: timer_event_cooldowns unique_event_cooldown; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timer_event_cooldowns
    ADD CONSTRAINT unique_event_cooldown UNIQUE (channel_name, event_type, user_id);


--
-- Name: follow_alert_configs unique_follow_alert_channel; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follow_alert_configs
    ADD CONSTRAINT unique_follow_alert_channel UNIQUE (channel_name);


--
-- Name: upgrade_attempt_log upgrade_attempt_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.upgrade_attempt_log
    ADD CONSTRAINT upgrade_attempt_log_pkey PRIMARY KEY (id);


--
-- Name: bot_catalog uq_bot_catalog; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_catalog
    ADD CONSTRAINT uq_bot_catalog UNIQUE (platform, username);


--
-- Name: channel_bot_entries uq_channel_bot_entries; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_bot_entries
    ADD CONSTRAINT uq_channel_bot_entries UNIQUE (user_id, platform, username);


--
-- Name: channel_emote_reports uq_channel_emote_reports; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_emote_reports
    ADD CONSTRAINT uq_channel_emote_reports UNIQUE (emote_id, reporter_user_id);


--
-- Name: channel_emote_settings uq_channel_emote_settings_user; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_emote_settings
    ADD CONSTRAINT uq_channel_emote_settings_user UNIQUE (user_id);


--
-- Name: channel_emote_uploaders uq_channel_emote_uploaders; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_emote_uploaders
    ADD CONSTRAINT uq_channel_emote_uploaders UNIQUE (user_id, platform, login);


--
-- Name: chat_overlay_configs uq_chat_overlay_configs_user; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_overlay_configs
    ADD CONSTRAINT uq_chat_overlay_configs_user UNIQUE (user_id);


--
-- Name: card_level_art uq_cla_card_level; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.card_level_art
    ADD CONSTRAINT uq_cla_card_level UNIQUE (card_id, level);


--
-- Name: event_alerts_configs uq_event_alerts_user; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_alerts_configs
    ADD CONSTRAINT uq_event_alerts_user UNIQUE (user_id);


--
-- Name: gacha_user_achievements uq_gacha_user_achievement; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_user_achievements
    ADD CONSTRAINT uq_gacha_user_achievement UNIQUE (participant_id, achievement_id);


--
-- Name: gacha_viewer_settings uq_gacha_viewer_user; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_viewer_settings
    ADD CONSTRAINT uq_gacha_viewer_user UNIQUE (user_id);


--
-- Name: gacha_wishlists uq_gacha_wishlist; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_wishlists
    ADD CONSTRAINT uq_gacha_wishlist UNIQUE (participant_id, item_id);


--
-- Name: global_emote_managers uq_global_emote_managers; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.global_emote_managers
    ADD CONSTRAINT uq_global_emote_managers UNIQUE (login);


--
-- Name: moderation_filters uq_moderation_filter_channel_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.moderation_filters
    ADD CONSTRAINT uq_moderation_filter_channel_key UNIQUE (channel_name, filter_key);


--
-- Name: raffle_participants uq_raffle_participant; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raffle_participants
    ADD CONSTRAINT uq_raffle_participant UNIQUE (raffle_id, username);


--
-- Name: raffle_winners uq_raffle_winner_position; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raffle_winners
    ADD CONSTRAINT uq_raffle_winner_position UNIQUE (raffle_id, "position");


--
-- Name: song_request_bans uq_song_request_bans; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.song_request_bans
    ADD CONSTRAINT uq_song_request_bans UNIQUE (user_id, ban_type, value);


--
-- Name: song_request_configs uq_song_request_configs_user; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.song_request_configs
    ADD CONSTRAINT uq_song_request_configs_user UNIQUE (user_id);


--
-- Name: song_request_playlist_items uq_song_request_playlist_items; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.song_request_playlist_items
    ADD CONSTRAINT uq_song_request_playlist_items UNIQUE (playlist_id, track_id);


--
-- Name: song_request_playlist_votes uq_song_request_playlist_votes; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.song_request_playlist_votes
    ADD CONSTRAINT uq_song_request_playlist_votes UNIQUE (item_id, platform, login);


--
-- Name: song_request_tracks uq_song_request_tracks_source; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.song_request_tracks
    ADD CONSTRAINT uq_song_request_tracks_source UNIQUE (source, source_id);


--
-- Name: song_request_trusted uq_song_request_trusted; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.song_request_trusted
    ADD CONSTRAINT uq_song_request_trusted UNIQUE (user_id, platform, login);


--
-- Name: sound_alert_reward_files uq_sound_alert_reward_files_userid_reward; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sound_alert_reward_files
    ADD CONSTRAINT uq_sound_alert_reward_files_userid_reward UNIQUE (user_id, reward_id);


--
-- Name: tournament_editions uq_tournament_editions_channel_slug; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_editions
    ADD CONSTRAINT uq_tournament_editions_channel_slug UNIQUE (channel_owner_id, slug);


--
-- Name: tournament_games uq_tournament_games_match_number; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_games
    ADD CONSTRAINT uq_tournament_games_match_number UNIQUE (tournament_match_id, game_number);


--
-- Name: tournament_lp_snapshots uq_tournament_lp_snapshots_participant_match; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_lp_snapshots
    ADD CONSTRAINT uq_tournament_lp_snapshots_participant_match UNIQUE (tournament_participant_id, riot_match_id);


--
-- Name: tournament_participants uq_tournament_participants_edition_puuid; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_participants
    ADD CONSTRAINT uq_tournament_participants_edition_puuid UNIQUE (tournament_edition_id, riot_puuid);


--
-- Name: tournament_riot_configs uq_tournament_riot_configs_channel; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_riot_configs
    ADD CONSTRAINT uq_tournament_riot_configs_channel UNIQUE (channel_owner_id);


--
-- Name: tournament_rule_documents uq_tournament_rule_documents_edition_type; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_rule_documents
    ADD CONSTRAINT uq_tournament_rule_documents_edition_type UNIQUE (tournament_edition_id, type);


--
-- Name: tts_cache_entries uq_tts_hash; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tts_cache_entries
    ADD CONSTRAINT uq_tts_hash UNIQUE (hash);


--
-- Name: user_achievements uq_user_achievement; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_achievements
    ADD CONSTRAINT uq_user_achievement UNIQUE (guild_id, user_id, achievement_id);


--
-- Name: user_xp uq_user_xp_guild_user; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_xp
    ADD CONSTRAINT uq_user_xp_guild_user UNIQUE (guild_id, user_id);


--
-- Name: wheel_raffle_entries uq_wheel_raffle_entry; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wheel_raffle_entries
    ADD CONSTRAINT uq_wheel_raffle_entry UNIQUE (wheel_id, viewer_login);


--
-- Name: wheel_wallets uq_wheel_wallets_channel_viewer; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wheel_wallets
    ADD CONSTRAINT uq_wheel_wallets_channel_viewer UNIQUE (channel_id, viewer_login);


--
-- Name: wheels uq_wheels_channel_slug; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wheels
    ADD CONSTRAINT uq_wheels_channel_slug UNIQUE (channel_id, slug);


--
-- Name: xp_seasonal uq_xp_seasonal; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.xp_seasonal
    ADD CONSTRAINT uq_xp_seasonal UNIQUE (guild_id, user_id, year_month);


--
-- Name: user_achievements user_achievements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_achievements
    ADD CONSTRAINT user_achievements_pkey PRIMARY KEY (id);


--
-- Name: user_coins user_coins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_coins
    ADD CONSTRAINT user_coins_pkey PRIMARY KEY (id);


--
-- Name: user_fortnite_sprites user_fortnite_sprites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_fortnite_sprites
    ADD CONSTRAINT user_fortnite_sprites_pkey PRIMARY KEY (id);


--
-- Name: user_fortnite_sprites user_fortnite_sprites_user_id_sprite_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_fortnite_sprites
    ADD CONSTRAINT user_fortnite_sprites_user_id_sprite_id_key UNIQUE (user_id, sprite_id);


--
-- Name: user_riot_accounts user_riot_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_riot_accounts
    ADD CONSTRAINT user_riot_accounts_pkey PRIMARY KEY (id);


--
-- Name: user_spirit_notification_prefs user_spirit_notification_prefs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_spirit_notification_prefs
    ADD CONSTRAINT user_spirit_notification_prefs_pkey PRIMARY KEY (id);


--
-- Name: user_spirit_notification_prefs user_spirit_notification_prefs_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_spirit_notification_prefs
    ADD CONSTRAINT user_spirit_notification_prefs_user_id_key UNIQUE (user_id);


--
-- Name: user_strikes user_strikes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_strikes
    ADD CONSTRAINT user_strikes_pkey PRIMARY KEY (id);


--
-- Name: user_subscription_tiers user_subscription_tiers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_subscription_tiers
    ADD CONSTRAINT user_subscription_tiers_pkey PRIMARY KEY (id);


--
-- Name: user_subscription_tiers user_subscription_tiers_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_subscription_tiers
    ADD CONSTRAINT user_subscription_tiers_user_id_key UNIQUE (user_id);


--
-- Name: user_xp_global user_xp_global_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_xp_global
    ADD CONSTRAINT user_xp_global_pkey PRIMARY KEY (id);


--
-- Name: user_xp_global user_xp_global_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_xp_global
    ADD CONSTRAINT user_xp_global_user_id_key UNIQUE (user_id);


--
-- Name: user_xp user_xp_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_xp
    ADD CONSTRAINT user_xp_pkey PRIMARY KEY (id);


--
-- Name: username_history username_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.username_history
    ADD CONSTRAINT username_history_pkey PRIMARY KEY (id);


--
-- Name: watchtime_command_configs watchtime_command_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.watchtime_command_configs
    ADD CONSTRAINT watchtime_command_configs_pkey PRIMARY KEY (id);


--
-- Name: wheel_pending_deliveries wheel_pending_deliveries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wheel_pending_deliveries
    ADD CONSTRAINT wheel_pending_deliveries_pkey PRIMARY KEY (id);


--
-- Name: wheel_raffle_configs wheel_raffle_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wheel_raffle_configs
    ADD CONSTRAINT wheel_raffle_configs_pkey PRIMARY KEY (id);


--
-- Name: wheel_raffle_configs wheel_raffle_configs_wheel_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wheel_raffle_configs
    ADD CONSTRAINT wheel_raffle_configs_wheel_id_key UNIQUE (wheel_id);


--
-- Name: wheel_raffle_entries wheel_raffle_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wheel_raffle_entries
    ADD CONSTRAINT wheel_raffle_entries_pkey PRIMARY KEY (id);


--
-- Name: wheel_segments wheel_segments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wheel_segments
    ADD CONSTRAINT wheel_segments_pkey PRIMARY KEY (id);


--
-- Name: wheel_spins wheel_spins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wheel_spins
    ADD CONSTRAINT wheel_spins_pkey PRIMARY KEY (id);


--
-- Name: wheel_wallet_sources wheel_wallet_sources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wheel_wallet_sources
    ADD CONSTRAINT wheel_wallet_sources_pkey PRIMARY KEY (id);


--
-- Name: wheel_wallets wheel_wallets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wheel_wallets
    ADD CONSTRAINT wheel_wallets_pkey PRIMARY KEY (id);


--
-- Name: wheels wheels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wheels
    ADD CONSTRAINT wheels_pkey PRIMARY KEY (id);


--
-- Name: xp_achievements xp_achievements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.xp_achievements
    ADD CONSTRAINT xp_achievements_pkey PRIMARY KEY (id);


--
-- Name: xp_boosts xp_boosts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.xp_boosts
    ADD CONSTRAINT xp_boosts_pkey PRIMARY KEY (id);


--
-- Name: xp_configs xp_configs_guild_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.xp_configs
    ADD CONSTRAINT xp_configs_guild_id_key UNIQUE (guild_id);


--
-- Name: xp_configs xp_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.xp_configs
    ADD CONSTRAINT xp_configs_pkey PRIMARY KEY (id);


--
-- Name: xp_roles xp_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.xp_roles
    ADD CONSTRAINT xp_roles_pkey PRIMARY KEY (id);


--
-- Name: xp_seasonal xp_seasonal_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.xp_seasonal
    ADD CONSTRAINT xp_seasonal_pkey PRIMARY KEY (id);


--
-- Name: xp_store_items xp_store_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.xp_store_items
    ADD CONSTRAINT xp_store_items_pkey PRIMARY KEY (id);


--
-- Name: xp_store_purchases xp_store_purchases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.xp_store_purchases
    ADD CONSTRAINT xp_store_purchases_pkey PRIMARY KEY (id);


--
-- Name: xp_transactions xp_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.xp_transactions
    ADD CONSTRAINT xp_transactions_pkey PRIMARY KEY (id);


--
-- Name: IX_bot_tokens_bot_username; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IX_bot_tokens_bot_username" ON public.bot_tokens USING btree (bot_username);


--
-- Name: IX_chat_messages_channel_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_chat_messages_channel_timestamp" ON public.chat_messages USING btree (channel, "timestamp");


--
-- Name: IX_chat_messages_username; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_chat_messages_username" ON public.chat_messages USING btree (username);


--
-- Name: IX_command_settings_command_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_command_settings_command_name" ON public.command_settings USING btree (command_name);


--
-- Name: IX_command_settings_user_id_command_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IX_command_settings_user_id_command_name" ON public.command_settings USING btree (user_id, command_name);


--
-- Name: IX_scripted_commands_channel_name_command_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IX_scripted_commands_channel_name_command_name" ON public.scripted_commands USING btree (channel_name, command_name);


--
-- Name: IX_system_settings_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IX_system_settings_user_id" ON public.system_settings USING btree (user_id);


--
-- Name: IX_user_access_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_user_access_user_id" ON public.user_access USING btree (user_id);


--
-- Name: IX_user_channel_permissions_granted_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_user_channel_permissions_granted_by" ON public.user_channel_permissions USING btree (granted_by);


--
-- Name: IX_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_users_email" ON public.users USING btree (email);


--
-- Name: IX_users_login; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IX_users_login" ON public.users USING btree (login);


--
-- Name: IX_users_twitch_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IX_users_twitch_id" ON public.users USING btree (twitch_id);


--
-- Name: IX_users_unique_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IX_users_unique_id" ON public.users USING btree (unique_id);


--
-- Name: cards_combo_hash_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX cards_combo_hash_uidx ON public.cards USING btree (combo_hash);


--
-- Name: idx_access_level; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_access_level ON public.user_channel_permissions USING btree (access_level);


--
-- Name: idx_ai_usage_logs_module_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_usage_logs_module_date ON public.ai_usage_logs USING btree (module, used_at);


--
-- Name: idx_ai_usage_logs_used_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_usage_logs_used_at ON public.ai_usage_logs USING btree (used_at);


--
-- Name: idx_ai_usage_logs_user_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_usage_logs_user_date ON public.ai_usage_logs USING btree (user_id, used_at);


--
-- Name: idx_alert_msgs_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alert_msgs_active ON public.discord_alert_messages USING btree (channel_name) WHERE (is_active = true);


--
-- Name: idx_banned_word_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_banned_word_channel ON public.banned_words USING btree (channel_name);


--
-- Name: idx_billing_profiles_doc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_billing_profiles_doc ON public.billing_profiles USING btree (doc_type, doc_number);


--
-- Name: idx_ceb_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ceb_active ON public.card_event_banners USING btree (event_id, active);


--
-- Name: idx_channel_bot_entries_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_bot_entries_user_id ON public.channel_bot_entries USING btree (user_id);


--
-- Name: idx_channel_emotes_uploader; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_emotes_uploader ON public.channel_emotes USING btree (uploaded_by);


--
-- Name: idx_channel_emotes_user_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_emotes_user_status ON public.channel_emotes USING btree (user_id, status);


--
-- Name: idx_channel_followers_broadcaster; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_followers_broadcaster ON public.channel_followers USING btree (broadcaster_id);


--
-- Name: idx_channel_followers_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_followers_date ON public.channel_followers USING btree (followed_at);


--
-- Name: idx_channel_followers_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_followers_status ON public.channel_followers USING btree (is_following);


--
-- Name: idx_channel_followers_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_followers_user ON public.channel_followers USING btree (user_id);


--
-- Name: idx_channel_granted_user; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_channel_granted_user ON public.user_channel_permissions USING btree (channel_owner_id, granted_user_id);


--
-- Name: idx_channel_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_name ON public.custom_commands USING btree (channel_name);


--
-- Name: idx_channel_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_owner ON public.user_channel_permissions USING btree (channel_owner_id);


--
-- Name: idx_chat_activity_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_activity_channel ON public.stream_chat_activities USING btree (channel_id);


--
-- Name: idx_chat_activity_stream; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_activity_stream ON public.stream_chat_activities USING btree (stream_id);


--
-- Name: idx_chat_activity_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_activity_user ON public.stream_chat_activities USING btree (user_id);


--
-- Name: idx_chat_conversation_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_conversation_channel ON public.decatron_chat_conversations USING btree (channel_owner_id);


--
-- Name: idx_chat_conversation_channel_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_conversation_channel_user ON public.decatron_chat_conversations USING btree (channel_owner_id, user_id, created_at DESC);


--
-- Name: idx_chat_conversation_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_conversation_created ON public.decatron_chat_conversations USING btree (created_at DESC);


--
-- Name: idx_chat_conversation_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_conversation_user ON public.decatron_chat_conversations USING btree (user_id);


--
-- Name: idx_chat_message_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_message_conversation ON public.decatron_chat_messages USING btree (conversation_id);


--
-- Name: idx_chat_message_conversation_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_message_conversation_created ON public.decatron_chat_messages USING btree (conversation_id, created_at);


--
-- Name: idx_chat_message_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_message_created ON public.decatron_chat_messages USING btree (created_at DESC);


--
-- Name: idx_chat_message_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_message_user ON public.decatron_chat_messages USING btree (user_id);


--
-- Name: idx_chat_permission_can_chat; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_permission_can_chat ON public.decatron_chat_permissions USING btree (can_chat);


--
-- Name: idx_chat_permission_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_permission_channel ON public.decatron_chat_permissions USING btree (channel_owner_id);


--
-- Name: idx_chat_permission_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_permission_user ON public.decatron_chat_permissions USING btree (user_id);


--
-- Name: idx_cla_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cla_pending ON public.card_level_art USING btree (requested_at) WHERE ((status)::text <> 'done'::text);


--
-- Name: idx_coin_discount_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coin_discount_code ON public.coin_discount_codes USING btree (code);


--
-- Name: idx_coin_discount_uses_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coin_discount_uses_code ON public.coin_discount_uses USING btree (code_id);


--
-- Name: idx_coin_discount_uses_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coin_discount_uses_user ON public.coin_discount_uses USING btree (user_id);


--
-- Name: idx_coin_flags_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coin_flags_status ON public.coin_flags USING btree (status);


--
-- Name: idx_coin_flags_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coin_flags_user ON public.coin_flags USING btree (user_id);


--
-- Name: idx_coin_pending_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coin_pending_user ON public.coin_pending_orders USING btree (user_id, status);


--
-- Name: idx_coin_purchases_invoice_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coin_purchases_invoice_pending ON public.coin_purchases USING btree (created_at) WHERE (invoice_status = 'PENDING'::text);


--
-- Name: idx_coin_purchases_paypal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coin_purchases_paypal ON public.coin_purchases USING btree (paypal_order_id);


--
-- Name: idx_coin_purchases_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coin_purchases_user ON public.coin_purchases USING btree (user_id);


--
-- Name: idx_coin_referrals_referred; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_coin_referrals_referred ON public.coin_referrals USING btree (referred_user_id);


--
-- Name: idx_coin_referrals_referrer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coin_referrals_referrer ON public.coin_referrals USING btree (referrer_user_id);


--
-- Name: idx_coin_transactions_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coin_transactions_created ON public.coin_transactions USING btree (created_at);


--
-- Name: idx_coin_transactions_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coin_transactions_type ON public.coin_transactions USING btree (type);


--
-- Name: idx_coin_transactions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coin_transactions_user ON public.coin_transactions USING btree (user_id);


--
-- Name: idx_coin_transfers_from; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coin_transfers_from ON public.coin_transfers USING btree (from_user_id);


--
-- Name: idx_coin_transfers_to; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coin_transfers_to ON public.coin_transfers USING btree (to_user_id);


--
-- Name: idx_command_counters_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_command_counters_user_id ON public.command_counters USING btree (user_id);


--
-- Name: idx_command_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_command_name ON public.custom_commands USING btree (command_name);


--
-- Name: idx_command_uses_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_command_uses_user_id ON public.command_uses USING btree (user_id);


--
-- Name: idx_cooldowns_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cooldowns_channel ON public.timer_event_cooldowns USING btree (channel_name);


--
-- Name: idx_cooldowns_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cooldowns_date ON public.timer_event_cooldowns USING btree (last_triggered_at);


--
-- Name: idx_cooldowns_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cooldowns_lookup ON public.timer_event_cooldowns USING btree (channel_name, event_type, user_id);


--
-- Name: idx_custom_commands_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_custom_commands_user_id ON public.custom_commands USING btree (user_id);


--
-- Name: idx_dai_channel_config_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dai_channel_config_channel ON public.decatron_ai_channel_config USING btree (channel_name);


--
-- Name: idx_dai_channel_perm_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dai_channel_perm_channel ON public.decatron_ai_channel_permissions USING btree (channel_name);


--
-- Name: idx_dai_channel_perm_enabled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dai_channel_perm_enabled ON public.decatron_ai_channel_permissions USING btree (enabled);


--
-- Name: idx_dai_usage_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dai_usage_channel ON public.decatron_ai_usage USING btree (channel_name);


--
-- Name: idx_dai_usage_channel_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dai_usage_channel_time ON public.decatron_ai_usage USING btree (channel_name, used_at DESC);


--
-- Name: idx_dai_usage_used_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dai_usage_used_at ON public.decatron_ai_usage USING btree (used_at);


--
-- Name: idx_dai_usage_user_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dai_usage_user_time ON public.decatron_ai_usage USING btree (channel_name, username, used_at DESC);


--
-- Name: idx_dai_usage_username; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dai_usage_username ON public.decatron_ai_usage USING btree (username);


--
-- Name: idx_decatron_ai_channel_config_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_decatron_ai_channel_config_user_id ON public.decatron_ai_channel_config USING btree (user_id);


--
-- Name: idx_decatron_ai_channel_permissions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_decatron_ai_channel_permissions_user_id ON public.decatron_ai_channel_permissions USING btree (user_id);


--
-- Name: idx_decatron_ai_usage_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_decatron_ai_usage_user_id ON public.decatron_ai_usage USING btree (user_id);


--
-- Name: idx_discord_guild_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_discord_guild_channel ON public.discord_guild_configs USING btree (channel_name);


--
-- Name: idx_discord_guild_default; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_discord_guild_default ON public.discord_guild_configs USING btree (guild_id, is_default) WHERE (is_active = true);


--
-- Name: idx_discord_guild_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_discord_guild_id ON public.discord_guild_configs USING btree (guild_id);


--
-- Name: idx_discount_codes_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_discount_codes_active ON public.discount_codes USING btree (active);


--
-- Name: idx_discount_codes_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_discount_codes_code ON public.discount_codes USING btree (code);


--
-- Name: idx_email_campaigns_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_campaigns_status ON public.email_campaigns USING btree (status);


--
-- Name: idx_email_campaigns_template; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_campaigns_template ON public.email_campaigns USING btree (template_id);


--
-- Name: idx_email_logs_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_logs_campaign ON public.email_logs USING btree (campaign_id);


--
-- Name: idx_email_logs_recipient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_logs_recipient ON public.email_logs USING btree (recipient_user_id);


--
-- Name: idx_email_logs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_logs_status ON public.email_logs USING btree (status);


--
-- Name: idx_event_alerts_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_event_alerts_channel ON public.event_alerts_configs USING btree (channel_name);


--
-- Name: idx_event_alerts_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_event_alerts_user_id ON public.event_alerts_configs USING btree (user_id);


--
-- Name: idx_follow_alert_configs_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_follow_alert_configs_channel ON public.follow_alert_configs USING btree (channel_name);


--
-- Name: idx_follow_alert_history_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_follow_alert_history_channel ON public.follow_alert_history USING btree (channel_name);


--
-- Name: idx_follow_alert_history_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_follow_alert_history_date ON public.follow_alert_history USING btree (followed_at);


--
-- Name: idx_follow_alert_history_follower; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_follow_alert_history_follower ON public.follow_alert_history USING btree (channel_name, follower_username);


--
-- Name: idx_follow_alert_history_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_follow_alert_history_user_id ON public.follow_alert_history USING btree (user_id);


--
-- Name: idx_follower_history_broadcaster; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_follower_history_broadcaster ON public.follower_history USING btree (broadcaster_id);


--
-- Name: idx_follower_history_broadcaster_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_follower_history_broadcaster_user ON public.follower_history USING btree (broadcaster_id, user_id);


--
-- Name: idx_follower_history_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_follower_history_timestamp ON public.follower_history USING btree (action_timestamp);


--
-- Name: idx_gacha_achievements_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gacha_achievements_user_id ON public.gacha_achievements USING btree (user_id);


--
-- Name: idx_gacha_banners_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gacha_banners_channel ON public.gacha_banners USING btree (channel_name);


--
-- Name: idx_gacha_banners_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gacha_banners_user_id ON public.gacha_banners USING btree (user_id);


--
-- Name: idx_gacha_command_aliases_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gacha_command_aliases_user_id ON public.gacha_command_aliases USING btree (user_id);


--
-- Name: idx_gacha_command_configs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gacha_command_configs_user_id ON public.gacha_command_configs USING btree (user_id);


--
-- Name: idx_gacha_integration_configs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gacha_integration_configs_user_id ON public.gacha_integration_configs USING btree (user_id);


--
-- Name: idx_gacha_inventory_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gacha_inventory_channel ON public.gacha_inventory USING btree (channel_name);


--
-- Name: idx_gacha_inventory_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gacha_inventory_item ON public.gacha_inventory USING btree (item_id);


--
-- Name: idx_gacha_inventory_participant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gacha_inventory_participant ON public.gacha_inventory USING btree (participant_id);


--
-- Name: idx_gacha_inventory_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gacha_inventory_user_id ON public.gacha_inventory USING btree (user_id);


--
-- Name: idx_gacha_item_restrictions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gacha_item_restrictions_user_id ON public.gacha_item_restrictions USING btree (user_id);


--
-- Name: idx_gacha_items_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gacha_items_channel ON public.gacha_items USING btree (channel_name);


--
-- Name: idx_gacha_items_channel_rarity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gacha_items_channel_rarity ON public.gacha_items USING btree (channel_name, rarity);


--
-- Name: idx_gacha_items_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gacha_items_user_id ON public.gacha_items USING btree (user_id);


--
-- Name: idx_gacha_overlay_configs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gacha_overlay_configs_user_id ON public.gacha_overlay_configs USING btree (user_id);


--
-- Name: idx_gacha_participants_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gacha_participants_channel ON public.gacha_participants USING btree (channel_name);


--
-- Name: idx_gacha_participants_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gacha_participants_user_id ON public.gacha_participants USING btree (user_id);


--
-- Name: idx_gacha_preferences_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gacha_preferences_channel ON public.gacha_preferences USING btree (channel_name);


--
-- Name: idx_gacha_preferences_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gacha_preferences_user_id ON public.gacha_preferences USING btree (user_id);


--
-- Name: idx_gacha_pull_logs_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gacha_pull_logs_channel ON public.gacha_pull_logs USING btree (channel_name);


--
-- Name: idx_gacha_pull_logs_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gacha_pull_logs_date ON public.gacha_pull_logs USING btree (occurred_at);


--
-- Name: idx_gacha_pull_logs_participant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gacha_pull_logs_participant ON public.gacha_pull_logs USING btree (participant_id);


--
-- Name: idx_gacha_pull_logs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gacha_pull_logs_user_id ON public.gacha_pull_logs USING btree (user_id);


--
-- Name: idx_gacha_rarity_configs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gacha_rarity_configs_user_id ON public.gacha_rarity_configs USING btree (user_id);


--
-- Name: idx_gacha_rarity_restrictions_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gacha_rarity_restrictions_channel ON public.gacha_rarity_restrictions USING btree (channel_name);


--
-- Name: idx_gacha_rarity_restrictions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gacha_rarity_restrictions_user_id ON public.gacha_rarity_restrictions USING btree (user_id);


--
-- Name: idx_gacha_showcase_participant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gacha_showcase_participant ON public.gacha_showcases USING btree (participant_id);


--
-- Name: idx_gacha_sound_configs_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gacha_sound_configs_channel ON public.gacha_sound_configs USING btree (channel_name);


--
-- Name: idx_gacha_sound_configs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gacha_sound_configs_user_id ON public.gacha_sound_configs USING btree (user_id);


--
-- Name: idx_gacha_viewer_twitch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gacha_viewer_twitch ON public.gacha_viewer_settings USING btree (twitch_username);


--
-- Name: idx_game_alias_game_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_game_alias_game_id ON public.game_aliases USING btree (game_id);


--
-- Name: idx_game_alias_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_game_alias_type ON public.game_aliases USING btree (alias_type);


--
-- Name: idx_game_cache_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_game_cache_name ON public.game_cache USING btree (name);


--
-- Name: idx_game_cache_popularity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_game_cache_popularity ON public.game_cache USING btree (popularity_rank);


--
-- Name: idx_game_cache_usage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_game_cache_usage ON public.game_cache USING btree (usage_count);


--
-- Name: idx_game_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_game_channel ON public.game_history USING btree (channel_login);


--
-- Name: idx_game_data_cache_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_game_data_cache_expires ON public.game_data_cache USING btree (expires_at);


--
-- Name: idx_game_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_game_date ON public.game_history USING btree (changed_at);


--
-- Name: idx_game_history_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_game_history_user_id ON public.game_history USING btree (user_id);


--
-- Name: idx_game_session_snapshots_account; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_game_session_snapshots_account ON public.game_session_snapshots USING btree (linked_account_id, stream_started_at DESC);


--
-- Name: idx_game_session_snapshots_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_game_session_snapshots_channel ON public.game_session_snapshots USING btree (user_id, game, stream_started_at DESC);


--
-- Name: idx_giveaway_blacklist_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_giveaway_blacklist_channel ON public.giveaway_blacklist USING btree (channel_id);


--
-- Name: idx_giveaway_configs_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_giveaway_configs_channel ON public.giveaway_configs USING btree (channel_id);


--
-- Name: idx_giveaway_cooldowns_channel_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_giveaway_cooldowns_channel_user ON public.giveaway_winner_cooldowns USING btree (channel_id, user_id);


--
-- Name: idx_giveaway_cooldowns_until; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_giveaway_cooldowns_until ON public.giveaway_winner_cooldowns USING btree (cooldown_until);


--
-- Name: idx_giveaway_participants_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_giveaway_participants_session ON public.giveaway_participants USING btree (session_id);


--
-- Name: idx_giveaway_participants_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_giveaway_participants_user ON public.giveaway_participants USING btree (user_id);


--
-- Name: idx_giveaway_participants_weight; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_giveaway_participants_weight ON public.giveaway_participants USING btree (calculated_weight);


--
-- Name: idx_giveaway_sessions_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_giveaway_sessions_channel ON public.giveaway_sessions USING btree (channel_id);


--
-- Name: idx_giveaway_sessions_started_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_giveaway_sessions_started_at ON public.giveaway_sessions USING btree (started_at);


--
-- Name: idx_giveaway_sessions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_giveaway_sessions_status ON public.giveaway_sessions USING btree (status);


--
-- Name: idx_giveaway_winners_backup_promotion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_giveaway_winners_backup_promotion ON public.giveaway_winners USING btree (session_id, is_backup, "position") WHERE (is_backup = true);


--
-- Name: idx_giveaway_winners_participant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_giveaway_winners_participant ON public.giveaway_winners USING btree (participant_id);


--
-- Name: idx_giveaway_winners_position; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_giveaway_winners_position ON public.giveaway_winners USING btree ("position");


--
-- Name: idx_giveaway_winners_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_giveaway_winners_session ON public.giveaway_winners USING btree (session_id);


--
-- Name: idx_giveaway_winners_timeout; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_giveaway_winners_timeout ON public.giveaway_winners USING btree (session_id, has_responded, timeout_processed) WHERE ((NOT timeout_processed) AND (NOT has_responded));


--
-- Name: idx_global_emote_log_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_global_emote_log_created ON public.global_emote_log USING btree (created_at DESC);


--
-- Name: idx_global_emote_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_global_emote_requests_status ON public.global_emote_requests USING btree (status, created_at DESC);


--
-- Name: idx_granted_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_granted_user ON public.user_channel_permissions USING btree (granted_user_id);


--
-- Name: idx_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_is_active ON public.custom_commands USING btree (is_active);


--
-- Name: idx_linked_game_accounts_account; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linked_game_accounts_account ON public.linked_game_accounts USING btree (account_id, game);


--
-- Name: idx_linked_game_accounts_unique_external; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_linked_game_accounts_unique_external ON public.linked_game_accounts USING btree (account_id, game, provider, external_id) WHERE ((external_id)::text <> ''::text);


--
-- Name: idx_linked_game_accounts_verified_external; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_linked_game_accounts_verified_external ON public.linked_game_accounts USING btree (provider, game, external_id) WHERE ((verified_at IS NOT NULL) AND ((external_id)::text <> ''::text));


--
-- Name: idx_live_alerts_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_live_alerts_channel ON public.discord_live_alerts USING btree (channel_name) WHERE (enabled = true);


--
-- Name: idx_live_alerts_guild; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_live_alerts_guild ON public.discord_live_alerts USING btree (guild_id) WHERE (enabled = true);


--
-- Name: idx_live_overlay_configs_user_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_live_overlay_configs_user_slug ON public.live_overlay_configs USING btree (user_id, slug);


--
-- Name: idx_lol_predictions_game; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_lol_predictions_game ON public.lol_predictions USING btree (user_id, game_key);


--
-- Name: idx_lol_predictions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lol_predictions_user ON public.lol_predictions USING btree (user_id, resolved_at);


--
-- Name: idx_micro_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_micro_channel ON public.micro_game_commands USING btree (channel_name);


--
-- Name: idx_micro_game_commands_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_micro_game_commands_user_id ON public.micro_game_commands USING btree (user_id);


--
-- Name: idx_moderation_command_configs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_moderation_command_configs_user_id ON public.moderation_command_configs USING btree (user_id);


--
-- Name: idx_moderation_filters_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_moderation_filters_user_id ON public.moderation_filters USING btree (user_id);


--
-- Name: idx_moderation_log_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_moderation_log_channel ON public.moderation_logs USING btree (channel_name);


--
-- Name: idx_moderation_log_channel_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_moderation_log_channel_date ON public.moderation_logs USING btree (channel_name, created_at);


--
-- Name: idx_moderation_log_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_moderation_log_date ON public.moderation_logs USING btree (created_at);


--
-- Name: idx_moderation_logs_channel_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_moderation_logs_channel_user ON public.moderation_logs USING btree (channel_name, username);


--
-- Name: idx_moderation_logs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_moderation_logs_user_id ON public.moderation_logs USING btree (user_id);


--
-- Name: idx_moderation_panic_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_moderation_panic_active ON public.moderation_panic USING btree (active) WHERE active;


--
-- Name: idx_moderation_panic_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_moderation_panic_user_id ON public.moderation_panic USING btree (user_id);


--
-- Name: idx_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_name ON public.categories USING btree (name);


--
-- Name: idx_now_playing_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_now_playing_channel ON public.now_playing_configs USING btree (channel_name);


--
-- Name: idx_now_playing_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_now_playing_user_id ON public.now_playing_configs USING btree (user_id);


--
-- Name: idx_oauth_apps_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oauth_apps_client_id ON public.oauth_applications USING btree (client_id);


--
-- Name: idx_oauth_apps_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oauth_apps_is_active ON public.oauth_applications USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_oauth_apps_owner_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oauth_apps_owner_id ON public.oauth_applications USING btree (owner_id);


--
-- Name: idx_oauth_codes_app_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oauth_codes_app_id ON public.oauth_authorization_codes USING btree (application_id);


--
-- Name: idx_oauth_codes_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oauth_codes_code ON public.oauth_authorization_codes USING btree (code);


--
-- Name: idx_oauth_codes_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oauth_codes_expires ON public.oauth_authorization_codes USING btree (expires_at);


--
-- Name: idx_oauth_codes_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oauth_codes_user_id ON public.oauth_authorization_codes USING btree (user_id);


--
-- Name: idx_oauth_codes_valid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oauth_codes_valid ON public.oauth_authorization_codes USING btree (code, used, expires_at) WHERE (used = false);


--
-- Name: idx_oauth_refresh_access_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oauth_refresh_access_id ON public.oauth_refresh_tokens USING btree (access_token_id);


--
-- Name: idx_oauth_refresh_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oauth_refresh_expires ON public.oauth_refresh_tokens USING btree (expires_at);


--
-- Name: idx_oauth_refresh_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oauth_refresh_token ON public.oauth_refresh_tokens USING btree (token);


--
-- Name: idx_oauth_refresh_valid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oauth_refresh_valid ON public.oauth_refresh_tokens USING btree (token, revoked, expires_at) WHERE (revoked = false);


--
-- Name: idx_oauth_tokens_app_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oauth_tokens_app_id ON public.oauth_access_tokens USING btree (application_id);


--
-- Name: idx_oauth_tokens_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oauth_tokens_expires ON public.oauth_access_tokens USING btree (expires_at);


--
-- Name: idx_oauth_tokens_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oauth_tokens_token ON public.oauth_access_tokens USING btree (token);


--
-- Name: idx_oauth_tokens_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oauth_tokens_user_id ON public.oauth_access_tokens USING btree (user_id);


--
-- Name: idx_oauth_tokens_valid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oauth_tokens_valid ON public.oauth_access_tokens USING btree (token, revoked, expires_at) WHERE (revoked = false);


--
-- Name: idx_pci_card; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pci_card ON public.player_card_instances USING btree (card_id);


--
-- Name: idx_pci_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pci_owner ON public.player_card_instances USING btree (owner_account_id);


--
-- Name: idx_pci_pending_payment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pci_pending_payment ON public.player_card_instances USING btree (payment_deadline_at) WHERE ((status)::text = 'frozen_pending_payment'::text);


--
-- Name: idx_pet_configs_user; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_pet_configs_user ON public.pet_configs USING btree (user_id);


--
-- Name: idx_ppi_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ppi_owner ON public.player_pack_inventory USING btree (owner_account_id, purchased_at);


--
-- Name: idx_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_priority ON public.categories USING btree (priority);


--
-- Name: idx_raffle_participants_disqualified; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_raffle_participants_disqualified ON public.raffle_participants USING btree (is_disqualified) WHERE (is_disqualified = false);


--
-- Name: idx_raffle_participants_joined_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_raffle_participants_joined_at ON public.raffle_participants USING btree (joined_at DESC);


--
-- Name: idx_raffle_participants_raffle_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_raffle_participants_raffle_id ON public.raffle_participants USING btree (raffle_id);


--
-- Name: idx_raffle_participants_username; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_raffle_participants_username ON public.raffle_participants USING btree (username);


--
-- Name: idx_raffle_winners_participant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_raffle_winners_participant_id ON public.raffle_winners USING btree (participant_id);


--
-- Name: idx_raffle_winners_position; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_raffle_winners_position ON public.raffle_winners USING btree ("position");


--
-- Name: idx_raffle_winners_raffle_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_raffle_winners_raffle_id ON public.raffle_winners USING btree (raffle_id);


--
-- Name: idx_raffle_winners_won_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_raffle_winners_won_at ON public.raffle_winners USING btree (won_at DESC);


--
-- Name: idx_raffles_channel_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_raffles_channel_name ON public.raffles USING btree (channel_name);


--
-- Name: idx_raffles_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_raffles_created_at ON public.raffles USING btree (created_at DESC);


--
-- Name: idx_raffles_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_raffles_created_by ON public.raffles USING btree (created_by);


--
-- Name: idx_raffles_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_raffles_status ON public.raffles USING btree (status);


--
-- Name: idx_raffles_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_raffles_user_id ON public.raffles USING btree (user_id);


--
-- Name: idx_rank_card_configs_guild; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rank_card_configs_guild ON public.rank_card_configs USING btree (guild_id);


--
-- Name: idx_rank_card_level_guild; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rank_card_level_guild ON public.rank_card_level_configs USING btree (guild_id);


--
-- Name: idx_rank_card_level_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_rank_card_level_unique ON public.rank_card_level_configs USING btree (guild_id, level_min);


--
-- Name: idx_ruleta_mod_restores_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ruleta_mod_restores_pending ON public.ruleta_mod_restores USING btree (processed, expires_at) WHERE (NOT processed);


--
-- Name: idx_shoutout_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shoutout_channel ON public.shoutout_history USING btree (channel_name);


--
-- Name: idx_shoutout_configs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shoutout_configs_user_id ON public.shoutout_configs USING btree (user_id);


--
-- Name: idx_shoutout_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shoutout_date ON public.shoutout_history USING btree (executed_at);


--
-- Name: idx_shoutout_history_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shoutout_history_user_id ON public.shoutout_history USING btree (user_id);


--
-- Name: idx_shoutout_target; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shoutout_target ON public.shoutout_history USING btree (target_user);


--
-- Name: idx_song_request_configs_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_song_request_configs_channel ON public.song_request_configs USING btree (channel_name);


--
-- Name: idx_song_request_history_requested; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_song_request_history_requested ON public.song_request_history USING btree (user_id, requested_platform, requested_by_login, requested_at) WHERE (requested_at IS NOT NULL);


--
-- Name: idx_song_request_history_user_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_song_request_history_user_date ON public.song_request_history USING btree (user_id, played_at DESC);


--
-- Name: idx_song_request_listen_visitors_day; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_song_request_listen_visitors_day ON public.song_request_listen_visitors USING btree (day);


--
-- Name: idx_song_request_pending_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_song_request_pending_user ON public.song_request_pending USING btree (user_id, created_at);


--
-- Name: idx_song_request_playlist_items_added_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_song_request_playlist_items_added_by ON public.song_request_playlist_items USING btree (playlist_id, added_by_platform, added_by_login) WHERE (added_by_login IS NOT NULL);


--
-- Name: idx_song_request_playlist_items_position; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_song_request_playlist_items_position ON public.song_request_playlist_items USING btree (playlist_id, "position");


--
-- Name: idx_song_request_playlist_votes_playlist; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_song_request_playlist_votes_playlist ON public.song_request_playlist_votes USING btree (playlist_id);


--
-- Name: idx_song_request_playlists_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_song_request_playlists_user ON public.song_request_playlists USING btree (user_id);


--
-- Name: idx_song_request_queue_user_position; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_song_request_queue_user_position ON public.song_request_queue USING btree (user_id, "position");


--
-- Name: idx_sound_alert_configs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sound_alert_configs_user_id ON public.sound_alert_configs USING btree (user_id);


--
-- Name: idx_sound_alert_file_reward; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sound_alert_file_reward ON public.sound_alert_files USING btree (reward_id);


--
-- Name: idx_sound_alert_file_username; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sound_alert_file_username ON public.sound_alert_files USING btree (username);


--
-- Name: idx_sound_alert_files_is_system; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sound_alert_files_is_system ON public.sound_alert_files USING btree (is_system_file) WHERE (is_system_file = true);


--
-- Name: idx_sound_alert_files_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sound_alert_files_user_id ON public.sound_alert_files USING btree (user_id);


--
-- Name: idx_sound_alert_history_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sound_alert_history_channel ON public.sound_alert_history USING btree (channel_name);


--
-- Name: idx_sound_alert_history_channel_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sound_alert_history_channel_date ON public.sound_alert_history USING btree (channel_name, redeemed_at);


--
-- Name: idx_sound_alert_history_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sound_alert_history_date ON public.sound_alert_history USING btree (redeemed_at);


--
-- Name: idx_sound_alert_history_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sound_alert_history_user_id ON public.sound_alert_history USING btree (user_id);


--
-- Name: idx_sound_alert_reward_files_media_file; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sound_alert_reward_files_media_file ON public.sound_alert_reward_files USING btree (media_file_id);


--
-- Name: idx_supporter_payments_captured; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_supporter_payments_captured ON public.supporter_payments USING btree (captured_at);


--
-- Name: idx_supporter_payments_invoice_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_supporter_payments_invoice_status ON public.supporter_payments USING btree (invoice_status) WHERE ((invoice_status IS NOT NULL) AND ((invoice_status)::text <> 'ACCEPTED'::text));


--
-- Name: idx_supporter_payments_order; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_supporter_payments_order ON public.supporter_payments USING btree (paypal_order_id) WHERE (paypal_order_id IS NOT NULL);


--
-- Name: idx_supporter_payments_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_supporter_payments_user ON public.supporter_payments USING btree (user_id);


--
-- Name: idx_system_admins_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_admins_role ON public.system_admins USING btree (role);


--
-- Name: idx_system_admins_username; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_admins_username ON public.system_admins USING btree (username);


--
-- Name: idx_tier_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tier_expires ON public.user_subscription_tiers USING btree (tier_expires_at);


--
-- Name: idx_tier_feature_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tier_feature_key ON public.tier_features USING btree (feature_key);


--
-- Name: idx_tier_feature_tier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tier_feature_tier ON public.tier_features USING btree (tier);


--
-- Name: idx_tier_history_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tier_history_date ON public.tier_history USING btree (changed_at);


--
-- Name: idx_tier_history_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tier_history_user ON public.tier_history USING btree (user_id);


--
-- Name: idx_tier_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tier_source ON public.user_subscription_tiers USING btree (source);


--
-- Name: idx_timer_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timer_active ON public.timers USING btree (is_active);


--
-- Name: idx_timer_backup_channel_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timer_backup_channel_date ON public.timer_session_backups USING btree (channel_name, created_at DESC);


--
-- Name: idx_timer_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timer_channel ON public.timers USING btree (channel_name);


--
-- Name: idx_timer_channel_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timer_channel_active ON public.timers USING btree (channel_name, is_active);


--
-- Name: idx_timer_config_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timer_config_channel ON public.timer_configs USING btree (channel_name);


--
-- Name: idx_timer_config_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timer_config_user ON public.timer_configs USING btree (user_id);


--
-- Name: idx_timer_configs_backup_tiers_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timer_configs_backup_tiers_user_id ON public.timer_configs_backup_tiers USING btree (user_id);


--
-- Name: idx_timer_event_log_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timer_event_log_channel ON public.timer_event_logs USING btree (channel_name);


--
-- Name: idx_timer_event_log_channel_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timer_event_log_channel_date ON public.timer_event_logs USING btree (channel_name, occurred_at);


--
-- Name: idx_timer_event_log_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timer_event_log_date ON public.timer_event_logs USING btree (occurred_at);


--
-- Name: idx_timer_event_log_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timer_event_log_session ON public.timer_event_logs USING btree (timer_session_id);


--
-- Name: idx_timer_event_log_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timer_event_log_type ON public.timer_event_logs USING btree (event_type);


--
-- Name: idx_timer_happyhour_enabled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timer_happyhour_enabled ON public.timer_happyhour USING btree (user_id, enabled);


--
-- Name: idx_timer_happyhour_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timer_happyhour_user_id ON public.timer_happyhour USING btree (user_id);


--
-- Name: idx_timer_manual_happyhour_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timer_manual_happyhour_expires ON public.timer_manual_happyhour USING btree (expires_at);


--
-- Name: idx_timer_media_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timer_media_channel ON public.timer_media_files USING btree (channel_name);


--
-- Name: idx_timer_media_channel_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timer_media_channel_type ON public.timer_media_files USING btree (channel_name, file_type);


--
-- Name: idx_timer_media_files_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timer_media_files_user_id ON public.timer_media_files USING btree (user_id);


--
-- Name: idx_timer_media_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timer_media_type ON public.timer_media_files USING btree (file_type);


--
-- Name: idx_timer_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timer_priority ON public.timers USING btree (priority);


--
-- Name: idx_timer_schedules_enabled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timer_schedules_enabled ON public.timer_schedules USING btree (enabled);


--
-- Name: idx_timer_schedules_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timer_schedules_time ON public.timer_schedules USING btree (start_time, end_time);


--
-- Name: idx_timer_schedules_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timer_schedules_user_id ON public.timer_schedules USING btree (user_id);


--
-- Name: idx_timer_session_backups_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timer_session_backups_user_id ON public.timer_session_backups USING btree (user_id);


--
-- Name: idx_timer_session_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timer_session_channel ON public.timer_sessions USING btree (channel_name);


--
-- Name: idx_timer_session_channel_start; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timer_session_channel_start ON public.timer_sessions USING btree (channel_name, started_at);


--
-- Name: idx_timer_session_start; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timer_session_start ON public.timer_sessions USING btree (started_at);


--
-- Name: idx_timer_sessions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timer_sessions_user_id ON public.timer_sessions USING btree (user_id);


--
-- Name: idx_timer_state_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timer_state_channel ON public.timer_states USING btree (channel_name);


--
-- Name: idx_timer_state_current_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timer_state_current_session ON public.timer_states USING btree (current_session_id);


--
-- Name: idx_timer_state_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timer_state_status ON public.timer_states USING btree (status);


--
-- Name: idx_timer_states_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timer_states_user_id ON public.timer_states USING btree (user_id);


--
-- Name: idx_timer_templates_updated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timer_templates_updated_at ON public.timer_templates USING btree (updated_at);


--
-- Name: idx_timer_templates_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timer_templates_user_id ON public.timer_templates USING btree (user_id);


--
-- Name: idx_timer_templates_user_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_timer_templates_user_name ON public.timer_templates USING btree (user_id, name);


--
-- Name: idx_timers_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timers_user_id ON public.timers USING btree (user_id);


--
-- Name: idx_tips_config_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_tips_config_channel ON public.tips_configs USING btree (channel_name);


--
-- Name: idx_tips_config_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tips_config_user ON public.tips_configs USING btree (user_id);


--
-- Name: idx_tips_history_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tips_history_channel ON public.tips_history USING btree (channel_name);


--
-- Name: idx_tips_history_channel_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tips_history_channel_date ON public.tips_history USING btree (channel_name, donated_at);


--
-- Name: idx_tips_history_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tips_history_date ON public.tips_history USING btree (donated_at);


--
-- Name: idx_tips_history_transaction; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tips_history_transaction ON public.tips_history USING btree (paypal_transaction_id);


--
-- Name: idx_tips_history_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tips_history_user_id ON public.tips_history USING btree (user_id);


--
-- Name: idx_title_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_title_channel ON public.title_history USING btree (channel_login);


--
-- Name: idx_title_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_title_date ON public.title_history USING btree (changed_at);


--
-- Name: idx_title_history_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_title_history_user_id ON public.title_history USING btree (user_id);


--
-- Name: idx_tournament_divisions_edition; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tournament_divisions_edition ON public.tournament_divisions USING btree (tournament_edition_id);


--
-- Name: idx_tournament_editions_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tournament_editions_channel ON public.tournament_editions USING btree (channel_owner_id);


--
-- Name: idx_tournament_editions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tournament_editions_status ON public.tournament_editions USING btree (channel_owner_id, status);


--
-- Name: idx_tournament_fortnite_files_edition; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tournament_fortnite_files_edition ON public.tournament_fortnite_files USING btree (tournament_edition_id);


--
-- Name: idx_tournament_fortnite_group_teams_team; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tournament_fortnite_group_teams_team ON public.tournament_fortnite_group_teams USING btree (team_id);


--
-- Name: idx_tournament_fortnite_groups_edition; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tournament_fortnite_groups_edition ON public.tournament_fortnite_groups USING btree (tournament_edition_id, sort_order);


--
-- Name: idx_tournament_fortnite_reports_team; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tournament_fortnite_reports_team ON public.tournament_fortnite_reports USING btree (game_id, team_id);


--
-- Name: idx_tournament_fortnite_result_audit_edition; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tournament_fortnite_result_audit_edition ON public.tournament_fortnite_result_audit USING btree (tournament_edition_id, created_at);


--
-- Name: idx_tournament_fortnite_sessions_edition; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tournament_fortnite_sessions_edition ON public.tournament_fortnite_sessions USING btree (tournament_edition_id, sort_order);


--
-- Name: idx_tournament_lp_snapshots_participant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tournament_lp_snapshots_participant ON public.tournament_lp_snapshots USING btree (tournament_participant_id, occurred_at);


--
-- Name: idx_tournament_matches_edition; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tournament_matches_edition ON public.tournament_matches USING btree (tournament_edition_id, round_number);


--
-- Name: idx_tournament_participants_discord; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tournament_participants_discord ON public.tournament_participants USING btree (discord_user_id);


--
-- Name: idx_tournament_participants_edition; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tournament_participants_edition ON public.tournament_participants USING btree (tournament_edition_id);


--
-- Name: idx_tournament_participants_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tournament_participants_status ON public.tournament_participants USING btree (tournament_edition_id, status);


--
-- Name: idx_tournament_prize_tiers_edition; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tournament_prize_tiers_edition ON public.tournament_prize_tiers USING btree (tournament_edition_id, sort_order);


--
-- Name: idx_tournament_punishment_types_edition; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tournament_punishment_types_edition ON public.tournament_punishment_types USING btree (tournament_edition_id);


--
-- Name: idx_tournament_shell_events_edition; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tournament_shell_events_edition ON public.tournament_shell_events USING btree (tournament_edition_id, created_at DESC);


--
-- Name: idx_tournament_shell_events_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tournament_shell_events_source ON public.tournament_shell_events USING btree (source_participant_id);


--
-- Name: idx_tournament_shell_events_target; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tournament_shell_events_target ON public.tournament_shell_events USING btree (target_participant_id);


--
-- Name: idx_tournament_shell_triggers_edition; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tournament_shell_triggers_edition ON public.tournament_shell_triggers USING btree (tournament_edition_id, is_active);


--
-- Name: idx_tournament_sponsors_edition; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tournament_sponsors_edition ON public.tournament_sponsors USING btree (tournament_edition_id, status);


--
-- Name: idx_tournament_teams_edition; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tournament_teams_edition ON public.tournament_teams USING btree (tournament_edition_id);


--
-- Name: idx_tournament_win_conditions_edition; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tournament_win_conditions_edition ON public.tournament_win_conditions USING btree (tournament_edition_id, is_active);


--
-- Name: idx_tts_credit_balances_user; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_tts_credit_balances_user ON public.tts_credit_balances USING btree (user_id);


--
-- Name: idx_tts_credit_ledger_external; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_tts_credit_ledger_external ON public.tts_credit_ledger USING btree (gateway, external_id) WHERE (external_id IS NOT NULL);


--
-- Name: idx_tts_credit_ledger_feature; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tts_credit_ledger_feature ON public.tts_credit_ledger USING btree (feature, created_at DESC);


--
-- Name: idx_tts_credit_ledger_user_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tts_credit_ledger_user_date ON public.tts_credit_ledger USING btree (user_id, created_at DESC);


--
-- Name: idx_tts_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tts_hash ON public.tts_cache_entries USING btree (hash);


--
-- Name: idx_tts_last_used; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tts_last_used ON public.tts_cache_entries USING btree (last_used_at);


--
-- Name: idx_tts_voice; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tts_voice ON public.tts_cache_entries USING btree (voice_id, engine);


--
-- Name: idx_ual_card; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ual_card ON public.upgrade_attempt_log USING btree (card_id);


--
-- Name: idx_ual_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ual_owner ON public.upgrade_attempt_log USING btree (owner_account_id);


--
-- Name: idx_user_achievements_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_achievements_user ON public.user_achievements USING btree (guild_id, user_id);


--
-- Name: idx_user_coins_economy_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_coins_economy_status ON public.user_coins USING btree (economy_status);


--
-- Name: idx_user_coins_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_user_coins_user_id ON public.user_coins USING btree (user_id);


--
-- Name: idx_user_fortnite_sprites_sprite_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_fortnite_sprites_sprite_id ON public.user_fortnite_sprites USING btree (sprite_id);


--
-- Name: idx_user_fortnite_sprites_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_fortnite_sprites_user_id ON public.user_fortnite_sprites USING btree (user_id);


--
-- Name: idx_user_riot_accounts_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_riot_accounts_account_id ON public.user_riot_accounts USING btree (account_id);


--
-- Name: idx_user_riot_accounts_puuid_verified; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_user_riot_accounts_puuid_verified ON public.user_riot_accounts USING btree (puuid) WHERE (verified_at IS NOT NULL);


--
-- Name: idx_user_strike_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_strike_channel ON public.user_strikes USING btree (channel_name);


--
-- Name: idx_user_strikes_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_strikes_user_id ON public.user_strikes USING btree (user_id);


--
-- Name: idx_user_tier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_tier ON public.user_subscription_tiers USING btree (tier);


--
-- Name: idx_user_xp_leaderboard; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_xp_leaderboard ON public.user_xp USING btree (guild_id, level DESC, xp DESC);


--
-- Name: idx_user_xp_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_xp_user_id ON public.user_xp USING btree (user_id);


--
-- Name: idx_username_history_changed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_username_history_changed_at ON public.username_history USING btree (changed_at DESC);


--
-- Name: idx_username_history_old_login; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_username_history_old_login ON public.username_history USING btree (old_login);


--
-- Name: idx_username_history_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_username_history_user_id ON public.username_history USING btree (user_id);


--
-- Name: idx_users_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_account_id ON public.users USING btree (account_id);


--
-- Name: idx_users_auth_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_auth_provider ON public.users USING btree (auth_provider);


--
-- Name: idx_users_discord_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_users_discord_id ON public.users USING btree (discord_id) WHERE (discord_id IS NOT NULL);


--
-- Name: idx_users_kick_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_users_kick_id ON public.users USING btree (kick_id) WHERE (kick_id IS NOT NULL);


--
-- Name: idx_users_preferred_language; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_preferred_language ON public.users USING btree (preferred_language);


--
-- Name: idx_users_referral_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_users_referral_code ON public.users USING btree (referral_code) WHERE (referral_code IS NOT NULL);


--
-- Name: idx_watch_times_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_watch_times_active ON public.stream_watch_times USING btree (channel_id, is_active);


--
-- Name: idx_watch_times_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_watch_times_channel ON public.stream_watch_times USING btree (channel_id);


--
-- Name: idx_watch_times_stream; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_watch_times_stream ON public.stream_watch_times USING btree (stream_id);


--
-- Name: idx_watch_times_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_watch_times_user ON public.stream_watch_times USING btree (user_id);


--
-- Name: idx_wheel_deliveries_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wheel_deliveries_pending ON public.wheel_pending_deliveries USING btree (wheel_id) WHERE ((status)::text = 'pending'::text);


--
-- Name: idx_wheel_deliveries_wheel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wheel_deliveries_wheel ON public.wheel_pending_deliveries USING btree (wheel_id, status);


--
-- Name: idx_wheel_raffle_entries_pool; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wheel_raffle_entries_pool ON public.wheel_raffle_entries USING btree (wheel_id) WHERE (has_won = false);


--
-- Name: idx_wheel_raffle_entries_wheel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wheel_raffle_entries_wheel ON public.wheel_raffle_entries USING btree (wheel_id);


--
-- Name: idx_wheel_segments_wheel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wheel_segments_wheel ON public.wheel_segments USING btree (wheel_id);


--
-- Name: idx_wheel_segments_wheel_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wheel_segments_wheel_order ON public.wheel_segments USING btree (wheel_id, display_order);


--
-- Name: idx_wheel_spins_recent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wheel_spins_recent ON public.wheel_spins USING btree (wheel_id, created_at DESC);


--
-- Name: idx_wheel_spins_spinner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wheel_spins_spinner ON public.wheel_spins USING btree (spinner_login);


--
-- Name: idx_wheel_spins_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wheel_spins_status ON public.wheel_spins USING btree (delivery_status) WHERE ((delivery_status)::text <> 'delivered'::text);


--
-- Name: idx_wheel_spins_wheel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wheel_spins_wheel ON public.wheel_spins USING btree (wheel_id, created_at DESC);


--
-- Name: idx_wheel_wallet_sources_wheel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wheel_wallet_sources_wheel ON public.wheel_wallet_sources USING btree (wheel_id);


--
-- Name: idx_wheel_wallets_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wheel_wallets_channel ON public.wheel_wallets USING btree (channel_id);


--
-- Name: idx_wheel_wallets_viewer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wheel_wallets_viewer ON public.wheel_wallets USING btree (viewer_user_id);


--
-- Name: idx_wheels_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wheels_channel ON public.wheels USING btree (channel_id);


--
-- Name: idx_xp_achievements_guild; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_xp_achievements_guild ON public.xp_achievements USING btree (guild_id, achievement_key);


--
-- Name: idx_xp_boosts_guild_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_xp_boosts_guild_active ON public.xp_boosts USING btree (guild_id, is_active, expires_at);


--
-- Name: idx_xp_roles_guild_level; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_xp_roles_guild_level ON public.xp_roles USING btree (guild_id, level_required);


--
-- Name: idx_xp_seasonal_leaderboard; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_xp_seasonal_leaderboard ON public.xp_seasonal USING btree (guild_id, year_month, xp_gained DESC);


--
-- Name: idx_xp_store_items_guild; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_xp_store_items_guild ON public.xp_store_items USING btree (guild_id, enabled);


--
-- Name: idx_xp_store_purchases_guild; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_xp_store_purchases_guild ON public.xp_store_purchases USING btree (guild_id, user_id);


--
-- Name: idx_xp_transactions_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_xp_transactions_created ON public.xp_transactions USING btree (created_at DESC);


--
-- Name: idx_xp_transactions_user_guild; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_xp_transactions_user_guild ON public.xp_transactions USING btree (guild_id, user_id, created_at DESC);


--
-- Name: ix_admin_mod_actions_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_admin_mod_actions_created ON public.admin_mod_actions USING btree (created_at DESC);


--
-- Name: ix_credit_purchases_invoice; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_credit_purchases_invoice ON public.credit_purchases USING btree (invoice_status) WHERE (invoice_status = 'PENDING'::text);


--
-- Name: ix_credit_purchases_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_credit_purchases_user ON public.credit_purchases USING btree (user_id, created_at DESC);


--
-- Name: ix_desktop_devices_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_desktop_devices_user ON public.desktop_devices USING btree (user_id);


--
-- Name: ix_fixed_costs_range; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_fixed_costs_range ON public.fixed_costs USING btree (starts_on, ends_on);


--
-- Name: ix_live_translation_sessions_user_started; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_live_translation_sessions_user_started ON public.live_translation_sessions USING btree (user_id, started_at DESC);


--
-- Name: uq_channel_emotes_live_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_channel_emotes_live_name ON public.channel_emotes USING btree (user_id, lower((name)::text)) WHERE ((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'hidden'::character varying])::text[]));


--
-- Name: uq_cmd_counters_userid_cmd; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_cmd_counters_userid_cmd ON public.command_counters USING btree (user_id, command_name);


--
-- Name: uq_cmd_uses_userid_cmd; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_cmd_uses_userid_cmd ON public.command_uses USING btree (user_id, command_name);


--
-- Name: uq_custom_commands_userid_cmd; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_custom_commands_userid_cmd ON public.custom_commands USING btree (user_id, command_name);


--
-- Name: uq_decatron_ai_config_userid; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_decatron_ai_config_userid ON public.decatron_ai_channel_config USING btree (user_id);


--
-- Name: uq_decatron_ai_permissions_userid; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_decatron_ai_permissions_userid ON public.decatron_ai_channel_permissions USING btree (user_id);


--
-- Name: uq_gacha_achievement_userid_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_gacha_achievement_userid_code ON public.gacha_achievements USING btree (user_id, code) WHERE (user_id IS NOT NULL);


--
-- Name: uq_gacha_cmd_alias_userid; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_gacha_cmd_alias_userid ON public.gacha_command_aliases USING btree (user_id, alias);


--
-- Name: uq_gacha_cmd_config_userid; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_gacha_cmd_config_userid ON public.gacha_command_configs USING btree (user_id, command);


--
-- Name: uq_gacha_integration_userid; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_gacha_integration_userid ON public.gacha_integration_configs USING btree (user_id);


--
-- Name: uq_gacha_overlay_userid; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_gacha_overlay_userid ON public.gacha_overlay_configs USING btree (user_id);


--
-- Name: uq_gacha_participant_userid_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_gacha_participant_userid_name ON public.gacha_participants USING btree (user_id, name);


--
-- Name: uq_gacha_preference_userid_item_part; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_gacha_preference_userid_item_part ON public.gacha_preferences USING btree (user_id, item_id, participant_id);


--
-- Name: uq_gacha_rarity_userid; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_gacha_rarity_userid ON public.gacha_rarity_configs USING btree (user_id, rarity);


--
-- Name: uq_gacha_restriction_userid_item; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_gacha_restriction_userid_item ON public.gacha_item_restrictions USING btree (user_id, item_id);


--
-- Name: uq_gacha_sound_userid; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_gacha_sound_userid ON public.gacha_sound_configs USING btree (user_id);


--
-- Name: uq_global_emote_requests_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_global_emote_requests_pending ON public.global_emote_requests USING btree (login) WHERE ((status)::text = 'pending'::text);


--
-- Name: uq_global_emotes_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_global_emotes_name ON public.global_emotes USING btree (lower((name)::text)) WHERE ((status)::text <> 'removed'::text);


--
-- Name: uq_micro_game_userid_cmd; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_micro_game_userid_cmd ON public.micro_game_commands USING btree (user_id, short_command);


--
-- Name: uq_public_command_overrides_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_public_command_overrides_key ON public.public_command_overrides USING btree (user_id, category, command_key);


--
-- Name: uq_ruleta_command_configs_userid; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_ruleta_command_configs_userid ON public.ruleta_command_configs USING btree (user_id);


--
-- Name: uq_shoutout_configs_userid; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_shoutout_configs_userid ON public.shoutout_configs USING btree (user_id);


--
-- Name: uq_song_request_playlists_fallback; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_song_request_playlists_fallback ON public.song_request_playlists USING btree (user_id) WHERE is_fallback;


--
-- Name: uq_sound_alert_configs_userid; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_sound_alert_configs_userid ON public.sound_alert_configs USING btree (user_id);


--
-- Name: uq_sound_alert_file_userid_reward; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_sound_alert_file_userid_reward ON public.sound_alert_files USING btree (user_id, reward_id);


--
-- Name: uq_speak_chat_configs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_speak_chat_configs_user_id ON public.speak_chat_configs USING btree (user_id);


--
-- Name: uq_timer_states_userid; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_timer_states_userid ON public.timer_states USING btree (user_id);


--
-- Name: uq_tournament_participants_edition_account; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_tournament_participants_edition_account ON public.tournament_participants USING btree (tournament_edition_id, account_id) WHERE (account_id IS NOT NULL);


--
-- Name: uq_tournament_participants_edition_game_account; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_tournament_participants_edition_game_account ON public.tournament_participants USING btree (tournament_edition_id, lower((game_account_name)::text)) WHERE (game_account_name IS NOT NULL);


--
-- Name: uq_tournament_teams_join_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_tournament_teams_join_code ON public.tournament_teams USING btree (join_code) WHERE (join_code IS NOT NULL);


--
-- Name: uq_user_strike_userid_username; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_user_strike_userid_username ON public.user_strikes USING btree (user_id, username);


--
-- Name: uq_watchtime_command_configs_userid; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_watchtime_command_configs_userid ON public.watchtime_command_configs USING btree (user_id);


--
-- Name: uq_wheel_wallet_sources; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_wheel_wallet_sources ON public.wheel_wallet_sources USING btree (wheel_id, source, COALESCE(channel_points_reward_id, ''::character varying));


--
-- Name: ux_design_versions_draft; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_design_versions_draft ON public.design_versions USING btree (status) WHERE ((status)::text = 'draft'::text);


--
-- Name: ux_design_versions_published; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_design_versions_published ON public.design_versions USING btree (status) WHERE ((status)::text = 'published'::text);


--
-- Name: ux_song_request_playlists_share_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_song_request_playlists_share_code ON public.song_request_playlists USING btree (share_code);


--
-- Name: timer_configs trg_timer_config_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_timer_config_updated_at BEFORE UPDATE ON public.timer_configs FOR EACH ROW EXECUTE FUNCTION public.update_timer_config_updated_at();


--
-- Name: timer_states trg_timer_state_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_timer_state_updated_at BEFORE UPDATE ON public.timer_states FOR EACH ROW EXECUTE FUNCTION public.update_timer_config_updated_at();


--
-- Name: command_settings FK_command_settings_users_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.command_settings
    ADD CONSTRAINT "FK_command_settings_users_user_id" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: game_aliases FK_game_aliases_game_cache_game_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_aliases
    ADD CONSTRAINT "FK_game_aliases_game_cache_game_id" FOREIGN KEY (game_id) REFERENCES public.game_cache(game_id) ON DELETE CASCADE;


--
-- Name: admin_mod_actions admin_mod_actions_admin_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_mod_actions
    ADD CONSTRAINT admin_mod_actions_admin_user_id_fkey FOREIGN KEY (admin_user_id) REFERENCES public.users(id);


--
-- Name: admin_mod_actions admin_mod_actions_channel_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_mod_actions
    ADD CONSTRAINT admin_mod_actions_channel_user_id_fkey FOREIGN KEY (channel_user_id) REFERENCES public.users(id);


--
-- Name: billing_profiles billing_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_profiles
    ADD CONSTRAINT billing_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: card_level_art card_level_art_card_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.card_level_art
    ADD CONSTRAINT card_level_art_card_id_fkey FOREIGN KEY (card_id) REFERENCES public.cards(id);


--
-- Name: channel_bot_entries channel_bot_entries_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_bot_entries
    ADD CONSTRAINT channel_bot_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: channel_emote_reports channel_emote_reports_emote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_emote_reports
    ADD CONSTRAINT channel_emote_reports_emote_id_fkey FOREIGN KEY (emote_id) REFERENCES public.channel_emotes(id) ON DELETE CASCADE;


--
-- Name: channel_emote_reports channel_emote_reports_reporter_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_emote_reports
    ADD CONSTRAINT channel_emote_reports_reporter_user_id_fkey FOREIGN KEY (reporter_user_id) REFERENCES public.users(id);


--
-- Name: channel_emote_settings channel_emote_settings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_emote_settings
    ADD CONSTRAINT channel_emote_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: channel_emote_uploaders channel_emote_uploaders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_emote_uploaders
    ADD CONSTRAINT channel_emote_uploaders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: channel_emotes channel_emotes_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_emotes
    ADD CONSTRAINT channel_emotes_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- Name: channel_emotes channel_emotes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_emotes
    ADD CONSTRAINT channel_emotes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: chat_overlay_configs chat_overlay_configs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_overlay_configs
    ADD CONSTRAINT chat_overlay_configs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: coin_discount_codes coin_discount_codes_applicable_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coin_discount_codes
    ADD CONSTRAINT coin_discount_codes_applicable_package_id_fkey FOREIGN KEY (applicable_package_id) REFERENCES public.coin_packages(id);


--
-- Name: coin_discount_codes coin_discount_codes_assigned_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coin_discount_codes
    ADD CONSTRAINT coin_discount_codes_assigned_user_id_fkey FOREIGN KEY (assigned_user_id) REFERENCES public.users(id);


--
-- Name: coin_discount_codes coin_discount_codes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coin_discount_codes
    ADD CONSTRAINT coin_discount_codes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: coin_discount_uses coin_discount_uses_code_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coin_discount_uses
    ADD CONSTRAINT coin_discount_uses_code_id_fkey FOREIGN KEY (code_id) REFERENCES public.coin_discount_codes(id);


--
-- Name: coin_discount_uses coin_discount_uses_purchase_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coin_discount_uses
    ADD CONSTRAINT coin_discount_uses_purchase_id_fkey FOREIGN KEY (purchase_id) REFERENCES public.coin_purchases(id);


--
-- Name: coin_discount_uses coin_discount_uses_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coin_discount_uses
    ADD CONSTRAINT coin_discount_uses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: coin_flags coin_flags_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coin_flags
    ADD CONSTRAINT coin_flags_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.users(id);


--
-- Name: coin_flags coin_flags_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coin_flags
    ADD CONSTRAINT coin_flags_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: coin_pending_orders coin_pending_orders_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coin_pending_orders
    ADD CONSTRAINT coin_pending_orders_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.coin_packages(id);


--
-- Name: coin_pending_orders coin_pending_orders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coin_pending_orders
    ADD CONSTRAINT coin_pending_orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: coin_purchases coin_purchases_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coin_purchases
    ADD CONSTRAINT coin_purchases_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.coin_packages(id);


--
-- Name: coin_purchases coin_purchases_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coin_purchases
    ADD CONSTRAINT coin_purchases_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: coin_referrals coin_referrals_referred_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coin_referrals
    ADD CONSTRAINT coin_referrals_referred_user_id_fkey FOREIGN KEY (referred_user_id) REFERENCES public.users(id);


--
-- Name: coin_referrals coin_referrals_referrer_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coin_referrals
    ADD CONSTRAINT coin_referrals_referrer_user_id_fkey FOREIGN KEY (referrer_user_id) REFERENCES public.users(id);


--
-- Name: coin_transactions coin_transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coin_transactions
    ADD CONSTRAINT coin_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: coin_transfers coin_transfers_from_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coin_transfers
    ADD CONSTRAINT coin_transfers_from_user_id_fkey FOREIGN KEY (from_user_id) REFERENCES public.users(id);


--
-- Name: coin_transfers coin_transfers_to_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coin_transfers
    ADD CONSTRAINT coin_transfers_to_user_id_fkey FOREIGN KEY (to_user_id) REFERENCES public.users(id);


--
-- Name: credit_purchases credit_purchases_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_purchases
    ADD CONSTRAINT credit_purchases_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.credit_packages(id);


--
-- Name: decatron_chat_conversations decatron_chat_conversations_channel_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.decatron_chat_conversations
    ADD CONSTRAINT decatron_chat_conversations_channel_owner_id_fkey FOREIGN KEY (channel_owner_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: decatron_chat_conversations decatron_chat_conversations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.decatron_chat_conversations
    ADD CONSTRAINT decatron_chat_conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: decatron_chat_messages decatron_chat_messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.decatron_chat_messages
    ADD CONSTRAINT decatron_chat_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.decatron_chat_conversations(id) ON DELETE CASCADE;


--
-- Name: decatron_chat_messages decatron_chat_messages_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.decatron_chat_messages
    ADD CONSTRAINT decatron_chat_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: decatron_chat_permissions decatron_chat_permissions_channel_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.decatron_chat_permissions
    ADD CONSTRAINT decatron_chat_permissions_channel_owner_id_fkey FOREIGN KEY (channel_owner_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: decatron_chat_permissions decatron_chat_permissions_granted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.decatron_chat_permissions
    ADD CONSTRAINT decatron_chat_permissions_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: decatron_chat_permissions decatron_chat_permissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.decatron_chat_permissions
    ADD CONSTRAINT decatron_chat_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: discord_alert_messages discord_alert_messages_alert_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discord_alert_messages
    ADD CONSTRAINT discord_alert_messages_alert_id_fkey FOREIGN KEY (alert_id) REFERENCES public.discord_live_alerts(id) ON DELETE CASCADE;


--
-- Name: discord_live_alerts discord_live_alerts_guild_config_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discord_live_alerts
    ADD CONSTRAINT discord_live_alerts_guild_config_id_fkey FOREIGN KEY (guild_config_id) REFERENCES public.discord_guild_configs(id) ON DELETE CASCADE;


--
-- Name: discord_welcome_configs discord_welcome_configs_guild_config_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discord_welcome_configs
    ADD CONSTRAINT discord_welcome_configs_guild_config_id_fkey FOREIGN KEY (guild_config_id) REFERENCES public.discord_guild_configs(id) ON DELETE CASCADE;


--
-- Name: email_campaigns email_campaigns_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_campaigns
    ADD CONSTRAINT email_campaigns_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.email_templates(id) ON DELETE RESTRICT;


--
-- Name: email_logs email_logs_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_logs
    ADD CONSTRAINT email_logs_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.email_campaigns(id) ON DELETE CASCADE;


--
-- Name: event_alerts_configs event_alerts_configs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_alerts_configs
    ADD CONSTRAINT event_alerts_configs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: command_counters fk_command_counters_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.command_counters
    ADD CONSTRAINT fk_command_counters_user_id FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: command_uses fk_command_uses_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.command_uses
    ADD CONSTRAINT fk_command_uses_user_id FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: custom_commands fk_custom_commands_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_commands
    ADD CONSTRAINT fk_custom_commands_user_id FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: decatron_ai_channel_config fk_decatron_ai_channel_config_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.decatron_ai_channel_config
    ADD CONSTRAINT fk_decatron_ai_channel_config_user_id FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: decatron_ai_channel_permissions fk_decatron_ai_channel_permissions_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.decatron_ai_channel_permissions
    ADD CONSTRAINT fk_decatron_ai_channel_permissions_user_id FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: decatron_ai_usage fk_decatron_ai_usage_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.decatron_ai_usage
    ADD CONSTRAINT fk_decatron_ai_usage_user_id FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: follow_alert_history fk_follow_alert_history_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follow_alert_history
    ADD CONSTRAINT fk_follow_alert_history_user_id FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: follow_alert_configs fk_follow_alert_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follow_alert_configs
    ADD CONSTRAINT fk_follow_alert_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: gacha_achievements fk_gacha_achievements_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_achievements
    ADD CONSTRAINT fk_gacha_achievements_user_id FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: gacha_banners fk_gacha_banners_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_banners
    ADD CONSTRAINT fk_gacha_banners_user_id FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: gacha_command_aliases fk_gacha_command_aliases_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_command_aliases
    ADD CONSTRAINT fk_gacha_command_aliases_user_id FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: gacha_command_configs fk_gacha_command_configs_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_command_configs
    ADD CONSTRAINT fk_gacha_command_configs_user_id FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: gacha_integration_configs fk_gacha_integration_configs_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_integration_configs
    ADD CONSTRAINT fk_gacha_integration_configs_user_id FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: gacha_inventory fk_gacha_inventory_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_inventory
    ADD CONSTRAINT fk_gacha_inventory_user_id FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: gacha_item_restrictions fk_gacha_item_restrictions_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_item_restrictions
    ADD CONSTRAINT fk_gacha_item_restrictions_user_id FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: gacha_items fk_gacha_items_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_items
    ADD CONSTRAINT fk_gacha_items_user_id FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: gacha_overlay_configs fk_gacha_overlay_configs_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_overlay_configs
    ADD CONSTRAINT fk_gacha_overlay_configs_user_id FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: gacha_participants fk_gacha_participants_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_participants
    ADD CONSTRAINT fk_gacha_participants_user_id FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: gacha_preferences fk_gacha_preferences_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_preferences
    ADD CONSTRAINT fk_gacha_preferences_user_id FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: gacha_pull_logs fk_gacha_pull_logs_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_pull_logs
    ADD CONSTRAINT fk_gacha_pull_logs_user_id FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: gacha_rarity_configs fk_gacha_rarity_configs_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_rarity_configs
    ADD CONSTRAINT fk_gacha_rarity_configs_user_id FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: gacha_rarity_restrictions fk_gacha_rarity_restrictions_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_rarity_restrictions
    ADD CONSTRAINT fk_gacha_rarity_restrictions_user_id FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: gacha_sound_configs fk_gacha_sound_configs_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_sound_configs
    ADD CONSTRAINT fk_gacha_sound_configs_user_id FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: game_history fk_game_history_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_history
    ADD CONSTRAINT fk_game_history_user_id FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: micro_game_commands fk_micro_game_commands_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.micro_game_commands
    ADD CONSTRAINT fk_micro_game_commands_user_id FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: moderation_logs fk_moderation_logs_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.moderation_logs
    ADD CONSTRAINT fk_moderation_logs_user_id FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: now_playing_configs fk_now_playing_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.now_playing_configs
    ADD CONSTRAINT fk_now_playing_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: raffle_participants fk_raffle_participants_raffle; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raffle_participants
    ADD CONSTRAINT fk_raffle_participants_raffle FOREIGN KEY (raffle_id) REFERENCES public.raffles(id) ON DELETE CASCADE;


--
-- Name: raffle_winners fk_raffle_winners_participant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raffle_winners
    ADD CONSTRAINT fk_raffle_winners_participant FOREIGN KEY (participant_id) REFERENCES public.raffle_participants(id) ON DELETE CASCADE;


--
-- Name: raffle_winners fk_raffle_winners_raffle; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raffle_winners
    ADD CONSTRAINT fk_raffle_winners_raffle FOREIGN KEY (raffle_id) REFERENCES public.raffles(id) ON DELETE CASCADE;


--
-- Name: raffles fk_raffles_created_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raffles
    ADD CONSTRAINT fk_raffles_created_by FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: raffles fk_raffles_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raffles
    ADD CONSTRAINT fk_raffles_user_id FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: shoutout_configs fk_shoutout_configs_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shoutout_configs
    ADD CONSTRAINT fk_shoutout_configs_user_id FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: shoutout_history fk_shoutout_history_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shoutout_history
    ADD CONSTRAINT fk_shoutout_history_user_id FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: sound_alert_configs fk_sound_alert_configs_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sound_alert_configs
    ADD CONSTRAINT fk_sound_alert_configs_user_id FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: sound_alert_files fk_sound_alert_files_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sound_alert_files
    ADD CONSTRAINT fk_sound_alert_files_user_id FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: sound_alert_history fk_sound_alert_history_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sound_alert_history
    ADD CONSTRAINT fk_sound_alert_history_user_id FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: timer_session_backups fk_timer_backup_channel; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timer_session_backups
    ADD CONSTRAINT fk_timer_backup_channel FOREIGN KEY (channel_name) REFERENCES public.timer_configs(channel_name) ON DELETE CASCADE;


--
-- Name: timer_configs fk_timer_config_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timer_configs
    ADD CONSTRAINT fk_timer_config_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: timer_configs_backup_tiers fk_timer_configs_backup_tiers_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timer_configs_backup_tiers
    ADD CONSTRAINT fk_timer_configs_backup_tiers_user_id FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: timers fk_timer_created_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timers
    ADD CONSTRAINT fk_timer_created_by FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: timer_event_logs fk_timer_event_logs_timer_sessions_timer_session_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timer_event_logs
    ADD CONSTRAINT fk_timer_event_logs_timer_sessions_timer_session_id FOREIGN KEY (timer_session_id) REFERENCES public.timer_sessions(id) ON DELETE CASCADE;


--
-- Name: timer_happyhour fk_timer_happyhour_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timer_happyhour
    ADD CONSTRAINT fk_timer_happyhour_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: timer_media_files fk_timer_media_files_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timer_media_files
    ADD CONSTRAINT fk_timer_media_files_user_id FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: timer_schedules fk_timer_schedules_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timer_schedules
    ADD CONSTRAINT fk_timer_schedules_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: timer_session_backups fk_timer_session_backups_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timer_session_backups
    ADD CONSTRAINT fk_timer_session_backups_user_id FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: timer_sessions fk_timer_sessions_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timer_sessions
    ADD CONSTRAINT fk_timer_sessions_user_id FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: timer_states fk_timer_states_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timer_states
    ADD CONSTRAINT fk_timer_states_user_id FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: timer_templates fk_timer_templates_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timer_templates
    ADD CONSTRAINT fk_timer_templates_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: timers fk_timers_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timers
    ADD CONSTRAINT fk_timers_user_id FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: tips_history fk_tips_history_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tips_history
    ADD CONSTRAINT fk_tips_history_user_id FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: title_history fk_title_history_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.title_history
    ADD CONSTRAINT fk_title_history_user_id FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: user_channel_permissions fk_user_channel_permissions_channel_owner; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_channel_permissions
    ADD CONSTRAINT fk_user_channel_permissions_channel_owner FOREIGN KEY (channel_owner_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_channel_permissions fk_user_channel_permissions_granted_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_channel_permissions
    ADD CONSTRAINT fk_user_channel_permissions_granted_by FOREIGN KEY (granted_by) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: user_channel_permissions fk_user_channel_permissions_granted_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_channel_permissions
    ADD CONSTRAINT fk_user_channel_permissions_granted_user FOREIGN KEY (granted_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: user_strikes fk_user_strikes_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_strikes
    ADD CONSTRAINT fk_user_strikes_user_id FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: gacha_inventory gacha_inventory_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_inventory
    ADD CONSTRAINT gacha_inventory_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.gacha_items(id) ON DELETE CASCADE;


--
-- Name: gacha_inventory gacha_inventory_participant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_inventory
    ADD CONSTRAINT gacha_inventory_participant_id_fkey FOREIGN KEY (participant_id) REFERENCES public.gacha_participants(id) ON DELETE CASCADE;


--
-- Name: gacha_item_restrictions gacha_item_restrictions_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_item_restrictions
    ADD CONSTRAINT gacha_item_restrictions_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.gacha_items(id) ON DELETE CASCADE;


--
-- Name: gacha_participants gacha_participants_forced_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_participants
    ADD CONSTRAINT gacha_participants_forced_item_id_fkey FOREIGN KEY (forced_item_id) REFERENCES public.gacha_items(id) ON DELETE SET NULL;


--
-- Name: gacha_preferences gacha_preferences_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_preferences
    ADD CONSTRAINT gacha_preferences_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.gacha_items(id) ON DELETE CASCADE;


--
-- Name: gacha_preferences gacha_preferences_participant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_preferences
    ADD CONSTRAINT gacha_preferences_participant_id_fkey FOREIGN KEY (participant_id) REFERENCES public.gacha_participants(id) ON DELETE CASCADE;


--
-- Name: gacha_pull_logs gacha_pull_logs_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_pull_logs
    ADD CONSTRAINT gacha_pull_logs_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.gacha_items(id) ON DELETE CASCADE;


--
-- Name: gacha_pull_logs gacha_pull_logs_participant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_pull_logs
    ADD CONSTRAINT gacha_pull_logs_participant_id_fkey FOREIGN KEY (participant_id) REFERENCES public.gacha_participants(id) ON DELETE CASCADE;


--
-- Name: gacha_rarity_restrictions gacha_rarity_restrictions_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_rarity_restrictions
    ADD CONSTRAINT gacha_rarity_restrictions_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.gacha_items(id) ON DELETE CASCADE;


--
-- Name: gacha_rarity_restrictions gacha_rarity_restrictions_participant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_rarity_restrictions
    ADD CONSTRAINT gacha_rarity_restrictions_participant_id_fkey FOREIGN KEY (participant_id) REFERENCES public.gacha_participants(id) ON DELETE CASCADE;


--
-- Name: gacha_showcases gacha_showcases_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_showcases
    ADD CONSTRAINT gacha_showcases_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.gacha_items(id) ON DELETE CASCADE;


--
-- Name: gacha_showcases gacha_showcases_participant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_showcases
    ADD CONSTRAINT gacha_showcases_participant_id_fkey FOREIGN KEY (participant_id) REFERENCES public.gacha_participants(id) ON DELETE CASCADE;


--
-- Name: gacha_user_achievements gacha_user_achievements_achievement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_user_achievements
    ADD CONSTRAINT gacha_user_achievements_achievement_id_fkey FOREIGN KEY (achievement_id) REFERENCES public.gacha_achievements(id) ON DELETE CASCADE;


--
-- Name: gacha_user_achievements gacha_user_achievements_participant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_user_achievements
    ADD CONSTRAINT gacha_user_achievements_participant_id_fkey FOREIGN KEY (participant_id) REFERENCES public.gacha_participants(id) ON DELETE CASCADE;


--
-- Name: gacha_viewer_settings gacha_viewer_settings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_viewer_settings
    ADD CONSTRAINT gacha_viewer_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: gacha_wishlists gacha_wishlists_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_wishlists
    ADD CONSTRAINT gacha_wishlists_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.gacha_items(id) ON DELETE CASCADE;


--
-- Name: gacha_wishlists gacha_wishlists_participant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gacha_wishlists
    ADD CONSTRAINT gacha_wishlists_participant_id_fkey FOREIGN KEY (participant_id) REFERENCES public.gacha_participants(id) ON DELETE CASCADE;


--
-- Name: game_overlay_configs game_overlay_configs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_overlay_configs
    ADD CONSTRAINT game_overlay_configs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: game_session_snapshots game_session_snapshots_linked_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_session_snapshots
    ADD CONSTRAINT game_session_snapshots_linked_account_id_fkey FOREIGN KEY (linked_account_id) REFERENCES public.linked_game_accounts(id) ON DELETE CASCADE;


--
-- Name: game_session_snapshots game_session_snapshots_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_session_snapshots
    ADD CONSTRAINT game_session_snapshots_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: giveaway_participants giveaway_participants_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.giveaway_participants
    ADD CONSTRAINT giveaway_participants_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.giveaway_sessions(id) ON DELETE CASCADE;


--
-- Name: giveaway_sessions giveaway_sessions_config_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.giveaway_sessions
    ADD CONSTRAINT giveaway_sessions_config_id_fkey FOREIGN KEY (config_id) REFERENCES public.giveaway_configs(id) ON DELETE SET NULL;


--
-- Name: giveaway_winner_cooldowns giveaway_winner_cooldowns_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.giveaway_winner_cooldowns
    ADD CONSTRAINT giveaway_winner_cooldowns_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.giveaway_sessions(id) ON DELETE SET NULL;


--
-- Name: giveaway_winners giveaway_winners_participant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.giveaway_winners
    ADD CONSTRAINT giveaway_winners_participant_id_fkey FOREIGN KEY (participant_id) REFERENCES public.giveaway_participants(id) ON DELETE CASCADE;


--
-- Name: giveaway_winners giveaway_winners_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.giveaway_winners
    ADD CONSTRAINT giveaway_winners_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.giveaway_sessions(id) ON DELETE CASCADE;


--
-- Name: global_emote_requests global_emote_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.global_emote_requests
    ADD CONSTRAINT global_emote_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: global_emotes global_emotes_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.global_emotes
    ADD CONSTRAINT global_emotes_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- Name: live_overlay_configs live_overlay_configs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_overlay_configs
    ADD CONSTRAINT live_overlay_configs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: desktop_devices live_translation_devices_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.desktop_devices
    ADD CONSTRAINT live_translation_devices_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: live_translation_sessions live_translation_sessions_device_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_translation_sessions
    ADD CONSTRAINT live_translation_sessions_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.desktop_devices(id) ON DELETE SET NULL;


--
-- Name: live_translation_sessions live_translation_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_translation_sessions
    ADD CONSTRAINT live_translation_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: live_translation_settings live_translation_settings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_translation_settings
    ADD CONSTRAINT live_translation_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: lol_coach_settings lol_coach_settings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lol_coach_settings
    ADD CONSTRAINT lol_coach_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: lol_prediction_bets lol_prediction_bets_prediction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lol_prediction_bets
    ADD CONSTRAINT lol_prediction_bets_prediction_id_fkey FOREIGN KEY (prediction_id) REFERENCES public.lol_predictions(id) ON DELETE CASCADE;


--
-- Name: lol_prediction_points lol_prediction_points_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lol_prediction_points
    ADD CONSTRAINT lol_prediction_points_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: lol_predictions lol_predictions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lol_predictions
    ADD CONSTRAINT lol_predictions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: moderation_command_configs moderation_command_configs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.moderation_command_configs
    ADD CONSTRAINT moderation_command_configs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: moderation_filters moderation_filters_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.moderation_filters
    ADD CONSTRAINT moderation_filters_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: moderation_panic moderation_panic_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.moderation_panic
    ADD CONSTRAINT moderation_panic_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: oauth_access_tokens oauth_access_tokens_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oauth_access_tokens
    ADD CONSTRAINT oauth_access_tokens_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.oauth_applications(id) ON DELETE CASCADE;


--
-- Name: oauth_access_tokens oauth_access_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oauth_access_tokens
    ADD CONSTRAINT oauth_access_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: oauth_applications oauth_applications_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oauth_applications
    ADD CONSTRAINT oauth_applications_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: oauth_authorization_codes oauth_authorization_codes_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oauth_authorization_codes
    ADD CONSTRAINT oauth_authorization_codes_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.oauth_applications(id) ON DELETE CASCADE;


--
-- Name: oauth_authorization_codes oauth_authorization_codes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oauth_authorization_codes
    ADD CONSTRAINT oauth_authorization_codes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: oauth_refresh_tokens oauth_refresh_tokens_access_token_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oauth_refresh_tokens
    ADD CONSTRAINT oauth_refresh_tokens_access_token_id_fkey FOREIGN KEY (access_token_id) REFERENCES public.oauth_access_tokens(id) ON DELETE CASCADE;


--
-- Name: pet_configs pet_configs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pet_configs
    ADD CONSTRAINT pet_configs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: pet_seen_chatters pet_seen_chatters_channel_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pet_seen_chatters
    ADD CONSTRAINT pet_seen_chatters_channel_user_id_fkey FOREIGN KEY (channel_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: player_card_instances player_card_instances_card_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_card_instances
    ADD CONSTRAINT player_card_instances_card_id_fkey FOREIGN KEY (card_id) REFERENCES public.cards(id);


--
-- Name: player_card_instances player_card_instances_owner_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_card_instances
    ADD CONSTRAINT player_card_instances_owner_account_id_fkey FOREIGN KEY (owner_account_id) REFERENCES public.users(id);


--
-- Name: player_pack_inventory player_pack_inventory_owner_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_pack_inventory
    ADD CONSTRAINT player_pack_inventory_owner_account_id_fkey FOREIGN KEY (owner_account_id) REFERENCES public.users(id);


--
-- Name: player_pack_inventory player_pack_inventory_sobre_tier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_pack_inventory
    ADD CONSTRAINT player_pack_inventory_sobre_tier_id_fkey FOREIGN KEY (sobre_tier_id) REFERENCES public.card_sobre_tiers(id);


--
-- Name: player_pity_counter player_pity_counter_owner_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_pity_counter
    ADD CONSTRAINT player_pity_counter_owner_account_id_fkey FOREIGN KEY (owner_account_id) REFERENCES public.users(id);


--
-- Name: public_command_overrides public_command_overrides_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.public_command_overrides
    ADD CONSTRAINT public_command_overrides_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: ruleta_command_configs ruleta_command_configs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ruleta_command_configs
    ADD CONSTRAINT ruleta_command_configs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: song_request_bans song_request_bans_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.song_request_bans
    ADD CONSTRAINT song_request_bans_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: song_request_configs song_request_configs_active_playlist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.song_request_configs
    ADD CONSTRAINT song_request_configs_active_playlist_id_fkey FOREIGN KEY (active_playlist_id) REFERENCES public.song_request_playlists(id) ON DELETE SET NULL;


--
-- Name: song_request_configs song_request_configs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.song_request_configs
    ADD CONSTRAINT song_request_configs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: song_request_playlist_items song_request_fallback_track_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.song_request_playlist_items
    ADD CONSTRAINT song_request_fallback_track_id_fkey FOREIGN KEY (track_id) REFERENCES public.song_request_tracks(id);


--
-- Name: song_request_playlist_items song_request_fallback_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.song_request_playlist_items
    ADD CONSTRAINT song_request_fallback_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: song_request_history song_request_history_track_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.song_request_history
    ADD CONSTRAINT song_request_history_track_id_fkey FOREIGN KEY (track_id) REFERENCES public.song_request_tracks(id);


--
-- Name: song_request_history song_request_history_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.song_request_history
    ADD CONSTRAINT song_request_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: song_request_listen_daily song_request_listen_daily_playlist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.song_request_listen_daily
    ADD CONSTRAINT song_request_listen_daily_playlist_id_fkey FOREIGN KEY (playlist_id) REFERENCES public.song_request_playlists(id) ON DELETE CASCADE;


--
-- Name: song_request_listen_tracks song_request_listen_tracks_playlist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.song_request_listen_tracks
    ADD CONSTRAINT song_request_listen_tracks_playlist_id_fkey FOREIGN KEY (playlist_id) REFERENCES public.song_request_playlists(id) ON DELETE CASCADE;


--
-- Name: song_request_listen_unplayable song_request_listen_unplayable_playlist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.song_request_listen_unplayable
    ADD CONSTRAINT song_request_listen_unplayable_playlist_id_fkey FOREIGN KEY (playlist_id) REFERENCES public.song_request_playlists(id) ON DELETE CASCADE;


--
-- Name: song_request_listen_visitors song_request_listen_visitors_playlist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.song_request_listen_visitors
    ADD CONSTRAINT song_request_listen_visitors_playlist_id_fkey FOREIGN KEY (playlist_id) REFERENCES public.song_request_playlists(id) ON DELETE CASCADE;


--
-- Name: song_request_pending song_request_pending_playlist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.song_request_pending
    ADD CONSTRAINT song_request_pending_playlist_id_fkey FOREIGN KEY (playlist_id) REFERENCES public.song_request_playlists(id) ON DELETE CASCADE;


--
-- Name: song_request_pending song_request_pending_track_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.song_request_pending
    ADD CONSTRAINT song_request_pending_track_id_fkey FOREIGN KEY (track_id) REFERENCES public.song_request_tracks(id);


--
-- Name: song_request_pending song_request_pending_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.song_request_pending
    ADD CONSTRAINT song_request_pending_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: song_request_playlist_items song_request_playlist_items_playlist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.song_request_playlist_items
    ADD CONSTRAINT song_request_playlist_items_playlist_id_fkey FOREIGN KEY (playlist_id) REFERENCES public.song_request_playlists(id) ON DELETE CASCADE;


--
-- Name: song_request_playlist_votes song_request_playlist_votes_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.song_request_playlist_votes
    ADD CONSTRAINT song_request_playlist_votes_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.song_request_playlist_items(id) ON DELETE CASCADE;


--
-- Name: song_request_playlist_votes song_request_playlist_votes_playlist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.song_request_playlist_votes
    ADD CONSTRAINT song_request_playlist_votes_playlist_id_fkey FOREIGN KEY (playlist_id) REFERENCES public.song_request_playlists(id) ON DELETE CASCADE;


--
-- Name: song_request_playlists song_request_playlists_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.song_request_playlists
    ADD CONSTRAINT song_request_playlists_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: song_request_queue song_request_queue_track_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.song_request_queue
    ADD CONSTRAINT song_request_queue_track_id_fkey FOREIGN KEY (track_id) REFERENCES public.song_request_tracks(id);


--
-- Name: song_request_queue song_request_queue_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.song_request_queue
    ADD CONSTRAINT song_request_queue_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: song_request_trusted song_request_trusted_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.song_request_trusted
    ADD CONSTRAINT song_request_trusted_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: sound_alert_reward_files sound_alert_reward_files_media_file_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sound_alert_reward_files
    ADD CONSTRAINT sound_alert_reward_files_media_file_id_fkey FOREIGN KEY (media_file_id) REFERENCES public.timer_media_files(id) ON DELETE SET NULL;


--
-- Name: sound_alert_reward_files sound_alert_reward_files_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sound_alert_reward_files
    ADD CONSTRAINT sound_alert_reward_files_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: speak_chat_configs speak_chat_configs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.speak_chat_configs
    ADD CONSTRAINT speak_chat_configs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: speak_chat_usage_backup speak_chat_usage_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.speak_chat_usage_backup
    ADD CONSTRAINT speak_chat_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: system_admins system_admins_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_admins
    ADD CONSTRAINT system_admins_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: tcg_free_pack_claims tcg_free_pack_claims_owner_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tcg_free_pack_claims
    ADD CONSTRAINT tcg_free_pack_claims_owner_account_id_fkey FOREIGN KEY (owner_account_id) REFERENCES public.users(id);


--
-- Name: tcg_free_pack_claims tcg_free_pack_claims_sobre_tier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tcg_free_pack_claims
    ADD CONSTRAINT tcg_free_pack_claims_sobre_tier_id_fkey FOREIGN KEY (sobre_tier_id) REFERENCES public.card_sobre_tiers(id);


--
-- Name: tier_history tier_history_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tier_history
    ADD CONSTRAINT tier_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id);


--
-- Name: tier_history tier_history_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tier_history
    ADD CONSTRAINT tier_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: timer_manual_happyhour timer_manual_happyhour_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timer_manual_happyhour
    ADD CONSTRAINT timer_manual_happyhour_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: tips_configs tips_configs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tips_configs
    ADD CONSTRAINT tips_configs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: tournament_blue_shell_rules tournament_blue_shell_rules_tournament_edition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_blue_shell_rules
    ADD CONSTRAINT tournament_blue_shell_rules_tournament_edition_id_fkey FOREIGN KEY (tournament_edition_id) REFERENCES public.tournament_editions(id) ON DELETE CASCADE;


--
-- Name: tournament_divisions tournament_divisions_tournament_edition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_divisions
    ADD CONSTRAINT tournament_divisions_tournament_edition_id_fkey FOREIGN KEY (tournament_edition_id) REFERENCES public.tournament_editions(id) ON DELETE CASCADE;


--
-- Name: tournament_editions tournament_editions_channel_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_editions
    ADD CONSTRAINT tournament_editions_channel_owner_id_fkey FOREIGN KEY (channel_owner_id) REFERENCES public.users(id);


--
-- Name: tournament_fortnite_configs tournament_fortnite_configs_tournament_edition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_fortnite_configs
    ADD CONSTRAINT tournament_fortnite_configs_tournament_edition_id_fkey FOREIGN KEY (tournament_edition_id) REFERENCES public.tournament_editions(id) ON DELETE CASCADE;


--
-- Name: tournament_fortnite_files tournament_fortnite_files_tournament_edition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_fortnite_files
    ADD CONSTRAINT tournament_fortnite_files_tournament_edition_id_fkey FOREIGN KEY (tournament_edition_id) REFERENCES public.tournament_editions(id) ON DELETE CASCADE;


--
-- Name: tournament_fortnite_games tournament_fortnite_games_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_fortnite_games
    ADD CONSTRAINT tournament_fortnite_games_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.tournament_fortnite_sessions(id) ON DELETE CASCADE;


--
-- Name: tournament_fortnite_group_teams tournament_fortnite_group_teams_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_fortnite_group_teams
    ADD CONSTRAINT tournament_fortnite_group_teams_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.tournament_fortnite_groups(id) ON DELETE CASCADE;


--
-- Name: tournament_fortnite_group_teams tournament_fortnite_group_teams_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_fortnite_group_teams
    ADD CONSTRAINT tournament_fortnite_group_teams_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.tournament_teams(id) ON DELETE CASCADE;


--
-- Name: tournament_fortnite_groups tournament_fortnite_groups_tournament_edition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_fortnite_groups
    ADD CONSTRAINT tournament_fortnite_groups_tournament_edition_id_fkey FOREIGN KEY (tournament_edition_id) REFERENCES public.tournament_editions(id) ON DELETE CASCADE;


--
-- Name: tournament_fortnite_reports tournament_fortnite_reports_game_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_fortnite_reports
    ADD CONSTRAINT tournament_fortnite_reports_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.tournament_fortnite_games(id) ON DELETE CASCADE;


--
-- Name: tournament_fortnite_reports tournament_fortnite_reports_participant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_fortnite_reports
    ADD CONSTRAINT tournament_fortnite_reports_participant_id_fkey FOREIGN KEY (participant_id) REFERENCES public.tournament_participants(id) ON DELETE CASCADE;


--
-- Name: tournament_fortnite_reports tournament_fortnite_reports_screenshot_file_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_fortnite_reports
    ADD CONSTRAINT tournament_fortnite_reports_screenshot_file_id_fkey FOREIGN KEY (screenshot_file_id) REFERENCES public.tournament_fortnite_files(id) ON DELETE SET NULL;


--
-- Name: tournament_fortnite_reports tournament_fortnite_reports_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_fortnite_reports
    ADD CONSTRAINT tournament_fortnite_reports_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.tournament_teams(id) ON DELETE SET NULL;


--
-- Name: tournament_fortnite_result_audit tournament_fortnite_result_audit_game_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_fortnite_result_audit
    ADD CONSTRAINT tournament_fortnite_result_audit_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.tournament_fortnite_games(id) ON DELETE CASCADE;


--
-- Name: tournament_fortnite_result_audit tournament_fortnite_result_audit_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_fortnite_result_audit
    ADD CONSTRAINT tournament_fortnite_result_audit_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.tournament_teams(id) ON DELETE CASCADE;


--
-- Name: tournament_fortnite_result_audit tournament_fortnite_result_audit_tournament_edition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_fortnite_result_audit
    ADD CONSTRAINT tournament_fortnite_result_audit_tournament_edition_id_fkey FOREIGN KEY (tournament_edition_id) REFERENCES public.tournament_editions(id) ON DELETE CASCADE;


--
-- Name: tournament_fortnite_results tournament_fortnite_results_game_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_fortnite_results
    ADD CONSTRAINT tournament_fortnite_results_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.tournament_fortnite_games(id) ON DELETE CASCADE;


--
-- Name: tournament_fortnite_results tournament_fortnite_results_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_fortnite_results
    ADD CONSTRAINT tournament_fortnite_results_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.tournament_teams(id) ON DELETE CASCADE;


--
-- Name: tournament_fortnite_session_checkins tournament_fortnite_session_checkins_participant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_fortnite_session_checkins
    ADD CONSTRAINT tournament_fortnite_session_checkins_participant_id_fkey FOREIGN KEY (participant_id) REFERENCES public.tournament_participants(id) ON DELETE CASCADE;


--
-- Name: tournament_fortnite_session_checkins tournament_fortnite_session_checkins_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_fortnite_session_checkins
    ADD CONSTRAINT tournament_fortnite_session_checkins_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.tournament_fortnite_sessions(id) ON DELETE CASCADE;


--
-- Name: tournament_fortnite_sessions tournament_fortnite_sessions_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_fortnite_sessions
    ADD CONSTRAINT tournament_fortnite_sessions_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.tournament_fortnite_groups(id) ON DELETE CASCADE;


--
-- Name: tournament_fortnite_sessions tournament_fortnite_sessions_tournament_edition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_fortnite_sessions
    ADD CONSTRAINT tournament_fortnite_sessions_tournament_edition_id_fkey FOREIGN KEY (tournament_edition_id) REFERENCES public.tournament_editions(id) ON DELETE CASCADE;


--
-- Name: tournament_games tournament_games_tournament_match_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_games
    ADD CONSTRAINT tournament_games_tournament_match_id_fkey FOREIGN KEY (tournament_match_id) REFERENCES public.tournament_matches(id) ON DELETE CASCADE;


--
-- Name: tournament_games tournament_games_winner_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_games
    ADD CONSTRAINT tournament_games_winner_team_id_fkey FOREIGN KEY (winner_team_id) REFERENCES public.tournament_teams(id);


--
-- Name: tournament_lp_snapshots tournament_lp_snapshots_tournament_participant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_lp_snapshots
    ADD CONSTRAINT tournament_lp_snapshots_tournament_participant_id_fkey FOREIGN KEY (tournament_participant_id) REFERENCES public.tournament_participants(id) ON DELETE CASCADE;


--
-- Name: tournament_matches tournament_matches_team_a_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_matches
    ADD CONSTRAINT tournament_matches_team_a_id_fkey FOREIGN KEY (team_a_id) REFERENCES public.tournament_teams(id);


--
-- Name: tournament_matches tournament_matches_team_b_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_matches
    ADD CONSTRAINT tournament_matches_team_b_id_fkey FOREIGN KEY (team_b_id) REFERENCES public.tournament_teams(id);


--
-- Name: tournament_matches tournament_matches_tournament_edition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_matches
    ADD CONSTRAINT tournament_matches_tournament_edition_id_fkey FOREIGN KEY (tournament_edition_id) REFERENCES public.tournament_editions(id) ON DELETE CASCADE;


--
-- Name: tournament_matches tournament_matches_winner_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_matches
    ADD CONSTRAINT tournament_matches_winner_team_id_fkey FOREIGN KEY (winner_team_id) REFERENCES public.tournament_teams(id);


--
-- Name: tournament_overlay_configs tournament_overlay_configs_tournament_participant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_overlay_configs
    ADD CONSTRAINT tournament_overlay_configs_tournament_participant_id_fkey FOREIGN KEY (tournament_participant_id) REFERENCES public.tournament_participants(id) ON DELETE CASCADE;


--
-- Name: tournament_participants tournament_participants_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_participants
    ADD CONSTRAINT tournament_participants_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id);


--
-- Name: tournament_participants tournament_participants_game_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_participants
    ADD CONSTRAINT tournament_participants_game_account_id_fkey FOREIGN KEY (game_account_id) REFERENCES public.linked_game_accounts(id) ON DELETE SET NULL;


--
-- Name: tournament_participants tournament_participants_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_participants
    ADD CONSTRAINT tournament_participants_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.tournament_teams(id);


--
-- Name: tournament_participants tournament_participants_tournament_division_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_participants
    ADD CONSTRAINT tournament_participants_tournament_division_id_fkey FOREIGN KEY (tournament_division_id) REFERENCES public.tournament_divisions(id);


--
-- Name: tournament_participants tournament_participants_tournament_edition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_participants
    ADD CONSTRAINT tournament_participants_tournament_edition_id_fkey FOREIGN KEY (tournament_edition_id) REFERENCES public.tournament_editions(id) ON DELETE CASCADE;


--
-- Name: tournament_prize_tiers tournament_prize_tiers_tournament_division_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_prize_tiers
    ADD CONSTRAINT tournament_prize_tiers_tournament_division_id_fkey FOREIGN KEY (tournament_division_id) REFERENCES public.tournament_divisions(id);


--
-- Name: tournament_prize_tiers tournament_prize_tiers_tournament_edition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_prize_tiers
    ADD CONSTRAINT tournament_prize_tiers_tournament_edition_id_fkey FOREIGN KEY (tournament_edition_id) REFERENCES public.tournament_editions(id) ON DELETE CASCADE;


--
-- Name: tournament_punishment_types tournament_punishment_types_tournament_edition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_punishment_types
    ADD CONSTRAINT tournament_punishment_types_tournament_edition_id_fkey FOREIGN KEY (tournament_edition_id) REFERENCES public.tournament_editions(id) ON DELETE CASCADE;


--
-- Name: tournament_riot_configs tournament_riot_configs_channel_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_riot_configs
    ADD CONSTRAINT tournament_riot_configs_channel_owner_id_fkey FOREIGN KEY (channel_owner_id) REFERENCES public.users(id);


--
-- Name: tournament_rule_documents tournament_rule_documents_tournament_edition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_rule_documents
    ADD CONSTRAINT tournament_rule_documents_tournament_edition_id_fkey FOREIGN KEY (tournament_edition_id) REFERENCES public.tournament_editions(id) ON DELETE CASCADE;


--
-- Name: tournament_rule_documents tournament_rule_documents_updated_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_rule_documents
    ADD CONSTRAINT tournament_rule_documents_updated_by_user_id_fkey FOREIGN KEY (updated_by_user_id) REFERENCES public.users(id);


--
-- Name: tournament_shell_events tournament_shell_events_fulfilled_by_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_shell_events
    ADD CONSTRAINT tournament_shell_events_fulfilled_by_staff_id_fkey FOREIGN KEY (fulfilled_by_staff_id) REFERENCES public.users(id);


--
-- Name: tournament_shell_events tournament_shell_events_punishment_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_shell_events
    ADD CONSTRAINT tournament_shell_events_punishment_type_id_fkey FOREIGN KEY (punishment_type_id) REFERENCES public.tournament_punishment_types(id);


--
-- Name: tournament_shell_events tournament_shell_events_source_participant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_shell_events
    ADD CONSTRAINT tournament_shell_events_source_participant_id_fkey FOREIGN KEY (source_participant_id) REFERENCES public.tournament_participants(id) ON DELETE CASCADE;


--
-- Name: tournament_shell_events tournament_shell_events_target_participant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_shell_events
    ADD CONSTRAINT tournament_shell_events_target_participant_id_fkey FOREIGN KEY (target_participant_id) REFERENCES public.tournament_participants(id) ON DELETE CASCADE;


--
-- Name: tournament_shell_events tournament_shell_events_tournament_edition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_shell_events
    ADD CONSTRAINT tournament_shell_events_tournament_edition_id_fkey FOREIGN KEY (tournament_edition_id) REFERENCES public.tournament_editions(id) ON DELETE CASCADE;


--
-- Name: tournament_shell_events tournament_shell_events_trigger_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_shell_events
    ADD CONSTRAINT tournament_shell_events_trigger_id_fkey FOREIGN KEY (trigger_id) REFERENCES public.tournament_shell_triggers(id);


--
-- Name: tournament_shell_inventories tournament_shell_inventories_tournament_participant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_shell_inventories
    ADD CONSTRAINT tournament_shell_inventories_tournament_participant_id_fkey FOREIGN KEY (tournament_participant_id) REFERENCES public.tournament_participants(id) ON DELETE CASCADE;


--
-- Name: tournament_shell_triggers tournament_shell_triggers_tournament_edition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_shell_triggers
    ADD CONSTRAINT tournament_shell_triggers_tournament_edition_id_fkey FOREIGN KEY (tournament_edition_id) REFERENCES public.tournament_editions(id) ON DELETE CASCADE;


--
-- Name: tournament_sponsors tournament_sponsors_tournament_edition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_sponsors
    ADD CONSTRAINT tournament_sponsors_tournament_edition_id_fkey FOREIGN KEY (tournament_edition_id) REFERENCES public.tournament_editions(id) ON DELETE CASCADE;


--
-- Name: tournament_teams tournament_teams_tournament_edition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_teams
    ADD CONSTRAINT tournament_teams_tournament_edition_id_fkey FOREIGN KEY (tournament_edition_id) REFERENCES public.tournament_editions(id) ON DELETE CASCADE;


--
-- Name: tournament_win_conditions tournament_win_conditions_tournament_edition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_win_conditions
    ADD CONSTRAINT tournament_win_conditions_tournament_edition_id_fkey FOREIGN KEY (tournament_edition_id) REFERENCES public.tournament_editions(id) ON DELETE CASCADE;


--
-- Name: upgrade_attempt_log upgrade_attempt_log_card_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.upgrade_attempt_log
    ADD CONSTRAINT upgrade_attempt_log_card_id_fkey FOREIGN KEY (card_id) REFERENCES public.cards(id);


--
-- Name: upgrade_attempt_log upgrade_attempt_log_instance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.upgrade_attempt_log
    ADD CONSTRAINT upgrade_attempt_log_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES public.player_card_instances(id);


--
-- Name: upgrade_attempt_log upgrade_attempt_log_owner_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.upgrade_attempt_log
    ADD CONSTRAINT upgrade_attempt_log_owner_account_id_fkey FOREIGN KEY (owner_account_id) REFERENCES public.users(id);


--
-- Name: user_achievements user_achievements_achievement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_achievements
    ADD CONSTRAINT user_achievements_achievement_id_fkey FOREIGN KEY (achievement_id) REFERENCES public.xp_achievements(id) ON DELETE CASCADE;


--
-- Name: user_coins user_coins_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_coins
    ADD CONSTRAINT user_coins_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: user_fortnite_sprites user_fortnite_sprites_sprite_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_fortnite_sprites
    ADD CONSTRAINT user_fortnite_sprites_sprite_id_fkey FOREIGN KEY (sprite_id) REFERENCES public.fortnite_sprites(id) ON DELETE CASCADE;


--
-- Name: user_fortnite_sprites user_fortnite_sprites_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_fortnite_sprites
    ADD CONSTRAINT user_fortnite_sprites_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_spirit_notification_prefs user_spirit_notification_prefs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_spirit_notification_prefs
    ADD CONSTRAINT user_spirit_notification_prefs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_subscription_tiers user_subscription_tiers_granted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_subscription_tiers
    ADD CONSTRAINT user_subscription_tiers_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES public.users(id);


--
-- Name: user_subscription_tiers user_subscription_tiers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_subscription_tiers
    ADD CONSTRAINT user_subscription_tiers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: username_history username_history_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.username_history
    ADD CONSTRAINT username_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id);


--
-- Name: watchtime_command_configs watchtime_command_configs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.watchtime_command_configs
    ADD CONSTRAINT watchtime_command_configs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: wheel_pending_deliveries wheel_pending_deliveries_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wheel_pending_deliveries
    ADD CONSTRAINT wheel_pending_deliveries_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: wheel_pending_deliveries wheel_pending_deliveries_spin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wheel_pending_deliveries
    ADD CONSTRAINT wheel_pending_deliveries_spin_id_fkey FOREIGN KEY (spin_id) REFERENCES public.wheel_spins(id) ON DELETE CASCADE;


--
-- Name: wheel_pending_deliveries wheel_pending_deliveries_viewer_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wheel_pending_deliveries
    ADD CONSTRAINT wheel_pending_deliveries_viewer_user_id_fkey FOREIGN KEY (viewer_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: wheel_pending_deliveries wheel_pending_deliveries_wheel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wheel_pending_deliveries
    ADD CONSTRAINT wheel_pending_deliveries_wheel_id_fkey FOREIGN KEY (wheel_id) REFERENCES public.wheels(id) ON DELETE CASCADE;


--
-- Name: wheel_raffle_configs wheel_raffle_configs_wheel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wheel_raffle_configs
    ADD CONSTRAINT wheel_raffle_configs_wheel_id_fkey FOREIGN KEY (wheel_id) REFERENCES public.wheels(id) ON DELETE CASCADE;


--
-- Name: wheel_raffle_entries wheel_raffle_entries_viewer_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wheel_raffle_entries
    ADD CONSTRAINT wheel_raffle_entries_viewer_user_id_fkey FOREIGN KEY (viewer_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: wheel_raffle_entries wheel_raffle_entries_wheel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wheel_raffle_entries
    ADD CONSTRAINT wheel_raffle_entries_wheel_id_fkey FOREIGN KEY (wheel_id) REFERENCES public.wheels(id) ON DELETE CASCADE;


--
-- Name: wheel_segments wheel_segments_wheel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wheel_segments
    ADD CONSTRAINT wheel_segments_wheel_id_fkey FOREIGN KEY (wheel_id) REFERENCES public.wheels(id) ON DELETE CASCADE;


--
-- Name: wheel_spins wheel_spins_result_segment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wheel_spins
    ADD CONSTRAINT wheel_spins_result_segment_id_fkey FOREIGN KEY (result_segment_id) REFERENCES public.wheel_segments(id) ON DELETE SET NULL;


--
-- Name: wheel_spins wheel_spins_spinner_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wheel_spins
    ADD CONSTRAINT wheel_spins_spinner_user_id_fkey FOREIGN KEY (spinner_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: wheel_spins wheel_spins_wheel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wheel_spins
    ADD CONSTRAINT wheel_spins_wheel_id_fkey FOREIGN KEY (wheel_id) REFERENCES public.wheels(id) ON DELETE CASCADE;


--
-- Name: wheel_wallet_sources wheel_wallet_sources_wheel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wheel_wallet_sources
    ADD CONSTRAINT wheel_wallet_sources_wheel_id_fkey FOREIGN KEY (wheel_id) REFERENCES public.wheels(id) ON DELETE CASCADE;


--
-- Name: wheel_wallets wheel_wallets_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wheel_wallets
    ADD CONSTRAINT wheel_wallets_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: wheel_wallets wheel_wallets_viewer_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wheel_wallets
    ADD CONSTRAINT wheel_wallets_viewer_user_id_fkey FOREIGN KEY (viewer_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: wheels wheels_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wheels
    ADD CONSTRAINT wheels_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: xp_store_purchases xp_store_purchases_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.xp_store_purchases
    ADD CONSTRAINT xp_store_purchases_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.xp_store_items(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--


