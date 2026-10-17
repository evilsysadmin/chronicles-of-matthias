package main

import (
	"bytes"
	"testing"
)

func TestEveryCreatureIsDeterministicAndFitsItsCell(t *testing.T) {
	for _, c := range procedural {
		spec, ok := sheets[c.id]
		if !ok {
			t.Fatalf("%s has no sheet spec", c.id)
		}
		for _, pose := range []string{"idle", "attack"} {
			a, b := trim(c.draw(pose)), trim(c.draw(pose))
			if !bytes.Equal(a.Pix, b.Pix) {
				t.Fatalf("%s/%s is not deterministic", c.id, pose)
			}
			if a.Bounds().Dx() > spec.cell || a.Bounds().Dy() > spec.cell-2 {
				t.Fatalf("%s/%s (%v) does not fit cell %d", c.id, pose, a.Bounds().Size(), spec.cell)
			}
			if a.Bounds().Dx() < 20 || a.Bounds().Dy() < 20 {
				t.Fatalf("%s/%s is suspiciously small: %v", c.id, pose, a.Bounds().Size())
			}
		}
		idle := trim(c.draw("idle"))
		if d := dead(idle); d.Bounds().Dx() > spec.cell || d.Bounds().Dy() > spec.cell-2 {
			t.Fatalf("%s/dead does not fit cell %d", c.id, spec.cell)
		}
		if h := hurt(idle); h.Bounds().Dx() > spec.cell || h.Bounds().Dy() > spec.cell-2 {
			t.Fatalf("%s/hurt does not fit cell %d", c.id, spec.cell)
		}
	}
}
