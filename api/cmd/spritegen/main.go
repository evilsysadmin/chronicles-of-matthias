// Command spritegen draws Chronicles' procedural creatures and packs every
// 2.5D billboard into the runtime sprite sheets.
//
//	cd api && go run ./cmd/spritegen            # draw + pack
//	cd api && go run ./cmd/spritegen -preview x.png
//
// Sources live in scripts/art/chronicles_sprites/source as
// `<sprite>.<pose>.png` (poses idle, attack, hurt, dead, and for some
// painted sprites menace, speak, grateful). Painted SpriteCook sources are
// committed as they came (provenance in spritecook-assets.json); procedural
// ones are drawn here. Each sheet is one row of square cells: every pose
// keeps its art-pixel scale, feet on the floor of the cell and centred, and
// the row is upscaled ×2 nearest-neighbour so the pixel grid survives.
// `idle-b` is derived from idle as a one-row breathing squash. Output is
// lossless WebP plus sprites.json, which the game reads for frame ids,
// world height and idle speed. Deterministic: same inputs → same bytes.
package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"image"
	"image/draw"
	"image/png"
	"math"
	"os"
	"path/filepath"
	"sort"

	"github.com/HugoSmits86/nativewebp"
)

const (
	sourceDir   = "scripts/art/chronicles_sprites/source"
	proceduralJ = "scripts/art/chronicles_sprites/procedural-sprites.json"
	outDir      = "frontend/src/assets/chronicles/sprites"
	upscale     = 2
)

type frame struct {
	id, pose string // pose "" = derived breathing frame
	scale    float64
}

type sheet struct {
	cell        int
	frames      []frame
	worldHeight float64
	idleFps     float64
}

func standard(cell int, worldHeight, idleFps float64) sheet {
	return sheet{cell: cell, worldHeight: worldHeight, idleFps: idleFps, frames: []frame{
		{"idle-a", "idle", 0}, {"idle-b", "", 0}, {"attack", "attack", 0}, {"hurt", "hurt", 0}, {"dead", "dead", 0},
	}}
}

var sheets = map[string]sheet{
	"bone-hound": {cell: 160, worldHeight: 2.8, idleFps: 2.2, frames: []frame{
		{"idle-a", "idle", 0}, {"idle-b", "", 0}, {"menace", "menace", 0}, {"attack", "attack", 0}, {"hurt", "hurt", 0}, {"dead", "dead", 0}}},
	"rookwood-mourner": {cell: 200, worldHeight: 2.6, idleFps: 1.3, frames: []frame{
		{"idle-a", "idle", 0}, {"idle-b", "", 0}, {"speak", "speak", 0}, {"grateful", "grateful", 0}}},
	"road-bandit": {cell: 168, worldHeight: 2.55, idleFps: 1.8, frames: []frame{
		{"idle-a", "idle", 0}, {"idle-b", "", 0}, {"attack", "attack", 1.22}, {"hurt", "hurt", 0}, {"dead", "dead", 0}}},
	"bandit-captain": {cell: 256, worldHeight: 3.15, idleFps: 1.4, frames: []frame{
		{"idle-a", "idle", 0}, {"idle-b", "", 0}, {"attack", "attack", 0}, {"hurt", "hurt", 0}, {"dead", "dead", 0}}},
	"weaver-spider": {cell: 152, worldHeight: 2.3, idleFps: 2.6, frames: []frame{
		{"idle-a", "idle", 0}, {"idle-b", "", 0}, {"attack", "attack", 0}, {"dead", "dead", 0}}},
	// Procedural creatures (creatures.go).
	"sewer-rat":         standard(84, 1.7, 2.6),
	"ash-goblin":        standard(88, 2.2, 2.2),
	"salt-crab":         standard(92, 2.0, 1.8),
	"drowned":           standard(96, 2.75, 1.2),
	"mire-witch":        standard(104, 3.0, 1.4),
	"silent-acolyte":    standard(100, 2.7, 1.3),
	"oathbound-knight":  standard(108, 3.1, 1.1),
	"chancellor-varren": standard(116, 3.3, 1.2),
	"skeleton":          standard(100, 2.7, 1.6),
	"harpy":             standard(108, 2.6, 2.4),
	"troll":             standard(124, 3.6, 1.0),
	"ice-wraith":        standard(104, 3.0, 1.5),
	"ash-salamander":    standard(108, 1.9, 2.0),
	"bog-toad":          standard(100, 2.0, 1.4),
}

