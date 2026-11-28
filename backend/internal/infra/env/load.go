// Package env loads the server configuration from environment variables.
package env

import (
	"errors"
	"fmt"
	"log/slog"
	"net/url"
	"os"
	"runtime"
	"strconv"
	"time"

	"github.com/apotourlyan/ludustudii/internal/infra/logging"
	"github.com/apotourlyan/ludustudii/internal/kit/password"
	"github.com/apotourlyan/ludustudii/internal/kit/ratelimit"
)

// Names of the environment variables read by Load.
const (
	EnvDBConnectionString    = "DB_CONNECTION"
	EnvDBMaxOpenConns        = "DB_MAX_OPEN_CONNS"
	EnvDBMaxIdleConns        = "DB_MAX_IDLE_CONNS"
	EnvDBConnMaxLifetime     = "DB_CONN_MAX_LIFETIME"
	EnvDBConnMaxIdleTime     = "DB_CONN_MAX_IDLE_TIME"
	EnvAppPort               = "APP_PORT"
	EnvAppReadTimeout        = "APP_READ_TIMEOUT"
	EnvAppWriteTimeout       = "APP_WRITE_TIMEOUT" // #nosec G101 -- Environment variable name, not a credential.
	EnvAppIdleTimeout        = "APP_IDLE_TIMEOUT"
	EnvAppShutdownTimeout    = "APP_SHUTDOWN_TIMEOUT"
	EnvAppShutdownDrainDelay = "APP_SHUTDOWN_DRAIN_DELAY"
	EnvAppAPIDocs            = "APP_API_DOCS"
	EnvLogLevel              = "LOG_LEVEL"
	EnvLogFormat             = "LOG_FORMAT"

	EnvAuthArgon2Memory           = "AUTH_ARGON2_MEMORY"
	EnvAuthArgon2Iterations       = "AUTH_ARGON2_ITERATIONS"
	EnvAuthArgon2Parallelism      = "AUTH_ARGON2_PARALLELISM"
	EnvAuthArgon2SaltLength       = "AUTH_ARGON2_SALT_LENGTH"
	EnvAuthArgon2KeyLength        = "AUTH_ARGON2_KEY_LENGTH"
	EnvAuthHashConcurrency        = "AUTH_HASH_CONCURRENCY"
	EnvAuthSessionIdleTimeout     = "AUTH_SESSION_IDLE_TIMEOUT"
	EnvAuthSessionAbsoluteTimeout = "AUTH_SESSION_ABSOLUTE_TIMEOUT"
	EnvAuthSessionTouchInterval   = "AUTH_SESSION_TOUCH_INTERVAL"
	EnvAuthSessionCleanupInterval = "AUTH_SESSION_CLEANUP_INTERVAL"
	EnvAuthLoginIPLimit           = "AUTH_LOGIN_IP_LIMIT"
	EnvAuthLoginAccountLimit      = "AUTH_LOGIN_ACCOUNT_LIMIT"
)

// Values Load uses for optional variables that are unset or empty.
const (
	DefaultDBMaxOpenConns        = 10
	DefaultDBMaxIdleConns        = 5
	DefaultDBConnMaxLifetime     = 30 * time.Minute
	DefaultDBConnMaxIdleTime     = 10 * time.Minute
	DefaultAppReadTimeout        = 5 * time.Second
	DefaultAppWriteTimeout       = 10 * time.Second
	DefaultAppIdleTimeout        = 90 * time.Second
	DefaultAppShutdownTimeout    = 15 * time.Second
	DefaultAppShutdownDrainDelay = 0 * time.Second
	DefaultAppAPIDocs            = false
	DefaultLogLevel              = slog.LevelInfo
	DefaultLogFormat             = logging.FormatJSON

	// The argon2id parameters are OWASP's minimum recommendation.
	DefaultAuthArgon2Memory           = 19456 // KiB
	DefaultAuthArgon2Iterations       = 2
	DefaultAuthArgon2Parallelism      = 1
	DefaultAuthArgon2SaltLength       = 16
	DefaultAuthArgon2KeyLength        = 32
	DefaultAuthSessionIdleTimeout     = 7 * 24 * time.Hour
	DefaultAuthSessionAbsoluteTimeout = 30 * 24 * time.Hour
	DefaultAuthSessionTouchInterval   = time.Minute
	DefaultAuthSessionCleanupInterval = time.Hour
)

