package chroniclesmap

import (
	"reflect"
	"testing"
)

// Reference the former two-pool algorithm independently so seed compatibility
// is checked, not merely determinism of the new implementation.
func openExtraReference(grid [][]byte, count, target int, rng *xorshift32) (int, error) {
	for count < target {
		var all, loops []Point
		for y := 1; y < len(grid)-1; y++ {
			for x := 1; x < len(grid[0])-1; x++ {
				if grid[y][x] != '#' {
					continue
				}
				adjacent := 0
				for _, d := range cardinal {
					if grid[y+d.Y][x+d.X] != '#' {
						adjacent++
					}
				}
				if adjacent > 0 {
					all = append(all, Point{X: x, Y: y})
				}
				if adjacent >= 2 {
					loops = append(loops, Point{X: x, Y: y})
				}
			}
		}
		if len(all) == 0 {
			return 0, genErr("generator could not reach required walkable capacity")
		}
		if len(loops) > 0 {
			all = loops
		}
		p := all[rng.choice(len(all))]
		grid[p.Y][p.X] = '.'
		count++
	}
	return count, nil
}

func TestOpenExtraPreservesCandidateOrderAndRNG(t *testing.T) {
	for _, size := range [][2]int{{7, 7}, {8, 10}, {15, 11}, {19, 15}} {
		recipe := Recipe{Width: size[0], Height: size[1]}
		for seed := uint32(0); seed < 64; seed++ {
			a, b := newRNG(seed), newRNG(seed)
			original, count := carveMaze(recipe, a)
			actual, actualCount := carveMaze(recipe, b)
			capacity := (recipe.Width - 2) * (recipe.Height - 2)
			// Include partial openings; a fully open grid alone cannot detect
			// a change in selection order.
			target := count + int(seed)%(capacity-count+1)
			want, wantErr := openExtraReference(original, count, target, a)
			got, gotErr := openExtra(actual, actualCount, target, b)
			if wantErr != nil || gotErr != nil || got != want ||
				!reflect.DeepEqual(original, actual) || a.state != b.state {
				t.Fatalf("size %v seed %d: candidate selection differs: got %d/%v want %d/%v", size, seed, got, gotErr, want, wantErr)
			}
		}
	}
}
