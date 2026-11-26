package chronicles

import (
	"reflect"
	"testing"

	"go.mongodb.org/mongo-driver/v2/bson"

	"github.com/evilsysadmin/chess-studio/backend-go/internal/pydoc"
)

func TestSharedBSONCopyPreservesOrderAndNestedIsolation(t *testing.T) {
	original := bson.D{
		{Key: "z", Value: bson.A{bson.D{{Key: "nested", Value: "original"}}, int32(7)}},
		{Key: "a", Value: int64(9)},
		{Key: "z", Value: "duplicate"},
	}
	cloned := pydoc.DeepCopy(original).(bson.D)
	if !reflect.DeepEqual(original, cloned) {
		t.Fatal("copy changed document ordering, values or types")
	}
	cloned[0].Value.(bson.A)[0].(bson.D)[0].Value = "changed"
	cloned[0].Value.(bson.A)[1] = int32(8)
	cloned[1].Key = "changed"
	nested := original[0].Value.(bson.A)
	if nested[0].(bson.D)[0].Value != "original" || nested[1] != int32(7) || original[1].Key != "a" {
		t.Fatal("copy shares nested mutable BSON containers")
	}
}

func TestSharedBSONCopyPreservesEmptyContainerSemantics(t *testing.T) {
	var doc bson.D
	var arr bson.A
	if got := pydoc.DeepCopy(doc).(bson.D); got == nil || len(got) != 0 {
		t.Fatal("typed nil document must become a non-nil empty document")
	}
	if got := pydoc.DeepCopy(arr).(bson.A); got == nil || len(got) != 0 {
		t.Fatal("typed nil array must become a non-nil empty array")
	}
	if pydoc.DeepCopy(nil) != nil || pydoc.DeepCopy(int64(42)) != int64(42) {
		t.Fatal("scalar semantics changed")
	}
}
