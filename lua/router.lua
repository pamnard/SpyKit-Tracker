local config_loader = require "config"

local DEFAULT_SETTINGS = {
    fileName = "pixel.js",
    endpoint = "/track"
}

-- Get settings (or default on error)
local success, settings = pcall(config_loader.get_settings)
if not success or not settings then
    settings = DEFAULT_SETTINGS
end

local uri = ngx.var.uri

-- 1. Serve JS file
if uri == "/" .. settings.fileName then
    ngx.header.content_type = "application/javascript"
    local f = io.open("/opt/spykit/dist/pixel.js", "rb")
    if f then
        local content = f:read("*all")
        f:close()
        ngx.print(content)
        return ngx.exit(200)
    else
        ngx.status = 404
        ngx.print("File not found")
        return ngx.exit(404)
    end
end

-- 2. Event tracking
if uri == settings.endpoint then
    return dofile("/opt/spykit/lua/pixel.lua")
end

-- 3. 404 for anything else
ngx.exit(404)

