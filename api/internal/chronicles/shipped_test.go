package chronicles

import "testing"

// Every map the game ships must load through the same validation the API
// applies when a run enters it; otherwise checkpoints there would fail.
func TestEveryShippedMapBuildsAnAreaEnvelope(t *testing.T) {
	ids := ShippedMapIDs()
	if len(ids) < 60 {
		t.Fatalf("only %d shipped maps", len(ids))
	}
	for _, id := range ids {
		envelope, err := AreaEnvelope(id, 12345, AreaOptions{})
		if err != nil {
			t.Errorf("%s: %v", id, err)
			continue
		}
		if envelope == nil {
			t.Errorf("%s: empty envelope", id)
		}
	}
}

// The temple floors are only reachable if each one lists the next as a
// transition target (the API refuses any other checkpoint move).
func TestTempleFloorsChainToTheThrone(t *testing.T) {
	chain := [][2]string{
		{"terra-f6", "templo-corona-atrio"},
		{"templo-corona-atrio", "templo-corona-cripta"},
		{"templo-corona-cripta", "templo-corona-trono"},
		{"templo-corona-trono", "templo-corona-cripta"},
		{"templo-corona-atrio", "terra-f6"},
	}
	for _, link := range chain {
		manifest, _, err := LoadManifest(link[0])
		if err != nil {
			t.Fatalf("%s: %v", link[0], err)
		}
		if !TransitionTargets(manifest)[link[1]] {
			t.Errorf("%s does not lead to %s", link[0], link[1])
		}
	}
}

func TestOnlyCanonicalSwordhavenIsShipped(t *testing.T) {
	const ids := ShippedMapIDs()
	canonical := 0
	for _, id := range ids {
		switch id {
		case "swordhaven-first-book":
			canonical++
		case "swordhaven-square", "swordhaven-campaign":
			t.Errorf("retired Swordhaven must not be shipped: %s", id)
		}
	}
	if canonical != 1 {
		t.Fatalf("expected one canonical Swordhaven, got %d", canonical)
	}
	for _, retired := range []string{"swordhaven-square", "swordhaven-campaign"} {
		if _, _, err := LoadManifest(retired); err != ErrMapNotFound {
			t.Errorf("%s should return ErrMapNotFound, got %v", retired, err)
		}
	}
	road, _, err := LoadManifest("banner-road")
	if err != nil {
		t.Fatal(err)
	}
	if !TransitionTargets(road)["swordhaven-first-book"] {
		t.Fatal("the legacy road must now return to canonical Swordhaven")
	}
}
