package services

import (
	"crypto/rand"
	"fmt"
	"time"

	"pramod/api-go/models"

	"github.com/golang-jwt/jwt/v5"
)

type accessClaims struct {
	Email    string `json:"email"`
	FullName string `json:"name"`
	jwt.RegisteredClaims
}

func (s *AuthService) IssueToken(
	user models.User,
) (string, time.Time, error) {
	issuedAt := time.Now().UTC().Truncate(time.Second)
	expiresAt := issuedAt.Add(s.ttl)

	// Generate a UUID v4 token identifier, matching the Express JWT format.
	var randomID [16]byte
	if _, err := rand.Read(randomID[:]); err != nil {
		return "", time.Time{}, err
	}

	randomID[6] = (randomID[6] & 0x0f) | 0x40
	randomID[8] = (randomID[8] & 0x3f) | 0x80

	tokenID := fmt.Sprintf(
		"%x-%x-%x-%x-%x",
		randomID[0:4],
		randomID[4:6],
		randomID[6:8],
		randomID[8:10],
		randomID[10:16],
	)

	claims := accessClaims{
		Email:    user.Email,
		FullName: user.FullName,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   user.ID,
			Issuer:    s.issuer,
			Audience:  jwt.ClaimStrings{s.audience},
			IssuedAt:  jwt.NewNumericDate(issuedAt),
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			ID:        tokenID,
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	token.Header["typ"] = "JWT"

	value, err := token.SignedString(s.key)
	if err != nil {
		return "", time.Time{}, err
	}

	return value, expiresAt, nil
}

func (s *AuthService) VerifyToken(value string) *models.Identity {
	if value == "" || len(value) > 4096 {
		return nil
	}

	var claims accessClaims

	token, err := jwt.ParseWithClaims(
		value,
		&claims,
		func(token *jwt.Token) (any, error) {
			return s.key, nil
		},
		jwt.WithValidMethods([]string{"HS256"}),
		jwt.WithIssuer(s.issuer),
		jwt.WithAudience(s.audience),
		jwt.WithExpirationRequired(),
		jwt.WithIssuedAt(),
	)
	if err != nil || !token.Valid || token.Header["typ"] != "JWT" {
		return nil
	}

	if claims.IssuedAt == nil || claims.ExpiresAt == nil {
		return nil
	}

	issuedAt := claims.IssuedAt.Unix()
	expiresAt := claims.ExpiresAt.Unix()
	now := time.Now().Unix()

	if issuedAt < 0 || issuedAt > now ||
		expiresAt <= now || expiresAt <= issuedAt ||
		expiresAt-issuedAt > int64(s.ttl/time.Second) {
		return nil
	}

	if !authUUIDPattern.MatchString(claims.Subject) ||
		!authUUIDPattern.MatchString(claims.ID) ||
		!validAuthEmail(claims.Email) {
		return nil
	}

	if length := authTextLength(claims.FullName); length < 2 || length > 100 {
		return nil
	}

	return &models.Identity{
		User: models.User{
			ID:       claims.Subject,
			Email:    claims.Email,
			FullName: claims.FullName,
		},
		ExpiresAt: claims.ExpiresAt.Time.UTC(),
	}
}