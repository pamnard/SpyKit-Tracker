CREATE DATABASE IF NOT EXISTS default;

CREATE TABLE IF NOT EXISTS default.events
(
    `timestamp` DateTime DEFAULT now(),
    `event_name` String,
    
    `ids` Map(String, String),     -- user_id, visitor_id, session_id
    `page` Map(String, String),    -- url, host, path, query
    `device` Map(String, String),  -- platform, user_agent, screen_*, language, timezone, is_bot
    `geo` Map(String, String),     -- ip_hash, country, city, region, postal_code...
    `traffic` Map(String, String), -- referrer_*, source, channel, campaign, term, content
    `tech` Map(String, String),    -- performance metrics, connection info, ad_block
    `params` Map(String, String)   -- custom event parameters
)
ENGINE = MergeTree
ORDER BY (event_name, timestamp)
SETTINGS index_granularity = 8192;
