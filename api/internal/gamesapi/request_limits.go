package gamesapi

// MaxRequestBodyBytes is the one-MiB HTTP body limit enforced by active
// Chronicles auth, feedback, billing and run handlers.
const MaxRequestBodyBytes = 1 << 20
