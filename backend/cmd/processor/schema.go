package main

import (
	"fmt"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/ua-parser/uap-go/uaparser"
)

var (
	parser     *uaparser.Parser
	parserOnce sync.Once
)

func getParser() *uaparser.Parser {
	parserOnce.Do(func() {
		parser, _ = uaparser.New("./regexes.yaml") // Try local file first
		if parser == nil {
			// Fallback to internal/default regexes if file not found (handled by library usually)
			parser = uaparser.NewFromSaved()
		}
	})
	return parser
}

// isWebView detects if the user agent string indicates a WebView environment.
// Matches: webview, wv, or iOS pattern (iPhone/iPad without Safari or with "like Safari")
func isWebView(userAgent string) bool {
	if userAgent == "" {
		return false
	}
	
	ua := strings.ToLower(userAgent)
	
	// 1. Explicit WebView markers
	markers := []string{"webview", "wv"}
	for _, m := range markers {
		if strings.Contains(ua, m) {
			return true
		}
	}
	
	// 2. iOS WebView logic
	// iOS WebViews often don't contain "Safari" but are on iPhone/iPad
	// Or they contain "like Safari"
	isIOS := strings.Contains(ua, "iphone") || strings.Contains(ua, "ipad")
	if isIOS {
		hasSafari := strings.Contains(ua, "safari")
		hasLikeSafari := strings.Contains(ua, "like safari")
		
		// Logic: If on iOS, it is a WebView if:
		// - It does NOT say "Safari" (Standard Safari always says "Safari")
		// - OR it says "like Safari" (common in embedded browsers)
		if !hasSafari || hasLikeSafari {
			return true
		}
	}
	
	return false
}

type Event struct {
	Timestamp time.Time         `json:"timestamp"`
	EventName string            `json:"event_name"`
	IDs       map[string]string `json:"ids"`
	Page      map[string]string `json:"page"` // Replaces Context
	Device    map[string]string `json:"device"`
	Geo       map[string]string `json:"geo"`
	Traffic   map[string]string `json:"traffic"`
	Tech      map[string]string `json:"tech"`
	Params    map[string]string `json:"params"`
}

func MapToEvent(raw map[string]interface{}) (*Event, error) {
	e := &Event{
		IDs:     make(map[string]string),
		Page:    make(map[string]string),
		Device:  make(map[string]string),
		Geo:     make(map[string]string),
		Traffic: make(map[string]string),
		Tech:    make(map[string]string),
		Params:  make(map[string]string),
	}

	// 1. Timestamp and Event Name
	if val, ok := raw["timestamp"]; ok {
		e.Timestamp = parseTimestamp(val)
	} else {
		e.Timestamp = time.Now()
	}
	e.EventName = Validate(toString(raw["event_name"]), Sanitize, MaxLength(100))

	// 2. Parse sections
	// Common extracted data for reuse
	var userAgent, ipHash string
	if server, ok := raw["server"].(map[string]interface{}); ok {
		ipHash = Validate(toString(server["ip_hash"]), Sanitize, MaxLength(64))
		userAgent = Validate(toString(server["user_agent"]), Sanitize, MaxLength(500))
	} else {
		ipHash = Validate(toString(raw["ip_hash"]), Sanitize, MaxLength(64))
		userAgent = Validate(toString(raw["user_agent"]), Sanitize, MaxLength(500))
	}

	// 3. Fill Maps
	parseIDs(raw, e)
	
	// Geo & IP
	e.Geo["ip_hash"] = ipHash
	parseGeo(raw, e)
	
	// Device & UserAgent
	e.Device["user_agent"] = userAgent
	parseDevice(raw, userAgent, e) // Pass UA explicitly
	
	// Page & Traffic (including Referrer)
	urlParts := parseURL(Validate(toString(raw["url"]), Sanitize, MaxLength(2048)))
	parsePage(raw, urlParts, e)
	parseTraffic(raw, urlParts, e) // Parses traffic AND referrer
	
	parseTech(raw, e)
	parseParams(raw, e)

	return e, nil
}