// Defaults Load uses for optional variables whose value isn't a constant.
var (
	// DefaultAuthHashConcurrency is the number of CPUs, read at startup.
	DefaultAuthHashConcurrency = runtime.NumCPU()
	DefaultAuthLoginIPLimit    = ratelimit.Limit{Count: 10, Per: time.Minute}
	// DefaultAuthLoginAccountLimit counts failed logins only.
	DefaultAuthLoginAccountLimit = ratelimit.Limit{Count: 5, Per: 15 * time.Minute}
)

// Vars holds the configuration read by Load. Field names mirror the Env
// constants.
type Vars struct {
	DBConnectionString    string
	DBMaxOpenConns        int
	DBMaxIdleConns        int
	DBConnMaxLifetime     time.Duration
	DBConnMaxIdleTime     time.Duration
	AppPort               string
	AppReadTimeout        time.Duration
	AppWriteTimeout       time.Duration
	AppIdleTimeout        time.Duration
	AppShutdownTimeout    time.Duration
	AppShutdownDrainDelay time.Duration
	AppAPIDocs            bool
	LogLevel              *slog.LevelVar
	LogFormat             logging.Format

	AuthArgon2Memory           uint32
	AuthArgon2Iterations       uint32
	AuthArgon2Parallelism      uint8
	AuthArgon2SaltLength       uint32
	AuthArgon2KeyLength        uint32
	AuthHashConcurrency        int
	AuthSessionIdleTimeout     time.Duration
	AuthSessionAbsoluteTimeout time.Duration
	AuthSessionTouchInterval   time.Duration
	AuthSessionCleanupInterval time.Duration
	AuthLoginIPLimit           ratelimit.Limit
	AuthLoginAccountLimit      ratelimit.Limit
}

// PasswordParams returns the argon2id parameters from the AUTH_ARGON2_
// variables.
func (v *Vars) PasswordParams() password.Params {
	return password.Params{
		Memory:      v.AuthArgon2Memory,
		Iterations:  v.AuthArgon2Iterations,
		Parallelism: v.AuthArgon2Parallelism,
		SaltLength:  v.AuthArgon2SaltLength,
		KeyLength:   v.AuthArgon2KeyLength,
	}
}

