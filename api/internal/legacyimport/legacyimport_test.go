package legacyimport

import (
	"context"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"

	"github.com/evilsysadmin/chess-studio/backend-go/internal/chroniclesprogression"
)

type fakeSource struct {
	runs        []bson.D
	progression string
}

func (f fakeSource) Runs(context.Context, string) ([]bson.D, error)      { return f.runs, nil }
func (f fakeSource) Progression(context.Context, string) (string, error) { return f.progression, nil }

type fakeRuns map[string]bson.D

func (f fakeRuns) InsertIfAbsent(_ context.Context, run bson.D) (bool, error) {
	id := run[0].Value.(string)
	if _, ok := f[id]; ok {
		return false, nil
	}
	f[id] = run
	return true, nil
}

func run(id string) bson.D { return bson.D{{Key: "_id", Value: id}, {Key: "owner", Value: "ana"}} }

func TestImportCopiesRunsOnceAndProgression(t *testing.T) {
	src := fakeSource{runs: []bson.D{run("r1"), run("r2")}, progression: `{"heroes":{"matthias":{"xp":300}}}`}
	target := fakeRuns{"r2": run("r2")}
	progression := chroniclesprogression.NewMemory()
	result, err := Import(context.Background(), src, target, progression, "ana", time.Now())
	if err != nil {
		t.Fatal(err)
	}
	if result != (Result{RunsImported: 1, RunsKept: 1, Progression: "imported"}) {
		t.Fatalf("result %+v", result)
	}
	stored, _ := progression.Get(context.Background(), "ana")
	if TotalXP(stored.Document) != 300 || stored.Revision != 1 {
		t.Fatalf("stored %+v", stored)
	}
	// Running it again changes nothing.
	again, _ := Import(context.Background(), src, target, progression, "ana", time.Now())
	if again != (Result{RunsKept: 2, Progression: "kept"}) {
		t.Fatalf("again %+v", again)
	}
}

func TestImportKeepsAMoreAdvancedProgression(t *testing.T) {
	progression := chroniclesprogression.NewMemory()
	_, _ = progression.Put(context.Background(), "ana", `{"heroes":{"matthias":{"xp":900}}}`, 0, time.Now())
	src := fakeSource{progression: `{"heroes":{"matthias":{"xp":300}}}`}
	result, _ := Import(context.Background(), src, fakeRuns{}, progression, "ana", time.Now())
	if result.Progression != "kept" {
		t.Fatalf("result %+v", result)
	}
	src.progression = `{"heroes":{"matthias":{"xp":950}}}`
	result, _ = Import(context.Background(), src, fakeRuns{}, progression, "ana", time.Now())
	stored, _ := progression.Get(context.Background(), "ana")
	if result.Progression != "imported" || TotalXP(stored.Document) != 950 || stored.Revision != 2 {
		t.Fatalf("result %+v stored %+v", result, stored)
	}
}

func TestImportIgnoresMissingOrBrokenProgression(t *testing.T) {
	for _, raw := range []string{"", "not json", "[1,2]"} {
		result, err := Import(context.Background(), fakeSource{progression: raw}, fakeRuns{}, chroniclesprogression.NewMemory(), "ana", time.Now())
		if err != nil || result.Progression != "none" {
			t.Fatalf("%q: %+v %v", raw, result, err)
		}
	}
}
