package gamesapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"go.mongodb.org/mongo-driver/v2/bson"
)

func TestSharedJSONContentType(t *testing.T) {
	for _, tc := range []struct {
		value string
		want  bool
	}{
		{"application/json", true},
		{"application/json; charset=utf-8", true},
		{"application/problem+json", true},
		{"text/json", false},
		{"application/xml", false},
		{"application/jsonp", false},
		{"", false},
	} {
		t.Run(tc.value, func(t *testing.T) {
			if got := jsonContentType(tc.value); got != tc.want {
				t.Fatalf("jsonContentType(%q) = %v; want %v", tc.value, got, tc.want)
			}
		})
	}
}

func TestSharedWriteDocPreservesOrderedPayload(t *testing.T) {
	w := httptest.NewRecorder()
	writeDoc(w, http.StatusCreated, bson.D{
		{Key: "first", Value: "one"},
		{Key: "second", Value: int32(2)},
	})
	result := w.Result()
	defer result.Body.Close()
	if result.StatusCode != http.StatusCreated {
		t.Fatalf("status = %d; want 201", result.StatusCode)
	}
	if got := result.Header.Get("Content-Type"); got != "application/json" {
		t.Fatalf("content type = %q", got)
	}
	body := w.Body.String()
	if !strings.Contains(body, "\"first\"") || !strings.Contains(body, "\"second\"") {
		t.Fatalf("missing fields in %q", body)
	}
	if strings.Index(body, "\"first\"") > strings.Index(body, "\"second\"") {
		t.Fatalf("ordered BSON fields changed: %q", body)
	}
	var decoded map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &decoded); err != nil {
		t.Fatal(err)
	}
	if decoded["first"] != "one" || decoded["second"] != float64(2) {
		t.Fatalf("unexpected JSON payload: %#v", decoded)
	}
}

func TestSharedInternalErrorKeepsRequestID(t *testing.T) {
	w := httptest.NewRecorder()
	w.Header().Set("X-Request-ID", "req-123")
	internalError(w)
	if got := w.Result().StatusCode; got != http.StatusInternalServerError {
		t.Fatalf("status = %d; want 500", got)
	}
	if !strings.Contains(w.Body.String(), "\"requestId\":\"req-123\"") {
		t.Fatalf("request ID missing from internal error: %s", w.Body.String())
	}
}
