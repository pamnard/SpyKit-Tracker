package main

import (
	"fmt"
	"strconv"
	"time"
)

type Event struct {
	Timestamp time.Time         `json:"timestamp"`
	EventName string            `json:"event_name"`
	IDs       map[string]string `json:"ids"`
	Context   map[string]string `json:"context"`
	Device    map[string]string `json:"device"`
	Geo       map[string]string `json:"geo"`
	Traffic   map[string]string `json:"traffic"`
	Tech      map[string]string `json:"tech"`
	Params    map[string]string `json:"params"`
}

func MapToEvent(raw map[string]interface{}) (*Event, error) {
	e := &Event{
		IDs:     make(map[string]string),
		Context: make(map[string]string),
		Device:  make(map[string]string),
		Geo:     make(map[string]string),
		Traffic: make(map[string]string),
		Tech:    make(map[string]string),
		Params:  make(map[string]string),
	}

	// 1. Timestamp
	if val, ok := raw["timestamp"]; ok {
		e.Timestamp = parseTimestamp(val)
	} else {
		e.Timestamp = time.Now()
	}
	// Event Name: Strict length limit
	e.EventName = Validate(toString(raw["event_name"]), Sanitize, MaxLength(100))

	// 2. IDs: Strict alphanumeric+
	e.IDs["user_id"] = Validate(toString(raw["user_id"]), Sanitize, MaxLength(64), IsID)
	// Fallback for legacy events
	if e.IDs["user_id"] == "" {
		e.IDs["user_id"] = Validate(toString(raw["uid"]), Sanitize, MaxLength(64), IsID)
	}

	// Standardize on visitor_id
	e.IDs["visitor_id"] = Validate(toString(raw["visitor_id"]), Sanitize, MaxLength(64), IsID)
	// Fallback for legacy events
	if e.IDs["visitor_id"] == "" {
		e.IDs["visitor_id"] = Validate(toString(raw["device_id"]), Sanitize, MaxLength(64), IsID)
	}
	
	e.IDs["session_id"] = Validate(toString(raw["session_id"]), Sanitize, MaxLength(64), IsID)

	// 3. Context & Geo
	if server, ok := raw["server"].(map[string]interface{}); ok {
		e.Context["ip"] = Validate(toString(server["ip"]), Sanitize, IsIP)
		e.Context["user_agent"] = Validate(toString(server["user_agent"]), Sanitize, MaxLength(500))
		
		e.Geo["country"] = Validate(toString(server["country"]), Sanitize, MaxLength(2)) // ISO code
		e.Geo["region"] = Validate(toString(server["region"]), Sanitize, MaxLength(100))
		e.Geo["city"] = Validate(toString(server["city"]), Sanitize, MaxLength(100))
		e.Geo["postal_code"] = Validate(toString(server["postal_code"]), Sanitize, MaxLength(20))
		e.Geo["latitude"] = toString(server["latitude"]) // Keep as string (or validate as float string)
		e.Geo["longitude"] = toString(server["longitude"])
		e.Geo["continent"] = Validate(toString(server["continent"]), Sanitize, MaxLength(20))
		e.Geo["metro_code"] = Validate(toString(server["metro_code"]), Sanitize, MaxLength(50))
		e.Geo["timezone"] = Validate(toString(server["timezone"]), Sanitize, MaxLength(100))
	} else {
		e.Context["ip"] = Validate(toString(raw["ip"]), Sanitize, IsIP)
		e.Context["user_agent"] = Validate(toString(raw["user_agent"]), Sanitize, MaxLength(500))
	}
	e.Context["url"] = Validate(toString(raw["url"]), Sanitize, MaxLength(2048))
	e.Context["referrer"] = Validate(toString(raw["referrer"]), Sanitize, MaxLength(2048))

	// 4. Device
	if device, ok := raw["device"].(map[string]interface{}); ok {
		e.Device["platform"] = Validate(toString(device["platform"]), Sanitize, MaxLength(50))
		e.Device["screen_width"] = Validate(toString(device["screenWidth"]), IsNumeric)
		e.Device["screen_height"] = Validate(toString(device["screenHeight"]), IsNumeric)
		e.Device["viewport_width"] = Validate(toString(device["viewportWidth"]), IsNumeric)
		e.Device["viewport_height"] = Validate(toString(device["viewportHeight"]), IsNumeric)
		e.Device["color_depth"] = Validate(toString(device["colorDepth"]), IsNumeric)
		e.Device["pixel_ratio"] = toString(device["pixelRatio"]) // Float allowed
		e.Device["orientation"] = Validate(toString(device["orientation"]), Sanitize, MaxLength(20))
		e.Device["timezone"] = Validate(toString(device["timezone"]), Sanitize, MaxLength(50))
		e.Device["gpu_renderer"] = Validate(toString(device["gpuRenderer"]), Sanitize, MaxLength(200))
		
		if langs, ok := device["languages"].([]interface{}); ok && len(langs) > 0 {
			e.Device["language"] = Validate(toString(langs[0]), Sanitize, MaxLength(10))
		}

		// 5. Tech
		e.Tech["ad_block"] = toString(device["adBlock"]) // bool/string
		e.Tech["pdf_viewer"] = toString(device["pdfViewerEnabled"])
		e.Tech["webdriver"] = toString(device["webdriver"])

		if perf, ok := device["performance"].(map[string]interface{}); ok {
			flatten("", perf, e.Tech)
		}
		if conn, ok := device["connection"].(map[string]interface{}); ok {
			flatten("", conn, e.Tech)
		}
		
		// Fingerprints are used for session linking in main.go, not stored in DB
	} else {
		e.Device["platform"] = Validate(toString(raw["platform"]), Sanitize, MaxLength(50))
	}

	// 6. Traffic (UTM)
	if utm, ok := raw["utm"].(map[string]interface{}); ok {
		flattenWithValidation("", utm, e.Traffic, 200)
	}

	// 7. Params (Custom Data) - Allow more flexibility
	if data, ok := raw["data"].(map[string]interface{}); ok {
		flattenWithValidation("", data, e.Params, 1000)
	}

	return e, nil
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
