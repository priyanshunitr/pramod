package controllers

import (
	"context"
	"errors"
	"log"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"time"

	"pramod/api-go/models"
	"pramod/api-go/services"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var availabilityPropertyIDPattern = regexp.MustCompile(
	`(?i)^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`,
)

func AvailabilityHandler(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		propertyID := r.PathValue("propertyId")

		if !availabilityPropertyIDPattern.MatchString(propertyID) {
			writeJSON(w, http.StatusBadRequest, map[string]string{
				"error": "Invalid property ID.",
			})
			return
		}

		query, err := url.ParseQuery(r.URL.RawQuery)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{
				"error": "Invalid query parameters.",
			})
			return
		}

		// Only accept these three parameters, each once.
		for key, values := range query {
			allowed := key == "checkIn" ||
				key == "checkOut" ||
				key == "guests"

			if !allowed || len(values) != 1 {
				writeJSON(w, http.StatusBadRequest, map[string]string{
					"error": "Provide checkIn, checkOut, and guests once each.",
				})
				return
			}
		}

		guests, err := strconv.Atoi(query.Get("guests"))
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{
				"error": "Guests must be a whole number between 1 and 6.",
			})
			return
		}

		stay := models.Stay{
			CheckIn:  query.Get("checkIn"),
			CheckOut: query.Get("checkOut"),
			Guests:   guests,
		}

		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()

		availability, err := services.GetAvailability(
			ctx,
			db,
			propertyID,
			stay,
		)

		switch {
		case errors.Is(err, services.ErrInvalidStay):
			writeJSON(w, http.StatusBadRequest, map[string]string{
				"error": err.Error(),
			})

		case errors.Is(err, pgx.ErrNoRows):
			writeJSON(w, http.StatusNotFound, map[string]string{
				"error": "Hotel not found.",
			})

		case err != nil:
			log.Printf(
				"Could not fetch availability for %q: %v",
				propertyID,
				err,
			)

			writeJSON(w, http.StatusInternalServerError, map[string]string{
				"error": "An unexpected server error occurred.",
			})

		default:
			writeJSON(w, http.StatusOK, map[string]any{
				"data": availability,
			})
		}
	}
}