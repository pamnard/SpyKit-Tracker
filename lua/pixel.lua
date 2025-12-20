-- Load JSON library
local cjson = require "cjson"
-- Load MaxMind library explicitly
local mmdb = require "resty.maxminddb"

-- Add CORS headers
ngx.header["Access-Control-Allow-Origin"] = "*"
ngx.header["Access-Control-Allow-Methods"] = "POST, GET, OPTIONS"
ngx.header["Access-Control-Allow-Headers"] = "Content-Type"

if ngx.req.get_method() == "OPTIONS" then
    ngx.exit(204)
end

-- Helper to get log file path
local function get_log_file_path(prefix)
    local timestamp = os.date("*t")
    local log_dir = "/var/log/spykit"
    return string.format("%s/%s_%04d-%02d-%02d_%02d.log", 
        log_dir, prefix, timestamp.year, timestamp.month, timestamp.day, timestamp.hour)
end

-- Helper to write to file
local function write_to_log(filename, data)
    -- TODO: Optimization for extreme high load (>50k RPS)
    -- Instead of opening/closing file on every request, consider keeping the file handle open.
    -- This requires handling log rotation signals (SIGHUP) manually or using 
    -- a library like lua-resty-logger-socket to buffer writes in memory.
    local file, err = io.open(filename, "a")
    if file then
        file:write(data .. "\n")
        file:close()
    else
        ngx.log(ngx.ERR, "Failed to open log file: ", err)
    end
end

-- Helper to safely get GeoIP data
local function get_geoip_data(ip)
    local result = {
        country = "Unknown",
        country_name = "Unknown",
        region = "Unknown",
        city = "Unknown",
        postal_code = "Unknown",
        latitude = 0,
        longitude = 0
    }
    
    -- Initialize MMDB if not already initted
    if not mmdb.initted() then
        local ok, err = mmdb.init("/opt/spykit/geoip/GeoLite2-City.mmdb")
        if not ok then
            -- Only log error, return empty result to avoid crash
            -- ngx.log(ngx.ERR, "Failed to init MaxMind DB: ", err)
            return result
        end
    end

    local lookup_res, err = mmdb.lookup(ip)
    if lookup_res then
        if lookup_res.country then
            result.country = lookup_res.country.iso_code or "Unknown"
            if lookup_res.country.names then 
                result.country_name = lookup_res.country.names.en or "Unknown" 
            end
        end
        if lookup_res.subdivisions and lookup_res.subdivisions[1] then
            result.region = lookup_res.subdivisions[1].iso_code or "Unknown"
        end
        if lookup_res.city and lookup_res.city.names then
            result.city = lookup_res.city.names.en or "Unknown"
        end
        if lookup_res.postal then
            result.postal_code = lookup_res.postal.code or "Unknown"
        end
        if lookup_res.location then
            result.latitude = lookup_res.location.latitude or 0
            result.longitude = lookup_res.location.longitude or 0
        end
    end
    
    return result
end

-- Function to enrich a single event
local function enrich_event(event)
    if type(event) ~= "table" then return end
    
    local headers = ngx.req.get_headers()
    local tls_fp = headers["x-tls-fingerprint"]
    
    -- Determine IP (Real IP > Forwarded > Remote)
    local target_ip = ngx.var.remote_addr or "0.0.0.0"
    if ngx.var.http_x_forwarded_for then
        local match = string.match(ngx.var.http_x_forwarded_for, "([^,]+)")
        if match then target_ip = match end
    elseif ngx.var.http_x_real_ip then
        target_ip = ngx.var.http_x_real_ip
    end

    -- Get Geo Data safely
    local geo = get_geoip_data(target_ip)
    
    -- Privacy: Salt for IP hashing to prevent rainbow table attacks
    -- Ideally this should come from config, but for now we use a fixed salt
    local ip_salt = "SpyKit_Privacy_Salt_v1"

    event.server = {
        -- Privacy: Store hash instead of raw IP
        ip_hash = ngx.md5(ngx.var.remote_addr .. ip_salt),
        real_ip_hash = ngx.md5(target_ip .. ip_salt),
        
        user_agent = ngx.var.http_user_agent,
        accept_language = ngx.var.http_accept_language,
        accept_encoding = ngx.var.http_accept_encoding,
        host = ngx.var.host,
        request_time = ngx.var.request_time,
        timestamp_server = ngx.time(),
        
        -- TLS/JA3 Fingerprint
        tls_fingerprint = tls_fp,

        -- Geolocation: Cloudflare Headers (Priority) -> MaxMind (Fallback) -> Unknown
        country = headers["cf-ipcountry"] or geo.country,
        country_name = headers["cf-ipcountry-name"] or geo.country_name,
        region = headers["cf-region-code"] or geo.region,
        city = headers["cf-ipcity"] or geo.city,
        postal_code = headers["cf-postal-code"] or geo.postal_code,
        latitude = headers["cf-iplatitude"] or geo.latitude,
        longitude = headers["cf-iplongitude"] or geo.longitude
    }
end

-- Read request body
ngx.req.read_body()
local data = ngx.req.get_body_data()

if not data then
    local datafile = ngx.req.get_body_file()
    if datafile then
        local fh, err = io.open(datafile, "r")
        if fh then
            data = fh:read("*a")
            fh:close()
        end
    end
end

if data then
    -- Parse JSON
    local success, decoded_data = pcall(cjson.decode, data)
    
    if success then
        local events_to_process = {}
        
        -- Handle both Array and Object inputs
        if type(decoded_data) == "table" then
            if decoded_data[1] then
                events_to_process = decoded_data
            else
                events_to_process = { decoded_data }
            end
        end
        
        for _, event in ipairs(events_to_process) do
            enrich_event(event)
        end
        
        -- Serialize back to JSON lines (one JSON object per line is standard for logs)
        -- Or write the whole array as one JSON blob?
        -- Usually for logs (ClickHouse/Vector), NDJSON (newline delimited JSON) is preferred.
        -- So we write the whole batch as one array line OR multiple lines?
        -- Let's stick to writing the modified data structure back as one line for now to match previous behavior,
        -- but usually NDJSON is better: one event per line.
        
        -- OPTION: If we received a batch, writing it as a single line array is efficient for I/O,
        -- but the consumer (Vector) must support parsing JSON arrays.
        -- Let's stick to: Input Array -> Output Array Line. Input Object -> Output Object Line.
        -- This preserves the original structure type.
        
        local final_json = cjson.encode(decoded_data)
        
        -- Write to log
        -- We use a single log file for simplicity now, or we can keep separate prefixes if needed.
        -- Let's unify to "events" prefix since structure is handled inside.
        local log_file = get_log_file_path("events")
        write_to_log(log_file, final_json)
    else
        -- Fallback for bad JSON
        local log_file = get_log_file_path("events_raw")
        write_to_log(log_file, data)
    end
end

ngx.status = 204
return
