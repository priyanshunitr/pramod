package controllers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"mime"
	"net"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"time"

	"pramod/api-go/models"
	"pramod/api-go/services"
)

type AuthController struct {
	auth             *services.AuthService
	secure           bool
	cookieName       string
	legacyCookieName string
	origins          map[string]bool
}

func NewAuthController(
	auth *services.AuthService,
) (*AuthController, error) {
	mode := os.Getenv("NODE_ENV")
	if mode == "" {
		mode = "development"
	}
	if mode != "development" && mode != "test" && mode != "production" {
		return nil, errors.New("invalid NODE_ENV")
	}

	controller := &AuthController{
		auth:             auth,
		secure:           mode == "production",
		cookieName:       "pramod_access",
		legacyCookieName: "pramod_session",
		origins:          make(map[string]bool),
	}

	if controller.secure {
		controller.cookieName = "__Host-pramod_access"
		controller.legacyCookieName = "__Host-pramod_session"
	}

	defaults := map[string]string{
		"FRONTEND_ORIGIN":  "http://localhost:5173",
		"RECEPTION_ORIGIN": "http://localhost:5174",
		"OWNER_ORIGIN":     "http://localhost:5175",
	}

	for name, fallback := range defaults {
		value := os.Getenv(name)

		if value == "" {
			if controller.secure {
				if name == "FRONTEND_ORIGIN" {
					return nil, errors.New("FRONTEND_ORIGIN is required in production")
				}
				continue
			}
			value = fallback
		}

		if err := controller.addOrigin(value); err != nil {
			return nil, fmt.Errorf("invalid %s: %w", name, err)
		}
	}

	if mode == "development" {
		if value := os.Getenv("DEV_TUNNEL_ORIGIN"); value != "" {
			if err := controller.addOrigin(value); err != nil {
				return nil, fmt.Errorf("invalid DEV_TUNNEL_ORIGIN: %w", err)
			}
		}
	}

	return controller, nil
}

func (c *AuthController) addOrigin(value string) error {
	u, err := url.Parse(value)
	if err != nil || u.Host == "" || u.User != nil ||
		(u.Scheme != "http" && u.Scheme != "https") ||
		(u.Path != "" && u.Path != "/") ||
		u.RawQuery != "" || u.Fragment != "" {
		return errors.New("use an HTTP or HTTPS origin without a path")
	}

	if c.secure && u.Scheme != "https" {
		return errors.New("production origins must use HTTPS")
	}

	c.origins[u.Scheme+"://"+u.Host] = true

	// Match the existing development localhost/127.0.0.1 aliases.
	host := u.Hostname()
	if !c.secure && (host == "localhost" || host == "127.0.0.1") {
		if host == "localhost" {
			host = "127.0.0.1"
		} else {
			host = "localhost"
		}

		if port := u.Port(); port != "" {
			host = net.JoinHostPort(host, port)
		}

		c.origins[u.Scheme+"://"+host] = true
	}

	return nil
}