func repoRoot() string {
	dir, _ := os.Getwd()
	for {
		if _, err := os.Stat(filepath.Join(dir, sourceDir)); err == nil {
			return dir
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			panic("spritegen: run it inside the chronicles-of-matthias repository")
		}
		dir = parent
	}
}

func must(err error) {
	if err != nil {
		panic(err)
	}
}

func writePNG(path string, img image.Image) {
	var b bytes.Buffer
	must((&png.Encoder{CompressionLevel: png.BestCompression}).Encode(&b, img))
	must(os.WriteFile(path, b.Bytes(), 0o644))
}

func readPNG(path string) *image.NRGBA {
	f, err := os.Open(path)
	must(err)
	defer f.Close()
	src, err := png.Decode(f)
	must(err)
	out := image.NewNRGBA(image.Rect(0, 0, src.Bounds().Dx(), src.Bounds().Dy()))
	draw.Draw(out, out.Bounds(), src, src.Bounds().Min, draw.Src)
	return out
}

// breathe drops two evenly spaced rows from the upper 55% (chest/shoulders).
func breathe(src *image.NRGBA) *image.NRGBA {
	w, h := src.Bounds().Dx(), src.Bounds().Dy()
	band := int(float64(h) * 0.55)
	drop := map[int]bool{}
	for i := 0; i < 2; i++ {
		drop[int(math.RoundToEven(float64(band)*float64(i+1)/3))] = true
	}
	out := image.NewNRGBA(image.Rect(0, 0, w, h-len(drop)))
	row := 0
	for y := 0; y < h; y++ {
		if drop[y] {
			continue
		}
		copy(out.Pix[row*out.Stride:row*out.Stride+w*4], src.Pix[y*src.Stride:y*src.Stride+w*4])
		row++
	}
	return out
}

func resizeNearest(src *image.NRGBA, w, h int) *image.NRGBA {
	out := image.NewNRGBA(image.Rect(0, 0, w, h))
	sw, sh := src.Bounds().Dx(), src.Bounds().Dy()
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			out.SetNRGBA(x, y, src.NRGBAAt(x*sw/w, y*sh/h))
		}
	}
	return out
}

func place(img *image.NRGBA, cell int, name string) *image.NRGBA {
	w, h := img.Bounds().Dx(), img.Bounds().Dy()
	if w > cell || h > cell-2 {
		panic(fmt.Sprintf("%s: pose %dx%d does not fit cell %d", name, w, h, cell))
	}
	canvas := image.NewNRGBA(image.Rect(0, 0, cell, cell))
	at := image.Pt((cell-w)/2, cell-h-2)
	draw.Draw(canvas, image.Rectangle{Min: at, Max: at.Add(image.Pt(w, h))}, img, image.Point{}, draw.Src)
	return canvas
}

type manifestEntry struct {
	Frames      []string `json:"frames"`
	FramePx     int      `json:"framePx"`
	PixelArt    bool     `json:"pixelArt"`
	WorldHeight float64  `json:"worldHeight"`
	IdleFps     float64  `json:"idleFps"`
}

