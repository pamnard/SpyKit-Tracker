-- Load JSON library
local cjson = require "cjson"

-- Read request body
ngx.req.read_body()
local data = ngx.req.get_body_data()

if data then
    -- Parse JSON
    local success, event = pcall(cjson.decode, data)
    
    if success then
        -- Enrich event with server data
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
        
        -- Convert back to JSON
        local enriched_data = cjson.encode(event)
        
                    -- Generate log file path with date and hour
            local timestamp = os.date("*t")
            local log_dir = "/var/log/spykit"
            local log_file = string.format("%s/events_%04d-%02d-%02d_%02d.log", 
                log_dir, timestamp.year, timestamp.month, timestamp.day, timestamp.hour)
            
            -- Create directory if not exists
            os.execute("mkdir -p " .. log_dir)
            
            -- Write enriched event
            local file = io.open(log_file, "a")
            file:write(enriched_data .. "\n")
            file:close()
    else
        -- If couldn't parse JSON, write as is
        local timestamp = os.date("*t")
        local log_dir = "/var/log/spykit"
        local log_file = string.format("%s/events_%04d-%02d-%02d_%02d.log", 
            log_dir, timestamp.year, timestamp.month, timestamp.day, timestamp.hour)
        
        -- Create directory if not exists
        os.execute("mkdir -p " .. log_dir)
        
        local file = io.open(log_file, "a")
        file:write(data .. "\n")
        file:close()
    end
end

ngx.status = 204
ngx.exit(204)