package chroniclesmap

import (
	"reflect"
	"testing"
)

// The former visited-map implementation is an independent seed-compatibility oracle.
func carveMazeReference(recipe Recipe, rng *xorshift32) ([][]byte, int) {
	grid := make([][]byte, recipe.Height)
	for y := range grid {
		grid[y] = make([]byte, recipe.Width)
		for x := range grid[y] {
			grid[y][x] = '#'
		}
	}
	start := Point{X: 1, Y: 1}
	grid[start.Y][start.X] = '.'
	visited := map[Point]bool{start: true}
	stack := []Point{start}
	count := 1
	for len(stack) > 0 {
		current := stack[len(stack)-1]
		var candidates []Point
		for _, step := range mazeSteps {
			next := Point{X: current.X + step.X, Y: current.Y + step.Y}
			if next.X < 1 || next.X >= recipe.Width-1 || next.Y < 1 || next.Y >= recipe.Height-1 || visited[next] {
				continue
			}
			candidates = append(candidates, next)
		}
		if len(candidates) == 0 {
			stack = stack[:len(stack)-1]
			continue
		}
		next := candidates[rng.choice(len(candidates))]
		grid[(current.Y+next.Y)/2][(current.X+next.X)/2] = '.'
		grid[next.Y][next.X] = '.'
		visited[next] = true
		stack = append(stack, next)
		count += 2
	}
	return grid, count
}

func TestMazeTraversalPreservesTopologyAndRandomState(t *testing.T) {
	for w := 7; w <= 19; w++ {
		for h := 7; h <= 15; h++ {
			for seed := uint32(0); seed < 8; seed++ {
				recipe := Recipe{Width: w, Height: h}
				a, b := newRNG(seed), newRNG(seed)
				want, wantCount := carveMazeReference(recipe, a)
				got, gotCount := carveMaze(recipe, b)
				if gotCount != wantCount || !reflect.DeepEqual(got, want) || a.state != b.state {
					t.Fatalf("%dx%d seed %d: changed maze or RNG state", w, h, seed)
				}
				reachable := distances(got, Point{X: 1, Y: 1})
				if len(reachable) != gotCount {
					t.Fatalf("%dx%d seed %d: disconnected maze", w, h, seed)
				}
				// Every non-root cell has a predecessor exactly one step closer.
				for p, d := range reachable {
					if p == (Point{X: 1, Y: 1}) {
						if d != 0 {
							t.Fatal("root distance must be zero")
						}
						continue
					}
					found := false
					for _, step := range cardinal {
						n := Point{X: p.X + step.X, Y: p.Y + step.Y}
						if nd, ok := reachable[n]; ok {
							if nd == d-1 {
								found = true
							}
							if nd < d-1 || nd > d+1 {
								t.Fatal("adjacent distance difference exceeds one")
							}
						}
					}
					if !found || d <= 0 {
						t.Fatalf("invalid distance %d for %v", d, p)
					}
				}
			}
		}
	}
}
