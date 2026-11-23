package gamesapi

// Shared HTTP/JSON response and request helpers used by the active Chronicles
// account, auth, map, feedback and run routes. Their implementation is moved
// verbatim from the unmounted Chess Studio profile handler.

import (
	"mime"
	"net/http"
	"strings"

	"go.mongodb.org/mongo-driver/v2/bson"

	"github.com/evilsysadmin/chess-studio/backend-go/internal/pydoc"
)

// jsonContentType mirrors FastAPI's check: application/json or */*+json.
func jsonContentType(raw string) bool {
	if raw == "" {
		return false
	}
	mediaType, _, err := mime.ParseMediaType(raw)
	if err != nil {
		mediaType = strings.ToLower(strings.TrimSpace(strings.SplitN(raw, ";", 2)[0]))
	}
	main, sub, _ := strings.Cut(mediaType, "/")
	return main == "application" && (sub == "json" || strings.HasSuffix(sub, "+json"))
}

// writeDoc answers an ordered document like FastAPI's JSONResponse; a value
// JSON cannot carry (an infinite float someone stored) is Python's 500.
func writeDoc(w http.ResponseWriter, status int, doc bson.D) {
	encoded, err := pydoc.Encode(doc)
	if err != nil {
		internalError(w)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_, _ = w.Write(encoded)
}

// internalError mirrors main's unhandled-exception handler.
func internalError(w http.ResponseWriter) {
	writeJSON(w, http.StatusInternalServerError, map[string]any{
		"detail":    "Error interno del servidor.",
		"requestId": w.Header().Get("X-Request-ID"),
	})
}

// decodeOrderedBody is decodeModelBody keeping the object's key order.
func decodeOrderedBody(w http.ResponseWriter, r *http.Request, raw []byte) (any, bool) {
	if _, ok := decodeModelBody(w, r, raw); !ok {
		return nil, false
	}
	if len(raw) == 0 {
		return nil, true
	}
	if !jsonContentType(r.Header.Get("Content-Type")) {
		return string(raw), true
	}
	body, err := pydoc.Decode(raw)
	if err != nil {
		writeJSON(w, http.StatusUnprocessableEntity, map[string]any{"detail": []map[string]any{{"type": "json_invalid", "loc": []any{"body", 0}, "msg": "JSON decode error"}}})
		return nil, false
	}
	return body, true
}
