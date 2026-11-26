package chronicles

import (
	"bytes"
	"crypto/sha256"
	"encoding/binary"
	"fmt"
	"reflect"
	"sort"
	"testing"
)

// Keep an independent reference to the pre-optimization ranking algorithm:
// campaign seeds must continue producing the exact same ordered map IDs.
func TestRoutePlanRankingPreservesSeedCompatibility(t *testing.T) {
	p, err := Policy()
	if err != nil {
		t.Fatal(err)
	}
	seeds := []int64{-9223372036854775808, -1, 0, 1, 9223372036854775807}
	for seed := int64(2); seed < 258; seed++ {
		seeds = append(seeds, seed)
	}
	for _, seed := range seeds {
		ranked := append([]string(nil), p.MapIDs...)
		keys := map[string][sha256.Size]byte{}
		for _, id := range ranked {
			keys[id] = sha256.Sum256([]byte(fmt.Sprintf("chronicles-route-v%d:%d:%s", p.Version, seed, id)))
		}
		sort.SliceStable(ranked, func(i, j int) bool {
			a, b := keys[ranked[i]], keys[ranked[j]]
			return bytes.Compare(a[:], b[:]) < 0
		})
		d := sha256.Sum256([]byte(fmt.Sprintf("chronicles-route-length-v%d:%d", p.Version, seed)))
		span := uint32(p.MaxRouteLength - p.MinRouteLength + 1)
		length := p.MinRouteLength + int64(binary.BigEndian.Uint32(d[:4])%span)
		want := append(ranked[:length-1:length-1], p.FinalMapID)
		got, err := RoutePlanForSeed(seed)
		if err != nil || !reflect.DeepEqual(got, want) {
			t.Fatalf("seed %d: route = %v, err = %v; want %v", seed, got, err, want)
		}
	}
}
