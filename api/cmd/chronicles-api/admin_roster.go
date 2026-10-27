package main

// A read-only, environment-local view of Chronicles accounts and their last
// saved progress. No email, IP address, coordinates or run payload is exposed.
import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"

	"github.com/evilsysadmin/chess-studio/backend-go/internal/accountstore"
	"github.com/evilsysadmin/chess-studio/backend-go/internal/sessionauth"
	"github.com/evilsysadmin/chess-studio/backend-go/internal/ssoauth"
)

const adminRosterPath = "/api/chronicles/admin/users"
const adminPageSize = 40

type rosterUser struct {
	Username string         `json:"username"`
	CreatedAt string        `json:"createdAt,omitempty"`
	LastActivity string     `json:"lastActivity,omitempty"`
	Online bool             `json:"online"`
	Levels map[string]int   `json:"levels,omitempty"`
	MapID string            `json:"mapId,omitempty"`
	SavedAt string          `json:"savedAt,omitempty"`
	RunStatus string        `json:"runStatus,omitempty"`
}

type rosterPage struct {
	Users []rosterUser `json:"users"`
	NextAfter string   `json:"nextAfter,omitempty"`
}

type adminRosterHandler struct {
	authorize func(*http.Request) int
	read func(context.Context, string) (rosterPage, error)
	origins map[string]bool
}

func newAdminRoster(db *mongo.Database, jwtSecret string, sso *ssoauth.Verifier, timeout time.Duration, origins []string) http.Handler {
	accounts := accountstore.New(db, timeout)
	h := &adminRosterHandler{
		origins: make(map[string]bool),
		authorize: func(r *http.Request) int {
			return rosterAuthorization(r, []byte(jwtSecret), sso, accounts)
		},
		read: func(ctx context.Context, after string) (rosterPage, error) {
			return readRoster(ctx, db, after, time.Now().UTC())
		},
	}
	for _, origin := range origins {
		if origin = strings.TrimSpace(origin); origin != "" {
			h.origins[origin] = true
		}
	}
	return h
}

func rosterAuthorization(r *http.Request, secret []byte, sso *ssoauth.Verifier, accounts *accountstore.Store) int {
	bearer := r.Header.Get("Authorization")
	if !strings.HasPrefix(bearer, "Bearer ") {
		return http.StatusUnauthorized
	}
	token := strings.TrimPrefix(bearer, "Bearer ")
	var username string
	if sso != nil && ssoauth.IsToken(token) {
		claims, err := sso.Verify(r.Context(), token, time.Now())
		if err != nil {
			return http.StatusUnauthorized
		}
		username = claims.Subject
	} else {
		versionedUsername, version, err := sessionauth.VerifySession(token, secret, time.Now())
		if err != nil {
			return http.StatusUnauthorized
		}
		username = versionedUsername
		exists, currentVersion, err := accounts.AuthState(r.Context(), username)
		if err != nil {
			return http.StatusServiceUnavailable
		}
		if !exists || currentVersion != version {
			return http.StatusUnauthorized
		}
	}
	// A privileged census is more sensitive than in-game travel tools:
	// do not accept ADMIN_USERNAMES="*" or client-side admin flags.
	if !strings.EqualFold(username, ownerAdmin) && !explicitRosterAdmin(username) {
		return http.StatusForbidden
	}
	return http.StatusOK
}

func explicitRosterAdmin(username string) bool {
	for _, name := range splitCSV(strings.ToLower(os.Getenv("ADMIN_USERNAMES"))) {
		if name != "*" && strings.EqualFold(name, username) {
			return true
		}
	}
	return false
}

