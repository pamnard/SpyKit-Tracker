CREATE DATABASE IF NOT EXISTS default;

CREATE TABLE IF NOT EXISTS default.events
(
    `timestamp` DateTime DEFAULT now(),
    `event_name` String,
    
    `ids` Map(String, String),     -- user_id, visitor_id, session_id
    `context` Map(String, String), -- ip, user_agent, page_url, referrer
    `device` Map(String, String),  -- platform, screen_*, language, timezone
    `geo` Map(String, String),     -- country, city, region, postal_code, latitude, longitude, continent, metro_code, timezone
    `traffic` Map(String, String), -- utm_source, utm_medium, etc
    `tech` Map(String, String),    -- performance metrics, connection info, ad_block
    `params` Map(String, String)   -- custom event parameters
)
ENGINE = MergeTree
ORDER BY (event_name, timestamp)
SETTINGS index_granularity = 8192;
