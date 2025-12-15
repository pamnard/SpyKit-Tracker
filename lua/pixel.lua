-- Load JSON library
local cjson = require "cjson"

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

-- Function to enrich a single event
local function enrich_event(event)
    if type(event) ~= "table" then return end
    
    event.server = {
        ip = ngx.var.remote_addr,
        real_ip = ngx.var.http_x_forwarded_for or ngx.var.http_x_real_ip or ngx.var.remote_addr,
        user_agent = ngx.var.http_user_agent,
        accept_language = ngx.var.http_accept_language,
        accept_encoding = ngx.var.http_accept_encoding,
        host = ngx.var.host,
        request_time = ngx.var.request_time,
        timestamp_server = ngx.time(),
        -- Geolocation via GeoIP
        country = ngx.var.geoip_country_code or "Unknown",
        country_name = ngx.var.geoip_country_name or "Unknown",
        region = ngx.var.geoip_region or "Unknown",
        city = ngx.var.geoip_city or "Unknown",
        postal_code = ngx.var.geoip_postal_code or "Unknown",
        latitude = ngx.var.geoip_latitude or 0,
        longitude = ngx.var.geoip_longitude or 0
    }
end

-- Read request body
ngx.req.read_body()
local data = ngx.req.get_body_data()

if data then
    -- Parse JSON
    local success, decoded_data = pcall(cjson.decode, data)
    
    if success then
        local events_to_process = {}
        
        -- Normalize input to array
        -- cjson decodes JSON arrays as Lua tables with integer keys starting from 1
        -- JSON objects are Lua tables with string keys
        if type(decoded_data) == "table" then
            -- Check if it's an array (has integer index 1) or object
            if decoded_data[1] then
                -- It's likely an array
                events_to_process = decoded_data
            else
                -- It's a single object
                events_to_process = { decoded_data }
            end
        end
        
        -- Enrich all events
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
ngx.exit(204)