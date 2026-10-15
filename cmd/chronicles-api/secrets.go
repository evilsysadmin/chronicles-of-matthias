package main

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
)

// The file convention lets Docker Compose mount Mongo credentials as a secret
// without placing them in a Compose environment value or repository.
var errMongoSecret = errors.New("invalid MongoDB credential source")

func mongoURIFromEnvironment() (string, error) {
	direct := os.Getenv("CHRONICLES_MONGODB_URI")
	secretPath := os.Getenv("CHRONICLES_MONGODB_URI_FILE")
	if direct != "" && secretPath != "" {
		return "", errMongoSecret
	}
	if secretPath == "" {
		return direct, nil
	}
	if !filepath.IsAbs(secretPath) {
		return "", errMongoSecret
	}
	info, err := os.Lstat(secretPath)
	if err != nil || !info.Mode().IsRegular() || info.Size() == 0 || info.Size() > 4096 {
		return "", errMongoSecret
	}
	content, err := os.ReadFile(secretPath)
	if err != nil {
		return "", errMongoSecret
	}
	uri := strings.TrimSpace(string(content))
	if uri == "" || len(uri) > 4096 {
		return "", errMongoSecret
	}
	return uri, nil
}
