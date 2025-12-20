local config_loader = require "config"

local DEFAULT_SETTINGS = {
    fileName = "pixel.js",
    endpoint = "/track"
}

-- Get settings
local settings = config_loader.get_settings()
if not settings then
    ngx.log(ngx.ERR, "Failed to load pixel settings")
    return ngx.exit(503)
end

local uri = ngx.var.uri

-- 1. Serve JS file
if uri == "/" .. settings.fileName then
    ngx.header.content_type = "application/javascript"
    local f = io.open("/opt/pixel/dist/pixel.js", "rb")
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
    local f, err = loadfile("/opt/pixel/lua/pixel.lua")
    if not f then
        ngx.log(ngx.ERR, "Failed to load pixel script: ", err)
        return ngx.exit(500)
    end
    return f()
end

-- 3. 404 for anything else
ngx.exit(404)

