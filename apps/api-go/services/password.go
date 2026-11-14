package services

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"regexp"

	"golang.org/x/crypto/scrypt"
)

var passwordHashPattern = regexp.MustCompile(
	`^scrypt-v1:([a-f0-9]{32}):([a-f0-9]{128})$`,
)

// Bound concurrent password calculations because scrypt uses substantial memory.
var passwordSlots = make(chan struct{}, 2)

func derivePassword(
	ctx context.Context,
	password string,
	salt string,
) ([]byte, error) {
	select {
	case passwordSlots <- struct{}{}:
		defer func() { <-passwordSlots }()
	case <-ctx.Done():
		return nil, ctx.Err()
	}

	// Express uses the hex salt as TEXT, not decoded bytes.
	return scrypt.Key(
		[]byte(password),
		[]byte(salt),
		131072,
		8,
		1,
		64,
	)
}

func hashPassword(ctx context.Context, password string) (string, error) {
	saltBytes := make([]byte, 16)
	if _, err := rand.Read(saltBytes); err != nil {
		return "", err
	}

	salt := hex.EncodeToString(saltBytes)

	key, err := derivePassword(ctx, password, salt)
	if err != nil {
		return "", err
	}

	return "scrypt-v1:" + salt + ":" + hex.EncodeToString(key), nil
}

func verifyPassword(
	ctx context.Context,
	password string,
	encoded string,
) (bool, error) {
	salt := "00000000000000000000000000000000"
	expected := make([]byte, 64)

	matches := passwordHashPattern.FindStringSubmatch(encoded)
	valid := len(matches) == 3

	if valid {
		salt = matches[1]
		expected, _ = hex.DecodeString(matches[2])
	}

	key, err := derivePassword(ctx, password, salt)
	if err != nil {
		return false, err
	}

	equal := subtle.ConstantTimeCompare(key, expected) == 1
	return valid && equal, nil
}