// Load reads the configuration from the environment. DB_CONNECTION and
// APP_PORT are required, and DB_CONNECTION must be a postgres:// or
// postgresql:// URL. APP_PORT must be a decimal port from 1 to 65535.
// The other variables are optional and fall back to the Default constants.
// Durations use time.ParseDuration syntax, booleans use
// strconv.ParseBool syntax (such as "true" or "0"), LOG_LEVEL uses slog.Level
// names (such as "debug" or "warn") and LOG_FORMAT is "json" or "text". The
// AUTH_ durations must be positive, AUTH_HASH_CONCURRENCY at least 1, the
// argon2id parameters within the bounds of password.Params, and the limits
// "<count>/<duration>", such as "10/1m". Load reports every invalid or
// missing variable, joined into one error.
func Load() (*Vars, error) {
	var errs []error

	dbConnectionString := os.Getenv(EnvDBConnectionString)
	if dbConnectionString == "" {
		errs = append(errs, fmt.Errorf("get env %s: not set", EnvDBConnectionString))
	}

	dbURL, err := url.Parse(dbConnectionString)
	if err == nil && dbURL.Scheme != "postgres" && dbURL.Scheme != "postgresql" {
		err = fmt.Errorf("want scheme 'postgres://', got scheme %q", dbURL.Scheme)
	}
	if err != nil {
		errs = append(errs, fmt.Errorf("parse env %s: %w", EnvDBConnectionString, err))
	}

	dbMaxOpenConns, err := getEnvInt(EnvDBMaxOpenConns, DefaultDBMaxOpenConns)
	errs = append(errs, err)

	dbMaxIdleConns, err := getEnvInt(EnvDBMaxIdleConns, DefaultDBMaxIdleConns)
	errs = append(errs, err)

	dbConnMaxLifetime, err := getEnvDuration(EnvDBConnMaxLifetime, DefaultDBConnMaxLifetime)
	errs = append(errs, err)

	dbConnMaxIdleTime, err := getEnvDuration(EnvDBConnMaxIdleTime, DefaultDBConnMaxIdleTime)
	errs = append(errs, err)

	appPort, err := getEnvPort(EnvAppPort)
	errs = append(errs, err)

	appReadTimeout, err := getEnvDuration(EnvAppReadTimeout, DefaultAppReadTimeout)
	errs = append(errs, err)

	appWriteTimeout, err := getEnvDuration(EnvAppWriteTimeout, DefaultAppWriteTimeout)
	errs = append(errs, err)

	appIdleTimeout, err := getEnvDuration(EnvAppIdleTimeout, DefaultAppIdleTimeout)
	errs = append(errs, err)

	appShutdownTimeout, err := getEnvDuration(EnvAppShutdownTimeout, DefaultAppShutdownTimeout)
	errs = append(errs, err)

	appShutdownDrainDelay, err := getEnvDuration(EnvAppShutdownDrainDelay, DefaultAppShutdownDrainDelay)
	errs = append(errs, err)

	appAPIDocs, err := getEnvBool(EnvAppAPIDocs, DefaultAppAPIDocs)
	errs = append(errs, err)

	logLevel, err := getEnvLevel(EnvLogLevel, DefaultLogLevel)
	errs = append(errs, err)

	logFormat, err := getEnvFormat(EnvLogFormat, DefaultLogFormat)
	errs = append(errs, err)

	auth, err := loadAuth()
	errs = append(errs, err)

	if err := errors.Join(errs...); err != nil {
		return nil, err
	}

	v := &Vars{
		DBConnectionString:    dbConnectionString,
		DBMaxOpenConns:        dbMaxOpenConns,
		DBMaxIdleConns:        dbMaxIdleConns,
		DBConnMaxLifetime:     dbConnMaxLifetime,
		DBConnMaxIdleTime:     dbConnMaxIdleTime,
		AppPort:               appPort,
		AppReadTimeout:        appReadTimeout,
		AppWriteTimeout:       appWriteTimeout,
		AppIdleTimeout:        appIdleTimeout,
		AppShutdownTimeout:    appShutdownTimeout,
		AppShutdownDrainDelay: appShutdownDrainDelay,
		AppAPIDocs:            appAPIDocs,
		LogLevel:              logLevel,
		LogFormat:             logFormat,
	}
	auth.into(v)
	return v, nil
}

// authVars are the AUTH_ variables, loaded together so the argon2id
// parameters can be checked as a whole.
type authVars struct {
	argon2                         password.Params
	hashConcurrency                int
	idle, absolute, touch, cleanup time.Duration
	loginIP, loginAccount          ratelimit.Limit
}

func loadAuth() (authVars, error) {
	var a authVars
	var errs []error
	var err error

	a.argon2.Memory, err = getEnvUint32(EnvAuthArgon2Memory, DefaultAuthArgon2Memory)
	errs = append(errs, err)
	a.argon2.Iterations, err = getEnvUint32(EnvAuthArgon2Iterations, DefaultAuthArgon2Iterations)
	errs = append(errs, err)
	parallelism, err := getEnvUint32(EnvAuthArgon2Parallelism, DefaultAuthArgon2Parallelism)
	if err == nil && parallelism > 255 {
		err = fmt.Errorf("parse env %s: must be at most 255", EnvAuthArgon2Parallelism)
	}
	errs = append(errs, err)
	a.argon2.Parallelism = uint8(min(parallelism, 255)) // #nosec G115 -- Capped at 255 above.
	a.argon2.SaltLength, err = getEnvUint32(EnvAuthArgon2SaltLength, DefaultAuthArgon2SaltLength)
	errs = append(errs, err)
	a.argon2.KeyLength, err = getEnvUint32(EnvAuthArgon2KeyLength, DefaultAuthArgon2KeyLength)
	errs = append(errs, err)
	if err := errors.Join(errs...); err == nil {
		if err := a.argon2.Validate(); err != nil {
			errs = append(errs, fmt.Errorf("env AUTH_ARGON2_*: %w", err))
		}
	}

	a.hashConcurrency, err = getEnvInt(EnvAuthHashConcurrency, DefaultAuthHashConcurrency)
	if err == nil && a.hashConcurrency < 1 {
		err = fmt.Errorf("parse env %s: must be at least 1", EnvAuthHashConcurrency)
	}
	errs = append(errs, err)

	a.idle, err = getEnvPositiveDuration(EnvAuthSessionIdleTimeout, DefaultAuthSessionIdleTimeout)
	errs = append(errs, err)
	a.absolute, err = getEnvPositiveDuration(EnvAuthSessionAbsoluteTimeout, DefaultAuthSessionAbsoluteTimeout)
	errs = append(errs, err)
	a.touch, err = getEnvPositiveDuration(EnvAuthSessionTouchInterval, DefaultAuthSessionTouchInterval)
	errs = append(errs, err)
	a.cleanup, err = getEnvPositiveDuration(EnvAuthSessionCleanupInterval, DefaultAuthSessionCleanupInterval)
	errs = append(errs, err)

	a.loginIP, err = getEnvLimit(EnvAuthLoginIPLimit, DefaultAuthLoginIPLimit)
	errs = append(errs, err)
	a.loginAccount, err = getEnvLimit(EnvAuthLoginAccountLimit, DefaultAuthLoginAccountLimit)
	errs = append(errs, err)

	return a, errors.Join(errs...)
}

