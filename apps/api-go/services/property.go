package services

import (
	"context"

	"pramod/api-go/models"

	"github.com/jackc/pgx/v5/pgxpool"
)

func GetPropertyBySlug(
	ctx context.Context,
	db *pgxpool.Pool,
	slug string,
) (*models.Property, error) {
	property := models.Property{
		RoomTypes: make([]models.RoomType, 0),
	}

	err := db.QueryRow(ctx, `
		SELECT id::text, name, slug, currency, timezone
		FROM properties
		WHERE slug = $1
	`, slug).Scan(
		&property.ID,
		&property.Name,
		&property.Slug,
		&property.Currency,
		&property.Timezone,
	)
	if err != nil {
		return nil, err
	}

	rows, err := db.Query(ctx, `
		SELECT id::text, name, description, max_guests, nightly_rate_minor
		FROM room_types
		WHERE property_id = $1
		ORDER BY max_guests, name
	`, property.ID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var roomType models.RoomType

		if err := rows.Scan(
			&roomType.ID,
			&roomType.Name,
			&roomType.Description,
			&roomType.MaxGuests,
			&roomType.NightlyRateMinor,
		); err != nil {
			return nil, err
		}

		property.RoomTypes = append(property.RoomTypes, roomType)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return &property, nil
}