// parseIDs extracts and validates ID fields.
func parseIDs(raw map[string]interface{}, e *Event) {
	e.IDs["user_id"] = Validate(toString(raw["user_id"]), Sanitize, MaxLength(64), IsID)
	if e.IDs["user_id"] == "" {
		e.IDs["user_id"] = Validate(toString(raw["uid"]), Sanitize, MaxLength(64), IsID)
	}

	e.IDs["visitor_id"] = Validate(toString(raw["visitor_id"]), Sanitize, MaxLength(64), IsID)
	if e.IDs["visitor_id"] == "" {
		e.IDs["visitor_id"] = Validate(toString(raw["device_id"]), Sanitize, MaxLength(64), IsID)
	}
	
	e.IDs["session_id"] = Validate(toString(raw["session_id"]), Sanitize, MaxLength(64), IsID)
}

// parsePage extracts page information (url, path, query...).
func parsePage(raw map[string]interface{}, urlParts map[string]string, e *Event) {
	e.Page["url"] = Validate(toString(raw["url"]), Sanitize, MaxLength(2048))
	e.Page["host"] = urlParts["url_host"]
	e.Page["path"] = urlParts["url_path"]
	e.Page["query"] = urlParts["url_query"]
}

// parseGeo extracts geo data.
func parseGeo(raw map[string]interface{}, e *Event) {
	if server, ok := raw["server"].(map[string]interface{}); ok {
		e.Geo["country"] = Validate(toString(server["country"]), Sanitize, MaxLength(2))
		e.Geo["region"] = Validate(toString(server["region"]), Sanitize, MaxLength(100))
		e.Geo["city"] = Validate(toString(server["city"]), Sanitize, MaxLength(100))
		e.Geo["postal_code"] = Validate(toString(server["postal_code"]), Sanitize, MaxLength(20))
		e.Geo["latitude"] = toString(server["latitude"])
		e.Geo["longitude"] = toString(server["longitude"])
		e.Geo["continent"] = Validate(toString(server["continent"]), Sanitize, MaxLength(20))
		e.Geo["metro_code"] = Validate(toString(server["metro_code"]), Sanitize, MaxLength(50))
		e.Geo["timezone"] = Validate(toString(server["timezone"]), Sanitize, MaxLength(100))
	}
}

// parseDevice extracts device information.
func parseDevice(raw map[string]interface{}, uaStr string, e *Event) {
	if device, ok := raw["device"].(map[string]interface{}); ok {
		e.Device["platform"] = Validate(toString(device["platform"]), Sanitize, MaxLength(50))
		e.Device["screen_width"] = Validate(toString(device["screenWidth"]), IsNumeric)
		e.Device["screen_height"] = Validate(toString(device["screenHeight"]), IsNumeric)
		e.Device["viewport_width"] = Validate(toString(device["viewportWidth"]), IsNumeric)
		e.Device["viewport_height"] = Validate(toString(device["viewportHeight"]), IsNumeric)
		e.Device["color_depth"] = Validate(toString(device["colorDepth"]), IsNumeric)
		e.Device["pixel_ratio"] = toString(device["pixelRatio"])
		e.Device["orientation"] = Validate(toString(device["orientation"]), Sanitize, MaxLength(20))
		e.Device["timezone"] = Validate(toString(device["timezone"]), Sanitize, MaxLength(50))
		e.Device["gpu_renderer"] = Validate(toString(device["gpuRenderer"]), Sanitize, MaxLength(200))
		
		if langs, ok := device["languages"].([]interface{}); ok && len(langs) > 0 {
			e.Device["language"] = Validate(toString(langs[0]), Sanitize, MaxLength(10))
		}

		if uaStr != "" {
			enrichDeviceFromUA(device, uaStr, e)
		}
	} else {
		e.Device["platform"] = Validate(toString(raw["platform"]), Sanitize, MaxLength(50))
	}
}

