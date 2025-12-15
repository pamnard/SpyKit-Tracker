package main

import (
	"fmt"
	"net"
	"regexp"
	"strings"
	"unicode/utf8"
)

// Validate runs a value through a list of validator functions.
// On error, returns empty string (safe fallback).
func Validate(val string, validators ...func(string) (string, error)) string {
	current := val
	for _, v := range validators {
		res, err := v(current)
		if err != nil {
			return ""
		}
		current = res
	}
	return current
}

// --- Validators ---

// Sanitize removes null bytes, trims spaces, ensures valid UTF-8, and clears common "null" strings.
func Sanitize(s string) (string, error) {
	s = strings.ReplaceAll(s, "\x00", "")
	s = strings.TrimSpace(s)

	// Normalize trash values
	lower := strings.ToLower(s)
	if lower == "null" || lower == "undefined" || lower == "none" || lower == "nan" {
		return "", nil
	}

	if !utf8.ValidString(s) {
		v := make([]rune, 0, len(s))
		for _, r := range s {
			if r == utf8.RuneError {
				continue
			}
			v = append(v, r)
		}
		s = string(v)
	}
	return s, nil
}

// MaxLength truncates string to n bytes.
func MaxLength(n int) func(string) (string, error) {
	return func(s string) (string, error) {
		if len(s) > n {
			return s[:n], nil
		}
		return s, nil
	}
}

// IsIP validates IP address.
func IsIP(s string) (string, error) {
	if s == "" {
		return "", nil
	}
	if net.ParseIP(s) == nil {
		return "", fmt.Errorf("invalid ip")
	}
	return s, nil
}

var reID = regexp.MustCompile(`^[a-zA-Z0-9_\-\.]+$`)

// IsID checks for safe ID characters (alphanumeric, _, -, .).
func IsID(s string) (string, error) {
	if s == "" {
		return "", nil
	}
	if !reID.MatchString(s) {
		return "", fmt.Errorf("invalid id format")
	}
	return s, nil
}

// IsNumeric checks if string contains only digits.
func IsNumeric(s string) (string, error) {
	if s == "" {
		return "", nil
	}
	for _, c := range s {
		if c < '0' || c > '9' {
			return "", fmt.Errorf("not numeric")
		}
	}
	return s, nil
}

// IsEnum checks if value is in allowed list.
func IsEnum(allowed ...string) func(string) (string, error) {
	set := make(map[string]bool)
	for _, a := range allowed {
		set[a] = true
	}

	return func(s string) (string, error) {
		if s == "" {
			return "", nil
		}
		if set[s] {
			return s, nil
		}
		return "", fmt.Errorf("not in enum")
	}
}