func (a authVars) into(v *Vars) {
	v.AuthArgon2Memory = a.argon2.Memory
	v.AuthArgon2Iterations = a.argon2.Iterations
	v.AuthArgon2Parallelism = a.argon2.Parallelism
	v.AuthArgon2SaltLength = a.argon2.SaltLength
	v.AuthArgon2KeyLength = a.argon2.KeyLength
	v.AuthHashConcurrency = a.hashConcurrency
	v.AuthSessionIdleTimeout = a.idle
	v.AuthSessionAbsoluteTimeout = a.absolute
	v.AuthSessionTouchInterval = a.touch
	v.AuthSessionCleanupInterval = a.cleanup
	v.AuthLoginIPLimit = a.loginIP
	v.AuthLoginAccountLimit = a.loginAccount
}

// LogAttrs returns the loaded values as log attrs keyed by environment variable name. The
// database password is redacted, whether it is in the URL's user info or in a
// "password" query parameter.
//
//nolint:sloglint // Preserve the exact environment variable names as log keys.
func (v *Vars) LogAttrs() []slog.Attr {
	dbConnectionString := v.DBConnectionString
	if dbURL, err := url.Parse(dbConnectionString); err == nil {
		if q := dbURL.Query(); q.Has("password") {
			q.Set("password", "xxxxx")
			dbURL.RawQuery = q.Encode()
		}
		dbConnectionString = dbURL.Redacted()
	}
	return []slog.Attr{
		slog.String(EnvDBConnectionString, dbConnectionString),
		slog.Int(EnvDBMaxOpenConns, v.DBMaxOpenConns),
		slog.Int(EnvDBMaxIdleConns, v.DBMaxIdleConns),
		slog.Duration(EnvDBConnMaxLifetime, v.DBConnMaxLifetime),
		slog.Duration(EnvDBConnMaxIdleTime, v.DBConnMaxIdleTime),
		slog.String(EnvAppPort, v.AppPort),
		slog.Duration(EnvAppReadTimeout, v.AppReadTimeout),
		slog.Duration(EnvAppWriteTimeout, v.AppWriteTimeout),
		slog.Duration(EnvAppIdleTimeout, v.AppIdleTimeout),
		slog.Duration(EnvAppShutdownTimeout, v.AppShutdownTimeout),
		slog.Duration(EnvAppShutdownDrainDelay, v.AppShutdownDrainDelay),
		slog.Bool(EnvAppAPIDocs, v.AppAPIDocs),
		slog.String(EnvLogLevel, v.LogLevel.Level().String()),
		slog.String(EnvLogFormat, v.LogFormat.String()),
		slog.Uint64(EnvAuthArgon2Memory, uint64(v.AuthArgon2Memory)),
		slog.Uint64(EnvAuthArgon2Iterations, uint64(v.AuthArgon2Iterations)),
		slog.Uint64(EnvAuthArgon2Parallelism, uint64(v.AuthArgon2Parallelism)),
		slog.Uint64(EnvAuthArgon2SaltLength, uint64(v.AuthArgon2SaltLength)),
		slog.Uint64(EnvAuthArgon2KeyLength, uint64(v.AuthArgon2KeyLength)),
		slog.Int(EnvAuthHashConcurrency, v.AuthHashConcurrency),
		slog.Duration(EnvAuthSessionIdleTimeout, v.AuthSessionIdleTimeout),
		slog.Duration(EnvAuthSessionAbsoluteTimeout, v.AuthSessionAbsoluteTimeout),
		slog.Duration(EnvAuthSessionTouchInterval, v.AuthSessionTouchInterval),
		slog.Duration(EnvAuthSessionCleanupInterval, v.AuthSessionCleanupInterval),
		slog.String(EnvAuthLoginIPLimit, v.AuthLoginIPLimit.String()),
		slog.String(EnvAuthLoginAccountLimit, v.AuthLoginAccountLimit.String()),
	}
}

