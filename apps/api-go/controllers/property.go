package controllers

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"regexp"
	"time"

	"pramod/api-go/services"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var propertySlugPattern = regexp.MustCompile(`^[a-z0-9-]{1,80}$`)

func PropertyHandler(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		slug := r.PathValue("slug")

		if !propertySlugPattern.MatchString(slug) {
			writeJSON(w, http.StatusBadRequest, map[string]string{
				"error": "Invalid property slug.",
			})
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()

		property, err := services.GetPropertyBySlug(ctx, db, slug)

		if errors.Is(err, pgx.ErrNoRows) {
			writeJSON(w, http.StatusNotFound, map[string]string{
				"error": "Property not found.",
			})
			return
		}

		if err != nil {
			log.Printf("Could not fetch property %q: %v", slug, err)

			writeJSON(w, http.StatusInternalServerError, map[string]string{
				"error": "An unexpected server error occurred.",
			})
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"data": property,
		})
	}
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)

	if err := json.NewEncoder(w).Encode(body); err != nil {
		log.Printf("Could not write JSON response: %v", err)
	}
}