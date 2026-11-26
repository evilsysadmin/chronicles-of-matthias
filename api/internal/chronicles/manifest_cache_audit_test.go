package chronicles

import (
	"errors"
	"fmt"
	"testing"
)

func TestMissingMapIDsDoNotPopulateManifestCache(t *testing.T) {
	for i := 0; i < 512; i++ {
		id := fmt.Sprintf("audit-nonexistent-map-%d", i)
		if isShipped(id) {
			t.Fatalf("test ID unexpectedly shipped: %s", id)
		}
		doc, revision, err := LoadManifest(id)
		if doc != nil || revision != "" || !errors.Is(err, ErrMapNotFound) {
			t.Fatalf("missing map %s: got %v, %q, %v", id, doc, revision, err)
		}
	}
	manifestMu.Lock()
	defer manifestMu.Unlock()
	for id := range manifestCache {
		if !isShipped(id) {
			t.Errorf("unshipped map retained in manifest cache: %s", id)
		}
	}
	if len(manifestCache) > len(ShippedMapIDs()) {
		t.Fatal("manifest cache exceeded embedded catalog size")
	}
}

func TestShippedMapCatalogCopyAndManifestIsolation(t *testing.T) {
	ids := ShippedMapIDs()
	if len(ids) == 0 {
		t.Fatal("embedded catalog is empty")
	}
	id := ids[0]
	ids[0] = "audit-mutated-map-id"
	if !isShipped(id) || isShipped(ids[0]) || ShippedMapIDs()[0] != id {
		t.Fatal("caller mutated canonical catalog")
	}
	first, rev, err := LoadManifest(id)
	if err != nil || len(first) == 0 || rev == "" {
		t.Fatalf("load shipped manifest: %q, %v", rev, err)
	}
	first[0].Key = "audit-mutated-key"
	second, secondRev, err := LoadManifest(id)
	if err != nil || len(second) == 0 || secondRev != rev || second[0].Key == first[0].Key {
		t.Fatalf("cached manifest changed after caller mutation: %q, %v", secondRev, err)
	}
}
