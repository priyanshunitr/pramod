package services

import (
	"context"
	"errors"
	"fmt"
	"time"
	_ "time/tzdata"

	"pramod/api-go/models"

	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrInvalidStay = errors.New("invalid stay")

func GetAvailability(
	ctx context.Context,
	db *pgxpool.Pool,
	propertyID string,
	stay models.Stay,
) (*models.Availability, error) {
	if stay.Guests < 1 || stay.Guests > 6 {
		return nil, fmt.Errorf(
			"%w: guests must be between 1 and 6",
			ErrInvalidStay,
		)
	}

	const dateLayout = "2006-01-02"

	// Parse as UTC calendar dates so daylight-saving changes
	// do not affect the number of nights.
	checkIn, inErr := time.Parse(dateLayout, stay.CheckIn)
	checkOut, outErr := time.Parse(dateLayout, stay.CheckOut)

	if inErr != nil || outErr != nil ||
		checkIn.Format(dateLayout) != stay.CheckIn ||
		checkOut.Format(dateLayout) != stay.CheckOut {
		return nil, fmt.Errorf(
			"%w: use valid dates in YYYY-MM-DD format",
			ErrInvalidStay,
		)
	}

	if !checkOut.After(checkIn) ||
		checkOut.After(checkIn.AddDate(0, 0, 30)) {
		return nil, fmt.Errorf(
			"%w: choose a stay between 1 and 30 nights",
			ErrInvalidStay,
		)
	}

	var timezone, currency string

	err := db.QueryRow(ctx, `
		SELECT timezone, currency
		FROM properties
		WHERE id = $1
	`, propertyID).Scan(&timezone, &currency)
	if err != nil {
		return nil, err
	}

	location, err := time.LoadLocation(timezone)
	if err != nil {
		return nil, fmt.Errorf("load hotel timezone: %w", err)
	}

	today := time.Now().In(location).Format(dateLayout)

	if stay.CheckIn < today {
		return nil, fmt.Errorf(
			"%w: check-in cannot be in the past",
			ErrInvalidStay,
		)
	}

	nights := int(checkOut.Sub(checkIn) / (24 * time.Hour))

	result := models.Availability{
		CheckIn:   stay.CheckIn,
		CheckOut:  stay.CheckOut,
		Guests:    stay.Guests,
		Nights:    nights,
		Currency:  currency,
		RoomTypes: make([]models.AvailableRoomType, 0),
	}

	rows, err := db.Query(ctx, `
		SELECT
			t.id::text,
			t.name,
			t.max_guests,
			t.nightly_rate_minor,
			count(r.id)::int
		FROM room_types t
		LEFT JOIN rooms r
			ON r.room_type_id = t.id
			AND r.property_id = t.property_id
			AND r.operational_status = 'active'
			AND NOT EXISTS (
				SELECT 1
				FROM booking_rooms br
				WHERE br.room_id = r.id
					AND br.active
					AND daterange(br.check_in, br.check_out, '[)')
						&& daterange($2::date, $3::date, '[)')
			)
		WHERE t.property_id = $1
			AND t.max_guests >= $4
			AND t.nightly_rate_minor IS NOT NULL
		GROUP BY t.id
		ORDER BY t.max_guests, t.name
	`, propertyID, checkIn, checkOut, stay.Guests)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var roomType models.AvailableRoomType

		if err := rows.Scan(
			&roomType.ID,
			&roomType.Name,
			&roomType.MaxGuests,
			&roomType.NightlyRateMinor,
			&roomType.AvailableRooms,
		); err != nil {
			return nil, err
		}

		roomType.TotalMinor = roomType.NightlyRateMinor * int64(nights)

		result.RoomTypes = append(result.RoomTypes, roomType)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return &result, nil
}