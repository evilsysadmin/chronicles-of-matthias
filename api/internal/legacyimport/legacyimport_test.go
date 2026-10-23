package legacyimport

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"

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
	if result != (Result{RunsFound: 2, RunsImported: 1, RunsKept: 1, Progression: "imported"}) {
		t.Fatalf("result %+v", result)
	}
	stored, _ := progression.Get(context.Background(), "ana")
	if TotalXP(stored.Document) != 300 || stored.Revision != 1 {
		t.Fatalf("stored %+v", stored)
	}
	// Running it again changes nothing.
	again, _ := Import(context.Background(), src, target, progression, "ana", time.Now())
	if again != (Result{RunsFound: 2, RunsKept: 2, Progression: "kept"}) {
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

type failingSource struct{ err error }

func (f failingSource) Runs(context.Context, string) ([]bson.D, error)      { return nil, f.err }
func (f failingSource) Progression(context.Context, string) (string, error) { return "", nil }

func TestImportNamesTheFailingStage(t *testing.T) {
	denied := mongo.CommandError{Code: 13, Name: "Unauthorized"}
	_, err := Import(context.Background(), failingSource{denied}, fakeRuns{}, chroniclesprogression.NewMemory(), "ana", time.Now())
	if err == nil || err.Error() != "legacy import failed at read-legacy-runs: unauthorized" {
		t.Fatalf("err %v", err)
	}
	_, err = Import(context.Background(), failingSource{context.DeadlineExceeded}, fakeRuns{}, chroniclesprogression.NewMemory(), "ana", time.Now())
	if err == nil || err.Error() != "legacy import failed at read-legacy-runs: timeout" {
		t.Fatalf("err %v", err)
	}
}

 
// A batch of 200 is not a hard owner limit: consume 201+ cursor records.
type fakeCursor struct {
	rows       []bson.D
	index      int
	failAfter  int // -1 = no failure
	readErr    error
	decodeAt   int // 1-based; zero = no failure
}

func (f *fakeCursor) Next(ctx context.Context) bool {
	if ctx.Err() != nil {
		f.readErr = ctx.Err()
		return false
	}
	if f.failAfter >= 0 && f.index == f.failAfter {
		return false
	}
	if f.index >= len(f.rows) {
		return false
	}
	f.index++
	return true
}

func (f *fakeCursor) Decode(dst any) error {
	if f.decodeAt == f.index {
		return errors.New("decode unavailable")
	}
	*dst.(*bson.D) = f.rows[f.index-1]
	return nil
}

func (f *fakeCursor) Err() error { return f.readErr }

func TestReadRunCursorNeverTruncatesAtBatchSize(t *testing.T) {
	for _, size := range []int{0, 1, 200, 201, 431} {
		t.Run(fmt.Sprint(size), func(t *testing.T) {
			rows := make([]bson.D, 0, size)
			for n := 0; n < size; n++ {
				rows = append(rows, run(fmt.Sprintf("legacy-%d", n)))
			}
			read, err := readRunCursor(context.Background(), &fakeCursor{rows: rows, failAfter: -1})
			if err != nil || len(read) != size {
				t.Fatalf("read %d of %d: %v", len(read), size, err)
			}
			target := fakeRuns{}
			result, err := Import(
				context.Background(), fakeSource{runs: read}, target,
				chroniclesprogression.NewMemory(), "ana", time.Now(),
			)
			if err != nil || result.RunsFound != size || result.RunsImported != size || len(target) != size {
				t.Fatalf("migration %+v for %d: %v", result, size, err)
			}
			repeated, err := Import(
				context.Background(), fakeSource{runs: read}, target,
				chroniclesprogression.NewMemory(), "ana", time.Now(),
			)
			if err != nil || repeated.RunsFound != size || repeated.RunsKept != size || repeated.RunsImported != 0 {
				t.Fatalf("idempotent replay %+v for %d: %v", repeated, size, err)
			}
		})
	}
}

func TestReadRunCursorFailsClosedOnPartialRead(t *testing.T) {
	rows := make([]bson.D, 205)
	for i := range rows {
		rows[i] = run(fmt.Sprintf("legacy-%d", i))
	}
	read, err := readRunCursor(context.Background(), &fakeCursor{
		rows: rows, failAfter: 200, readErr: errors.New("cursor unavailable"),
	})
	if err == nil || read != nil {
		t.Fatalf("incomplete read reported as complete: %d rows, %v", len(read), err)
	}
	read, err = readRunCursor(context.Background(), &fakeCursor{
		rows: rows, failAfter: -1, decodeAt: 201,
	})
	if err == nil || read != nil {
		t.Fatalf("decode failure reported as complete: %d rows, %v", len(read), err)
	}
	cancelled, cancel := context.WithCancel(context.Background())
	cancel()
	read, err = readRunCursor(cancelled, &fakeCursor{rows: rows, failAfter: -1})
	if !errors.Is(err, context.Canceled) || read != nil {
		t.Fatalf("cancelled read reported as complete: %d rows, %v", len(read), err)
	}
}