func getEnvPort(key string) (string, error) {
	valueStr := os.Getenv(key)
	if valueStr == "" {
		return "", fmt.Errorf("get env %s: not set", key)
	}
	port, err := strconv.ParseUint(valueStr, 10, 16)
	if err != nil || port == 0 {
		return "", fmt.Errorf("parse env %s: must be a decimal port between 1 and 65535", key)
	}
	return strconv.FormatUint(port, 10), nil
}

func getEnvInt(key string, defaultValue int) (int, error) {
	valueStr := os.Getenv(key)
	if valueStr == "" {
		return defaultValue, nil
	}
	value, err := strconv.Atoi(valueStr)
	if err != nil {
		return 0, fmt.Errorf("parse env %s: %w", key, err)
	}
	return value, nil
}

func getEnvUint32(key string, defaultValue uint32) (uint32, error) {
	valueStr := os.Getenv(key)
	if valueStr == "" {
		return defaultValue, nil
	}
	value, err := strconv.ParseUint(valueStr, 10, 32)
	if err != nil {
		return 0, fmt.Errorf("parse env %s: %w", key, err)
	}
	return uint32(value), nil // #nosec G115 -- Parsed with a 32-bit limit.
}

func getEnvPositiveDuration(key string, defaultValue time.Duration) (time.Duration, error) {
	value, err := getEnvDuration(key, defaultValue)
	if err == nil && value <= 0 {
		return 0, fmt.Errorf("parse env %s: must be positive", key)
	}
	return value, err
}

func getEnvLimit(key string, defaultValue ratelimit.Limit) (ratelimit.Limit, error) {
	valueStr := os.Getenv(key)
	if valueStr == "" {
		return defaultValue, nil
	}
	value, err := ratelimit.ParseLimit(valueStr)
	if err != nil {
		return ratelimit.Limit{}, fmt.Errorf("parse env %s: %w", key, err)
	}
	return value, nil
}

func getEnvDuration(key string, defaultValue time.Duration) (time.Duration, error) {
	valueStr := os.Getenv(key)
	if valueStr == "" {
		return defaultValue, nil
	}
	value, err := time.ParseDuration(valueStr)
	if err != nil {
		return 0, fmt.Errorf("parse env %s: %w", key, err)
	}
	return value, nil
}

func getEnvBool(key string, defaultValue bool) (bool, error) {
	valueStr := os.Getenv(key)
	if valueStr == "" {
		return defaultValue, nil
	}
	value, err := strconv.ParseBool(valueStr)
	if err != nil {
		return false, fmt.Errorf("parse env %s: %w", key, err)
	}
	return value, nil
}

func getEnvLevel(key string, defaultValue slog.Level) (*slog.LevelVar, error) {
	var value slog.LevelVar
	valueStr := os.Getenv(key)
	if valueStr == "" {
		value.Set(defaultValue)
		return &value, nil
	}
	if err := value.UnmarshalText([]byte(valueStr)); err != nil {
		return nil, fmt.Errorf("parse env %s: %w", key, err)
	}
	return &value, nil
}

func getEnvFormat(key string, defaultValue logging.Format) (logging.Format, error) {
	valueStr := os.Getenv(key)
	if valueStr == "" {
		return defaultValue, nil
	}
	var value logging.Format
	if err := value.UnmarshalText([]byte(valueStr)); err != nil {
		return 0, fmt.Errorf("parse env %s: %w", key, err)
	}
	return value, nil
}
