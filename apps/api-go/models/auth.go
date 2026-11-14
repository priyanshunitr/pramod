package models

import "time"

type User struct {
	ID       string `json:"id"`
	Email    string `json:"email"`
	FullName string `json:"fullName"`
}

type Membership struct {
	PropertyID   string `json:"propertyId"`
	PropertyName string `json:"propertyName"`
	Slug         string `json:"slug"`
	Role         string `json:"role"`
}

type Session struct {
	User        *User        `json:"user"`
	Memberships []Membership `json:"memberships"`
	ExpiresAt   *time.Time   `json:"expiresAt"`
}

type Identity struct {
	User      User
	ExpiresAt time.Time
}

type RegisterInput struct {
	FullName string `json:"fullName"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

type LoginInput struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}