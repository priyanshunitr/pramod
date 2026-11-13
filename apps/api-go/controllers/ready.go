package controllers

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func ReadyHandler(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")

		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()

		status := http.StatusOK
		response := map[string]string{
			"status":   "ok",
			"database": "connected",
		}

		if err := db.Ping(ctx); err != nil {
			log.Printf("Readiness check failed: %v", err)

			status = http.StatusServiceUnavailable
			response["status"] = "unavailable"
			response["database"] = "disconnected"
		}

		w.WriteHeader(status)

		if err := json.NewEncoder(w).Encode(response); err != nil {
			log.Printf("Could not write readiness response: %v", err)
		}
	}
}