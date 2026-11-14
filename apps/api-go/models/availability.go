package models

type Stay struct {
	CheckIn  string `json:"checkIn"`
	CheckOut string `json:"checkOut"`
	Guests   int    `json:"guests"`
}

type Availability struct {
	CheckIn   string              `json:"checkIn"`
	CheckOut  string              `json:"checkOut"`
	Guests    int                 `json:"guests"`
	Nights    int                 `json:"nights"`
	Currency  string              `json:"currency"`
	RoomTypes []AvailableRoomType `json:"roomTypes"`
}

type AvailableRoomType struct {
	ID               string `json:"id"`
	Name             string `json:"name"`
	MaxGuests        int    `json:"maxGuests"`
	NightlyRateMinor int64  `json:"nightlyRateMinor"`
	TotalMinor       int64  `json:"totalMinor"`
	AvailableRooms   int    `json:"availableRooms"`
}