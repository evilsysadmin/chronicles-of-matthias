package main

import (
	"strings"
	"testing"
)

func TestBuildIsDeterministicAndRoundTrips(t *testing.T) {
	first, second := buildAll(), buildAll()
	for id, m := range first {
		a, b := dump(m), dump(second[id])
		if a != b {
			t.Fatalf("%s differs between two builds", id)
		}
		if dump(parse(a)) != a {
			t.Fatalf("%s does not survive a parse/dump round trip", id)
		}
	}
}

func TestDumpMatchesPythonJSON(t *testing.T) {
	got := dump(obj("a", A{}, "b", obj(), "c", "ñ \"q\" \\ <&>\n", "d", 1.5, "e", 2.0, "f", A{1, true, nil}))
	want := "{\n  \"a\": [],\n  \"b\": {},\n  \"c\": \"ñ \\\"q\\\" \\\\ <&>\\n\",\n  \"d\": 1.5,\n  \"e\": 2.0,\n  \"f\": [\n    1,\n    true,\n    null\n  ]\n}"
	if got != want {
		t.Fatalf("got\n%s\nwant\n%s", got, want)
	}
}

func TestEveryGateArrivesSomewhere(t *testing.T) {
	root := repoRoot()
	manifests := buildAll()
	for id, m := range patchExisting(root) {
		manifests[id] = m
	}
	fixArrivals(root, manifests) // panics on a missing arrival exit
}

func TestTheFinalActHasThreeEndings(t *testing.T) {
	throne := buildThrone()
	endings := map[string]bool{}
	for _, raw := range throne.Arr("interactables") {
		text := dump(raw)
		for _, ending := range []string{"restored", "broken", "regency"} {
			if strings.Contains(text, `"value": "`+ending+`"`) {
				endings[ending] = true
			}
		}
	}
	if len(endings) != 3 {
		t.Fatalf("endings found: %v", endings)
	}
}