func drawProcedural(root string, preview string) {
	var rows [][]*image.NRGBA
	names := make([]string, 0, len(procedural))
	for _, c := range procedural {
		idle := trim(c.draw("idle"))
		poses := map[string]*image.NRGBA{"idle": idle, "attack": trim(c.draw("attack")), "hurt": hurt(idle), "dead": dead(idle)}
		for _, pose := range []string{"idle", "attack", "hurt", "dead"} {
			writePNG(filepath.Join(root, sourceDir, c.id+"."+pose+".png"), poses[pose])
		}
		rows = append(rows, []*image.NRGBA{poses["idle"], poses["attack"], poses["hurt"], poses["dead"]})
		names = append(names, c.id)
	}
	sort.Strings(names)
	text, _ := json.MarshalIndent(map[string]any{
		"_comment": "Creatures drawn by api/cmd/spritegen (creatures.go): placeholders until painted SpriteCook art replaces them.",
		"sprites":  names,
	}, "", "  ")
	must(os.WriteFile(filepath.Join(root, proceduralJ), append(text, '\n'), 0o644))
	if preview != "" {
		const cell = 130
		out := image.NewNRGBA(image.Rect(0, 0, cell*4*3, cell*3*len(rows)))
		draw.Draw(out, out.Bounds(), image.NewUniform(hex(0x3c3c40)), image.Point{}, draw.Src)
		for r, images := range rows {
			for c, img := range images {
				big := resizeNearest(img, img.Bounds().Dx()*3, img.Bounds().Dy()*3)
				at := image.Pt(c*cell*3, r*cell*3)
				draw.Draw(out, image.Rectangle{Min: at, Max: at.Add(big.Bounds().Size())}, big, image.Point{}, draw.Over)
			}
		}
		writePNG(preview, out)
	}
}

// pack writes the sheets. Painted sheets were packed once from their
// SpriteCook sources and stay as committed (re-encoding them in pure Go
// makes them bigger); -all repacks them too.
func pack(root string, all bool) {
	manifest := map[string]manifestEntry{}
	drawn := map[string]bool{}
	for _, c := range procedural {
		drawn[c.id] = true
	}
	for _, name := range sortedKeys(sheets) {
		spec := sheets[name]
		ids := make([]string, 0, len(spec.frames))
		for _, f := range spec.frames {
			ids = append(ids, f.id)
		}
		manifest[name] = manifestEntry{Frames: ids, FramePx: spec.cell * upscale, PixelArt: true,
			WorldHeight: spec.worldHeight, IdleFps: spec.idleFps}
		if !all && !drawn[name] {
			continue
		}
		idle := trim(readPNG(filepath.Join(root, sourceDir, name+".idle.png")))
		cells := make([]*image.NRGBA, 0, len(spec.frames))
		for _, f := range spec.frames {
			var pose *image.NRGBA
			if f.pose == "" {
				pose = breathe(idle)
			} else {
				pose = trim(readPNG(filepath.Join(root, sourceDir, name+"."+f.pose+".png")))
			}
			if f.scale > 0 {
				w := int(math.RoundToEven(float64(pose.Bounds().Dx()) * f.scale))
				h := int(math.RoundToEven(float64(pose.Bounds().Dy()) * f.scale))
				pose = resizeNearest(pose, w, h)
			}
			cells = append(cells, place(pose, spec.cell, name+"/"+f.id))
		}
		row := image.NewNRGBA(image.Rect(0, 0, spec.cell*len(cells), spec.cell))
		for i, c := range cells {
			at := image.Pt(i*spec.cell, 0)
			draw.Draw(row, image.Rectangle{Min: at, Max: at.Add(c.Bounds().Size())}, c, image.Point{}, draw.Src)
		}
		big := resizeNearest(row, row.Bounds().Dx()*upscale, row.Bounds().Dy()*upscale)
		var b bytes.Buffer
		must(nativewebp.Encode(&b, big, nil))
		target := filepath.Join(root, outDir, name+".webp")
		must(os.WriteFile(target, b.Bytes(), 0o644))
		fmt.Printf("wrote %s (%d frames, %d bytes)\n", filepath.Join(outDir, name+".webp"), len(cells), b.Len())
	}
	text, err := json.MarshalIndent(manifest, "", "  ")
	must(err)
	must(os.WriteFile(filepath.Join(root, outDir, "sprites.json"), append(text, '\n'), 0o644))
}

func sortedKeys[V any](m map[string]V) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}

func main() {
	preview := flag.String("preview", "", "also write a contact sheet of the procedural creatures here")
	all := flag.Bool("all", false, "also repack the painted SpriteCook sheets")
	flag.Parse()
	root := repoRoot()
	drawProcedural(root, *preview)
	pack(root, *all)
}
