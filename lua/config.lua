local _M = {}

function _M.get_settings()
    return {
        endpoint = os.getenv("PIXEL_ENDPOINT") or "/track",
        fileName = os.getenv("PIXEL_FILENAME") or "pixel.js"
    }
end

return _M
