package models

type Property struct {
	ID        string     `json:"id"`
	Name      string     `json:"name"`
	Slug      string     `json:"slug"`
	Currency  string     `json:"currency"`
	Timezone  string     `json:"timezone"`
	RoomTypes []RoomType `json:"roomTypes"`
}

type RoomType struct {
	ID               string `json:"id"`
	Name             string `json:"name"`
	Description      string `json:"description"`
	MaxGuests        int    `json:"maxGuests"`
	NightlyRateMinor *int   `json:"nightlyRateMinor"`
}