// enrichDeviceFromUA enriches device info from user agent parsing.
func enrichDeviceFromUA(device map[string]interface{}, uaStr string, e *Event) {
	ua := getParser().Parse(uaStr)

	if e.Device["os_name"] == "" {
		e.Device["os_name"] = ua.Os.Family
		e.Device["os_version"] = ua.Os.ToVersionString()
	}
	
	if e.Device["browser_name"] == "" {
		e.Device["browser_name"] = ua.UserAgent.Family
		e.Device["browser_version"] = ua.UserAgent.ToVersionString()
	}

	if e.Device["model"] == "" && ua.Device.Family != "Other" {
		e.Device["model"] = ua.Device.Family
	}
	
	if e.Device["device_type"] == "" {
		if ua.Device.Family == "iPhone" || ua.Device.Family == "Spider" {
			e.Device["device_type"] = "mobile" 
		} else if ua.Os.Family == "Android" {
			e.Device["device_type"] = "mobile"
		} else {
			e.Device["device_type"] = "desktop"
		}
	}

	// Bot Detection
	isBot := false
	// 1. Check uaparser result
	if ua.Device.Family == "Spider" || ua.UserAgent.Family == "Bot" {
		isBot = true
	}
	// 2. Check webdriver (strong signal)
	webdriverStr := toString(device["webdriver"])
	if !isBot && (webdriverStr == "true" || webdriverStr == "1") {
		isBot = true
	}
	// 3. Simple fallback check for common bots
	if !isBot {
		lowerUA := strings.ToLower(uaStr)
		botMarkers := []string{"bot", "crawler", "spider", "slurp", "facebookexternalhit"}
		for _, m := range botMarkers {
			if strings.Contains(lowerUA, m) {
				isBot = true
				break
			}
		}
	}
	e.Device["is_bot"] = strconv.FormatBool(isBot)
	
	frontendWebview := toString(device["webview"])
	if frontendWebview != "" {
		e.Device["is_webview"] = "true"
		e.Device["webview"] = Validate(frontendWebview, Sanitize, MaxLength(100))
	} else if isWebView(uaStr) {
		e.Device["is_webview"] = "true"
		e.Device["webview"] = "Unknown WebView"
	} else {
		e.Device["is_webview"] = "false"
	}
}

// parseTech extracts technical information.
func parseTech(raw map[string]interface{}, e *Event) {
	if device, ok := raw["device"].(map[string]interface{}); ok {
		e.Tech["ad_block"] = toString(device["adBlock"])
		e.Tech["pdf_viewer"] = toString(device["pdfViewerEnabled"])

		if perf, ok := device["performance"].(map[string]interface{}); ok {
			flatten("", perf, e.Tech)
		}
		if conn, ok := device["connection"].(map[string]interface{}); ok {
			flatten("", conn, e.Tech)
		}
	}
}

// parseTraffic extracts traffic attribution including referrer.
func parseTraffic(raw map[string]interface{}, urlParts map[string]string, e *Event) {
	// 1. Referrer Parsing (moved from Context)
	referrerStr := Validate(toString(raw["referrer"]), Sanitize, MaxLength(2048))
	e.Traffic["referrer"] = referrerStr

	if referrerStr != "" {
		refParts := parseURL(referrerStr)
		if val, ok := refParts["url_host"]; ok {
			e.Traffic["referrer_host"] = val
		}
		if val, ok := refParts["url_path"]; ok {
			e.Traffic["referrer_path"] = val
		}
		if val, ok := refParts["url_query"]; ok {
			e.Traffic["referrer_query"] = val
		}
	}

	// 2. Layer 1: From traffic object (UTM marks etc)
	if traffic, ok := raw["traffic"].(map[string]interface{}); ok {
		flattenWithValidation("", traffic, e.Traffic, 200)
	}
	
	// 3. Layer 2: From URL query parameters
	trafficParams := map[string]string{
		"source":   "url_query_source",
		"channel":  "url_query_channel",
		"campaign": "url_query_campaign",
		"term":     "url_query_term",
		"content":  "url_query_content",
	}
	for trafficKey, urlQueryKey := range trafficParams {
		if e.Traffic[trafficKey] == "" && urlParts[urlQueryKey] != "" {
			e.Traffic[trafficKey] = urlParts[urlQueryKey]
		}
	}
	
	// 4. Layer 3: From click ID parameters
	if e.Traffic["source"] == "" && e.Traffic["channel"] == "" {
		clickIDMap := map[string]string{
			"url_query_gclid":   "google",
			"url_query_fbclid":  "facebook",
			"url_query_msclkid": "bing",
			"url_query_ttclid":  "tiktok",
			"url_query_yclid":    "yandex",
			"url_query_vk_id":    "vk",
			"url_query_vk_ref":   "vk",
		}
		for urlQueryKey, sourceName := range clickIDMap {
			if urlParts[urlQueryKey] != "" {
				e.Traffic["source"] = sourceName
				e.Traffic["channel"] = "cpc"
				break
			}
		}
	}

	// Layer 4: From Referrer (Organic Search or Referral)
	// If still no source/channel found, try to use referrer host
	if e.Traffic["source"] == "" && e.Traffic["channel"] == "" {
		if refHost := e.Traffic["referrer_host"]; refHost != "" {
			// Check for Organic Search first
			if engine := getSearchEngine(refHost); engine != "" {
				e.Traffic["source"] = engine
				e.Traffic["channel"] = "organic"
			} else {
				// Fallback to Referral
				e.Traffic["source"] = refHost
				e.Traffic["channel"] = "referral"
			}
		}
	}
}

