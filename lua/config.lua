local cjson = require "cjson"
local _M = {}

function _M.get_settings()
    local cache = ngx.shared.settings_cache
    if not cache then return nil end

    local settings_json = cache:get("pixel_settings")
    if settings_json then
        return cjson.decode(settings_json)
    end

    -- Request to backend via internal location
    local res = ngx.location.capture("/internal_backend/api/settings")
    
    if res.status == 200 then
        -- Cache for 10 seconds
        cache:set("pixel_settings", res.body, 10)
        return cjson.decode(res.body)
    else
        ngx.log(ngx.ERR, "Failed to fetch settings: " .. res.status)
        return nil
    end
end

return _M