func (h *adminRosterHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Vary", "Origin")
	origin := r.Header.Get("Origin")
	if origin != "" {
		if !h.origins[origin] {
			http.Error(w, "Origen no permitido.", http.StatusForbidden)
			return
		}
		w.Header().Set("Access-Control-Allow-Origin", origin)
	}
	if r.Method == http.MethodOptions {
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Request-ID, X-Presence-Session")
		w.Header().Set("Access-Control-Max-Age", "600")
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if r.Method != http.MethodGet {
		w.Header().Set("Allow", "GET, OPTIONS")
		http.Error(w, "Método no permitido.", http.StatusMethodNotAllowed)
		return
	}
	if status := h.authorize(r); status != http.StatusOK {
		if status == http.StatusForbidden {
			http.Error(w, "Permiso de administrador requerido.", status)
		} else {
			http.Error(w, "Sesión no autorizada o servicio no disponible.", status)
		}
		return
	}
	after := r.URL.Query().Get("after")
	if len(after) > 64 || strings.TrimSpace(after) != after || strings.ContainsAny(after, "\r\n\x00") {
		http.Error(w, "Cursor no válido.", http.StatusBadRequest)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	page, err := h.read(ctx, after)
	if err != nil {
		http.Error(w, "No se pudo consultar el servidor.", http.StatusServiceUnavailable)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(page)
}

func rosterActive(last string, online bool, now time.Time) bool {
	if !online {
		return false
	}
	stamp, err := time.Parse(time.RFC3339Nano, last)
	if err != nil {
		return false
	}
	age := now.Sub(stamp)
	return age >= -5*time.Second && age <= 150*time.Second
}

func rosterLevels(raw string) map[string]int {
	var doc struct {
		Heroes map[string]struct {
			Level int `json:"level"`
		} `json:"heroes"`
	}
	if raw == "" || json.Unmarshal([]byte(raw), &doc) != nil {
		return nil
	}
	levels := make(map[string]int)
	for _, id := range []string{"matthias", "rook", "bishop", "knight"} {
		if hero, found := doc.Heroes[id]; found && hero.Level >= 1 && hero.Level <= 12 {
			levels[id] = hero.Level
		}
	}
	if len(levels) == 0 {
		return nil
	}
	return levels
}

func readRoster(ctx context.Context, db *mongo.Database, after string, now time.Time) (rosterPage, error) {
	page := rosterPage{Users: []rosterUser{}}
	filter := bson.D{}
	if after != "" {
		filter = append(filter, bson.E{Key: "_id", Value: bson.D{{Key: "$gt", Value: after}}})
	}
	cursor, err := db.Collection("users").Find(ctx, filter, options.Find().
		SetSort(bson.D{{Key: "_id", Value: 1}}).
		SetLimit(adminPageSize + 1).
		SetProjection(bson.D{{Key: "_id", Value: 1}, {Key: "created_at", Value: 1},
			{Key: "last_activity", Value: 1}, {Key: "last_login", Value: 1}, {Key: "presence_online", Value: 1}}))
	if err != nil {
		return page, err
	}
	defer cursor.Close(ctx)
	var users []struct {
		Username string `bson:"_id"`
		CreatedAt string `bson:"created_at"`
		LastActivity string `bson:"last_activity"`
		LastLogin string `bson:"last_login"`
		PresenceOnline *bool `bson:"presence_online"`
	}
	if err := cursor.All(ctx, &users); err != nil {
		return page, err
	}
	if len(users) > adminPageSize {
		page.NextAfter = users[adminPageSize-1].Username
		users = users[:adminPageSize]
	}
	for _, user := range users {
		last := user.LastActivity
		if last == "" {
			last = user.LastLogin
		}
		entry := rosterUser{
			Username: user.Username,
			CreatedAt: user.CreatedAt,
			LastActivity: last,
			Online: rosterActive(user.LastActivity, user.PresenceOnline == nil || *user.PresenceOnline, now),
		}
		var run struct {
			MapID string `bson:"currentMapId"`
			Status string `bson:"status"`
			UpdatedAt bson.DateTime `bson:"updatedAt"`
		}
		err := db.Collection("chronicles_runs").FindOne(ctx, bson.D{{Key: "owner", Value: user.Username}},
			options.FindOne().SetSort(bson.D{{Key: "updatedAt", Value: -1}}).
				SetProjection(bson.D{{Key: "currentMapId", Value: 1}, {Key: "status", Value: 1}, {Key: "updatedAt", Value: 1}})).Decode(&run)
		if err != nil && !errors.Is(err, mongo.ErrNoDocuments) {
			return rosterPage{}, err
		}
		if err == nil {
			entry.MapID = run.MapID
			entry.RunStatus = run.Status
			if run.UpdatedAt != 0 {
				entry.SavedAt = run.UpdatedAt.Time().UTC().Format(time.RFC3339)
			}
		}
		var progression struct {
			Document string `bson:"document"`
		}
		err = db.Collection("chronicles_progression").FindOne(ctx, bson.D{{Key: "_id", Value: user.Username}},
			options.FindOne().SetProjection(bson.D{{Key: "document", Value: 1}})).Decode(&progression)
		if err != nil && !errors.Is(err, mongo.ErrNoDocuments) {
			return rosterPage{}, err
		}
		if err == nil {
			entry.Levels = rosterLevels(progression.Document)
		}
		page.Users = append(page.Users, entry)
	}
	return page, nil
}