// getSearchEngine identifies common search engines by referrer host.
// Returns the engine name (e.g., "google", "yandex") or empty string.
func getSearchEngine(host string) string {
	h := strings.ToLower(host)
	
	searchEngines := []struct {
		substr string
		name   string
	}{
		{"google.", "google"},
		{"yandex.", "yandex"},
		{"ya.ru", "yandex"},
		{"bing.com", "bing"},
		{"yahoo.", "yahoo"},
		{"duckduckgo.", "duckduckgo"},
		{"baidu.", "baidu"},
		{"go.mail.ru", "mail.ru"},
	}

	for _, se := range searchEngines {
		if strings.Contains(h, se.substr) {
			return se.name
		}
	}
	
	return ""
}


// parseParams extracts custom event parameters.
func parseParams(raw map[string]interface{}, e *Event) {
	if data, ok := raw["data"].(map[string]interface{}); ok {
		flattenWithValidation("", data, e.Params, 1000)
	}
}

// flattenWithValidation recursively converts nested structures and validates values
func flattenWithValidation(prefix string, val interface{}, result map[string]string, maxLength int) {
	if val == nil { return }
	
	switch v := val.(type) {
	case map[string]interface{}:
		for k, subVal := range v {
			// Validate keys too? Maybe just safe chars
			newKey := k
			if prefix != "" { newKey = prefix + "_" + k }
			flattenWithValidation(newKey, subVal, result, maxLength)
		}
	default:
		if prefix != "" {
			// Validate value
			strVal := toString(v)
			result[prefix] = Validate(strVal, Sanitize, MaxLength(maxLength))
		}
	}
}

// flatten helper (legacy, replaced by flattenWithValidation but kept if needed)
func flatten(prefix string, val interface{}, result map[string]string) {
	flattenWithValidation(prefix, val, result, 500)
}

// Helper: Soft cast to string
func toString(val interface{}) string {
	if val == nil {
		return ""
	}
	switch v := val.(type) {
	case string:
		return v
	case float64:
		return strconv.FormatFloat(v, 'f', -1, 64)
	case int:
		return strconv.Itoa(v)
	case bool:
		return strconv.FormatBool(v)
	default:
		return fmt.Sprintf("%v", v)
	}
}

// parseURL extracts host, path, and query parameters from URL.
// Returns a map with url_host, url_path, url_query, and url_query_* keys.
func parseURL(urlStr string) map[string]string {
	result := make(map[string]string)
	if urlStr == "" {
		return result
	}
	
	parsedURL, err := url.Parse(urlStr)
	if err != nil {
		return result
	}
	
	// Host
	if parsedURL.Host != "" {
		result["url_host"] = Validate(parsedURL.Host, Sanitize, MaxLength(255))
	}
	
	// Path
	if parsedURL.Path != "" {
		result["url_path"] = Validate(parsedURL.Path, Sanitize, MaxLength(2048))
	}
	
	// Query string
	if parsedURL.RawQuery != "" {
		result["url_query"] = Validate(parsedURL.RawQuery, Sanitize, MaxLength(2048))
		
		// Parse query parameters
		query := parsedURL.Query()
		for key, values := range query {
			if len(values) > 0 && values[0] != "" {
				queryKey := "url_query_" + key
				result[queryKey] = Validate(values[0], Sanitize, MaxLength(500))
			}
		}
	}
	
	return result
}

// Helper: Parse timestamp
func parseTimestamp(val interface{}) time.Time {
	switch v := val.(type) {
	case float64:
		sec := int64(v)
		nsec := int64((v - float64(sec)) * 1e9)
		return time.Unix(sec, nsec)
	case int64:
		return time.Unix(v, 0)
	case string:
		t, err := time.Parse(time.RFC3339, v)
		if err == nil {
			return t
		}
	}
	return time.Now()
}
