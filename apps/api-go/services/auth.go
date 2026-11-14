package services

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode/utf16"

	"pramod/api-go/models"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrAuthInput = errors.New("invalid account details")

	ErrAccountExists = errors.New(
		"Unable to create an account with those details. Try signing in.",
	)

	ErrInvalidCredentials = errors.New(
		"Email or password is incorrect.",
	)
)

type AuthRateLimitError struct {
	RetryAfter int
}

func (e *AuthRateLimitError) Error() string {
	return "Too many attempts. Please try again later."
}

type AuthService struct {
	db       *pgxpool.Pool
	key      []byte
	issuer   string
	audience string
	ttl      time.Duration
}

var authEmailPattern = regexp.MustCompile(
	`^([A-Za-z0-9_'+\-]+\.)*[A-Za-z0-9_'+\-]*[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$`,
)

var authUUIDPattern = regexp.MustCompile(
	`(?i)^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`,
)

func NewAuthService(db *pgxpool.Pool) (*AuthService, error) {
	key, err := hex.DecodeString(os.Getenv("JWT_SECRET"))
	if err != nil || len(key) != 32 {
		return nil, errors.New(
			"JWT_SECRET must contain a 32-byte key encoded as 64 hexadecimal characters",
		)
	}

	seconds, err := strconv.Atoi(authEnv("JWT_TTL_SECONDS", "900"))
	if err != nil || seconds < 60 || seconds > 3600 {
		return nil, errors.New("JWT_TTL_SECONDS must be between 60 and 3600")
	}

	return &AuthService{
		db:       db,
		key:      key,
		issuer:   authEnv("JWT_ISSUER", "pramod-api"),
		audience: authEnv("JWT_AUDIENCE", "pramod-web"),
		ttl:      time.Duration(seconds) * time.Second,
	}, nil
}

func authEnv(name, fallback string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}
	return fallback
}

// Match JavaScript's string-length counting for existing account validation.
func authTextLength(value string) int {
	return len(utf16.Encode([]rune(value)))
}

func validAuthEmail(email string) bool {
	return len(email) <= 254 && authEmailPattern.MatchString(email)
}

func validateCredentials(
	email string,
	password string,
	minPasswordLength int,
) (string, error) {
	email = strings.ToLower(email)

	if !validAuthEmail(email) {
		return "", fmt.Errorf("%w: enter a valid email address", ErrAuthInput)
	}

	length := authTextLength(password)
	if length < minPasswordLength || length > 128 {
		return "", fmt.Errorf(
			"%w: password must contain %d–128 characters",
			ErrAuthInput,
			minPasswordLength,
		)
	}

	return email, nil
}

func (s *AuthService) Register(
	ctx context.Context,
	input models.RegisterInput,
	clientIP string,
) (*models.User, error) {
	email, err := validateCredentials(input.Email, input.Password, 15)
	if err != nil {
		return nil, err
	}

	name := strings.TrimSpace(input.FullName)
	if length := authTextLength(name); length < 2 || length > 100 {
		return nil, fmt.Errorf(
			"%w: full name must contain 2–100 characters",
			ErrAuthInput,
		)
	}

	if err := s.rateLimit(ctx, "register:"+clientIP, 10, 3600); err != nil {
		return nil, err
	}

	passwordHash, err := hashPassword(ctx, input.Password)
	if err != nil {
		return nil, err
	}

	var user models.User

	err = s.db.QueryRow(ctx, `
		INSERT INTO users (email, full_name, password_hash)
		VALUES ($1, $2, $3)
		ON CONFLICT DO NOTHING
		RETURNING id::text, email, full_name
	`, email, name, passwordHash).Scan(
		&user.ID,
		&user.Email,
		&user.FullName,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrAccountExists
	}
	if err != nil {
		return nil, err
	}

	// Registration deliberately creates no staff membership.
	return &user, nil
}

func (s *AuthService) Login(
	ctx context.Context,
	input models.LoginInput,
	clientIP string,
) (*models.User, error) {
	email, err := validateCredentials(input.Email, input.Password, 1)
	if err != nil {
		return nil, err
	}

	if err := s.rateLimit(ctx, "login-ip:"+clientIP, 30, 900); err != nil {
		return nil, err
	}
	if err := s.rateLimit(ctx, "login-email:"+email, 10, 900); err != nil {
		return nil, err
	}

	var user models.User
	var storedHash *string

	lookupErr := s.db.QueryRow(ctx, `
		SELECT id::text, email, full_name, password_hash
		FROM users
		WHERE lower(email) = $1
	`, email).Scan(
		&user.ID,
		&user.Email,
		&user.FullName,
		&storedHash,
	)

	if lookupErr != nil && !errors.Is(lookupErr, pgx.ErrNoRows) {
		return nil, lookupErr
	}

	encoded := ""
	if storedHash != nil {
		encoded = *storedHash
	}

	valid, err := verifyPassword(ctx, input.Password, encoded)
	if err != nil {
		return nil, err
	}
	if lookupErr != nil || !valid {
		return nil, ErrInvalidCredentials
	}

	return &user, nil
}

func (s *AuthService) Memberships(
	ctx context.Context,
	userID string,
) ([]models.Membership, error) {
	rows, err := s.db.Query(ctx, `
		SELECT p.id::text, p.name, p.slug, m.role
		FROM staff_memberships m
		JOIN properties p ON p.id = m.property_id
		WHERE m.user_id = $1 AND m.active
		ORDER BY p.name
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	memberships := make([]models.Membership, 0)

	for rows.Next() {
		var membership models.Membership

		if err := rows.Scan(
			&membership.PropertyID,
			&membership.PropertyName,
			&membership.Slug,
			&membership.Role,
		); err != nil {
			return nil, err
		}

		memberships = append(memberships, membership)
	}

	return memberships, rows.Err()
}

func (s *AuthService) rateLimit(
	ctx context.Context,
	key string,
	limit int,
	windowSeconds int,
) error {
	digest := sha256.Sum256([]byte(key))

	var attempts, retryAfter int

	err := s.db.QueryRow(ctx, `
		INSERT INTO rate_limits (key, attempts, resets_at)
		VALUES ($1, 1, now() + $2::int * interval '1 second')
		ON CONFLICT (key) DO UPDATE SET
			attempts = CASE
				WHEN rate_limits.resets_at <= now() THEN 1
				ELSE rate_limits.attempts + 1
			END,
			resets_at = CASE
				WHEN rate_limits.resets_at <= now()
					THEN EXCLUDED.resets_at
				ELSE rate_limits.resets_at
			END
		RETURNING
			attempts,
			GREATEST(
				1,
				CEIL(EXTRACT(EPOCH FROM (resets_at - now())))
			)::int
	`, hex.EncodeToString(digest[:]), windowSeconds).Scan(
		&attempts,
		&retryAfter,
	)
	if err != nil {
		return err
	}

	if attempts > limit {
		return &AuthRateLimitError{RetryAfter: retryAfter}
	}

	return nil
}