func (c *AuthController) Register(w http.ResponseWriter, r *http.Request) {
	var input models.RegisterInput
	if !c.decodeBody(w, r, &input) {
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
	defer cancel()

	user, err := c.auth.Register(ctx, input, authClientIP(r))
	if err != nil {
		authError(w, err)
		return
	}

	expiresAt, err := c.signIn(w, *user)
	if err != nil {
		authError(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{
		"data": models.Session{
			User:        user,
			Memberships: make([]models.Membership, 0),
			ExpiresAt:   &expiresAt,
		},
	})
}

func (c *AuthController) Login(w http.ResponseWriter, r *http.Request) {
	var input models.LoginInput
	if !c.decodeBody(w, r, &input) {
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
	defer cancel()

	user, err := c.auth.Login(ctx, input, authClientIP(r))
	if err != nil {
		authError(w, err)
		return
	}

	expiresAt, err := c.signIn(w, *user)
	if err != nil {
		authError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"data": map[string]any{
			"signedIn":  true,
			"expiresAt": expiresAt,
		},
	})
}

func (c *AuthController) Logout(w http.ResponseWriter, r *http.Request) {
	var input struct{}
	if !c.decodeBody(w, r, &input) {
		return
	}

	c.clearCookie(w, c.cookieName)
	c.clearCookie(w, c.legacyCookieName)

	writeJSON(w, http.StatusOK, map[string]any{
		"data": map[string]bool{"signedIn": false},
	})
}

func (c *AuthController) Me(w http.ResponseWriter, r *http.Request) {
	session := models.Session{
		Memberships: make([]models.Membership, 0),
	}

	var credential string
	matches := 0

	for _, cookie := range r.Cookies() {
		if cookie.Name == c.cookieName {
			credential = cookie.Value
			matches++
		}
	}

	var identity *models.Identity
	if matches == 1 {
		identity = c.auth.VerifyToken(credential)
	}

	if identity != nil {
		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()

		memberships, err := c.auth.Memberships(ctx, identity.User.ID)
		if err != nil {
			authError(w, err)
			return
		}

		session.User = &identity.User
		session.ExpiresAt = &identity.ExpiresAt
		session.Memberships = memberships
	}

	writeJSON(w, http.StatusOK, map[string]any{"data": session})
}

func (c *AuthController) decodeBody(
	w http.ResponseWriter,
	r *http.Request,
	target any,
) bool {
	if !c.origins[r.Header.Get("Origin")] {
		writeJSON(w, http.StatusForbidden, map[string]string{
			"error": "Request origin is not allowed.",
		})
		return false
	}

	contentType, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if err != nil || contentType != "application/json" {
		writeJSON(w, http.StatusUnsupportedMediaType, map[string]string{
			"error": "Use application/json.",
		})
		return false
	}

	r.Body = http.MaxBytesReader(w, r.Body, 8*1024)
	defer r.Body.Close()

	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()

	err = decoder.Decode(target)
	if err == nil {
		var extra any
		nextErr := decoder.Decode(&extra)

		if nextErr != io.EOF {
			err = nextErr
			if err == nil {
				err = errors.New("expected exactly one JSON value")
			}
		}
	}

	if err != nil {
		var tooLarge *http.MaxBytesError

		if errors.As(err, &tooLarge) {
			writeJSON(w, http.StatusRequestEntityTooLarge, map[string]string{
				"error": "Request body is too large.",
			})
		} else {
			writeJSON(w, http.StatusBadRequest, map[string]string{
				"error": "Send a valid JSON object with the expected fields.",
			})
		}

		return false
	}

	return true
}

func (c *AuthController) signIn(
	w http.ResponseWriter,
	user models.User,
) (time.Time, error) {
	value, expiresAt, err := c.auth.IssueToken(user)
	if err != nil {
		return time.Time{}, err
	}

	http.SetCookie(w, c.cookie(c.cookieName, value, expiresAt))
	c.clearCookie(w, c.legacyCookieName)

	return expiresAt, nil
}

func (c *AuthController) cookie(
	name string,
	value string,
	expiresAt time.Time,
) *http.Cookie {
	return &http.Cookie{
		Name:     name,
		Value:    value,
		Path:     "/",
		HttpOnly: true,
		Secure:   c.secure,
		SameSite: http.SameSiteLaxMode,
		Expires:  expiresAt,
	}
}

func (c *AuthController) clearCookie(w http.ResponseWriter, name string) {
	cookie := c.cookie(name, "", time.Unix(1, 0))
	cookie.MaxAge = -1
	http.SetCookie(w, cookie)
}

func authClientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

func authError(w http.ResponseWriter, err error) {
	var limited *services.AuthRateLimitError

	switch {
	case errors.As(err, &limited):
		w.Header().Set("Retry-After", strconv.Itoa(limited.RetryAfter))
		writeJSON(w, http.StatusTooManyRequests, map[string]string{
			"error": limited.Error(),
		})

	case errors.Is(err, services.ErrAuthInput):
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": err.Error(),
		})

	case errors.Is(err, services.ErrAccountExists):
		writeJSON(w, http.StatusConflict, map[string]string{
			"error": err.Error(),
		})

	case errors.Is(err, services.ErrInvalidCredentials):
		writeJSON(w, http.StatusUnauthorized, map[string]string{
			"error": err.Error(),
		})

	default:
		log.Printf("Authentication failed: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error": "An unexpected server error occurred.",
		})
	}
}