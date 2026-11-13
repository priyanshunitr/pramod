package main

import (
	"encoding/json"
	"log"
	"net/http"
	"time"
	"github.com/joho/godotenv"
)

func main() {
	if err := godotenv.Load("../../.env"); err != nil {
		log.Printf("Could not load .env: %v", err)
		return
	}

	db, err := connectDB()
	if err != nil {
		log.Printf("Database connection failed: %v", err)
		return
	}
	defer db.Close()

	log.Println("Connected to PostgreSQL")


	mux := http.NewServeMux()

	mux.HandleFunc("GET /api/health", healthHandler)

	server := &http.Server{
		Addr:              "127.0.0.1:4001",
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
	}

	log.Printf("Starting hotel API on http://%s", server.Addr)

	if err := server.ListenAndServe(); err != nil {
		log.Printf("Server stopped: %v", err)
	}
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")

	response := map[string]string{
		"status":  "ok",
		"service": "hotel-api",
	}

	if err := json.NewEncoder(w).Encode(response); err != nil {
		log.Printf("Could not write health response: %v", err)
	}
}