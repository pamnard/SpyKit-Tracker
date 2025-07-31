-- Synchronize visitor_id between domains via pixel

-- Get parameters from URL
local args = ngx.req.get_uri_args()
local visitor_id = args.visitor_id
local callback = args.callback

-- Check that visitor_id is provided
if not visitor_id or visitor_id == "" then
    ngx.status = 400
    ngx.say("Missing visitor_id parameter")
    ngx.exit(400)
end

-- Get domain from Host header
local host = ngx.var.host
local domain = host

-- If this is a subdomain, get root domain
local parts = {}
for part in string.gmatch(host, "[^.]+") do
    table.insert(parts, part)
end

if #parts > 2 then
    -- Take last two segments for root domain
    domain = "." .. parts[#parts-1] .. "." .. parts[#parts]
elseif #parts == 2 then
    domain = "." .. host
end

-- Set visitor_id cookie for 365 days
local expires = ngx.cookie_time(ngx.time() + 365 * 24 * 3600)
local cookie_value = string.format("spyKit_visitor_id=%s; expires=%s; domain=%s; path=/; SameSite=Lax", 
    visitor_id, expires, domain)

ngx.header["Set-Cookie"] = cookie_value

-- Return transparent 1x1 pixel GIF
ngx.header.content_type = "image/gif"
ngx.header["Cache-Control"] = "no-cache, no-store, must-revalidate"
ngx.header["Pragma"] = "no-cache"
ngx.header["Expires"] = "0"

-- 1x1 transparent GIF (43 bytes)
local gif_data = string.char(
    0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00, 0xFF, 0xFF, 0xFF,
    0x00, 0x00, 0x00, 0x21, 0xF9, 0x04, 0x01, 0x00, 0x00, 0x00, 0x00, 0x2C, 0x00, 0x00, 0x00, 0x00,
    0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x04, 0x01, 0x00, 0x3B
)

-- If callback exists, add JavaScript
if callback and callback ~= "" then
    ngx.header.content_type = "text/html"
    local html = string.format([[
<!DOCTYPE html>
<html>
<head><title>Sync</title></head>
<body>
<script>
try {
    if (window.parent && window.parent.%s) {
        window.parent.%s('success');
    }
} catch(e) {}
</script>
</body>
</html>
]], callback, callback)
    ngx.say(html)
else
    ngx.print(gif_data)
end

ngx.exit(200)