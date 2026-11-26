//go:build unit

package domain

import "testing"

// Throwaway: fails on purpose to check the CI job summary.
func TestDeliberatelyFailsForTheSummaryCheck(t *testing.T) {
	t.Parallel()
	t.Fatal("deliberate failure")
}
