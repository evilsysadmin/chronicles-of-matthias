package main

// A tiny pixel-art rasterizer: filled shapes shaded from short colour ramps
// with a 4x4 Bayer dither, one dark contour per silhouette, lit from the
// upper left. Same calls -> same pixels.

import (
	"image"
	"image/color"
	"math"
)

var bayer4 = [16]float64{0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5}

func hex(v uint32) color.NRGBA {
	return color.NRGBA{uint8(v >> 16), uint8(v >> 8), uint8(v), 255}
}

func ramp(values ...uint32) []color.NRGBA {
	out := make([]color.NRGBA, len(values))
	for i, v := range values {
		out[i] = hex(v)
	}
	return out
}

// mask says whether a pixel belongs to a shape.
type mask func(x, y int) bool

// light returns 0 (shadow) .. 1 (highlight) for a pixel.
type light func(x, y int) float64

type sprite struct {
	w, h int
	img  *image.NRGBA
}

func newSprite(w, h int) *sprite {
	return &sprite{w: w, h: h, img: image.NewNRGBA(image.Rect(0, 0, w, h))}
}

func (s *sprite) pick(colours []color.NRGBA, value float64, x, y int) color.NRGBA {
	value = math.Max(0, math.Min(1, value))
	steps := float64(len(colours) - 1)
	dithered := value + (bayer4[(y%4)*4+x%4]/16-0.5)/steps
	index := int(math.RoundToEven(dithered * steps))
	if index < 0 {
		index = 0
	}
	if index >= len(colours) {
		index = len(colours) - 1
	}
	return colours[index]
}

func union(masks ...mask) mask {
	return func(x, y int) bool {
		for _, m := range masks {
			if m(x, y) {
				return true
			}
		}
		return false
	}
}

// shape fills the union of masks with a shaded ramp and, by default, draws
// a one-pixel dark contour along its edge.
func (s *sprite) shape(m mask, colours []color.NRGBA, l light, outline bool) {
	inside := make([]bool, s.w*s.h)
	for y := 0; y < s.h; y++ {
		for x := 0; x < s.w; x++ {
			if m(x, y) {
				inside[y*s.w+x] = true
				s.img.SetNRGBA(x, y, s.pick(colours, l(x, y), x, y))
			}
		}
	}
	if !outline {
		return
	}
	at := func(x, y int) bool { return x >= 0 && x < s.w && y >= 0 && y < s.h && inside[y*s.w+x] }
	for y := 0; y < s.h; y++ {
		for x := 0; x < s.w; x++ {
			if !inside[y*s.w+x] {
				continue
			}
			if !at(x+1, y) || !at(x-1, y) || !at(x, y+1) || !at(x, y-1) {
				s.img.SetNRGBA(x, y, outlineColour)
			}
		}
	}
}

func (s *sprite) fill(m mask, colours []color.NRGBA, l light) { s.shape(m, colours, l, true) }

func (s *sprite) flat(m mask, colours []color.NRGBA, l light) { s.shape(m, colours, l, false) }

func (s *sprite) dot(x, y int, c color.NRGBA) {
	if x >= 0 && x < s.w && y >= 0 && y < s.h {
		s.img.SetNRGBA(x, y, c)
	}
}

func ellipse(cx, cy, rx, ry float64) mask {
	return func(x, y int) bool {
		dx := (float64(x) - cx) / (rx + 0.5)
		dy := (float64(y) - cy) / (ry + 0.5)
		return dx*dx+dy*dy <= 1
	}
}

type pt struct{ x, y float64 }

func p(x, y float64) pt { return pt{x, y} }

// poly is an even-odd polygon fill sampled at pixel centres, plus its edges.
func poly(points ...pt) mask {
	edge := line(append(append([]pt{}, points...), points[0]), 1)
	return func(x, y int) bool {
		fx, fy := float64(x)+0.5, float64(y)+0.5
		in := false
		for i, j := 0, len(points)-1; i < len(points); j, i = i, i+1 {
			a, b := points[i], points[j]
			if (a.y > fy) != (b.y > fy) && fx < (b.x-a.x)*(fy-a.y)/(b.y-a.y)+a.x {
				in = !in
			}
		}
		return in || edge(x, y)
	}
}

func segmentDistance(px, py float64, a, b pt) float64 {
	dx, dy := b.x-a.x, b.y-a.y
	length := dx*dx + dy*dy
	t := 0.0
	if length > 0 {
		t = math.Max(0, math.Min(1, ((px-a.x)*dx+(py-a.y)*dy)/length))
	}
	ex, ey := a.x+t*dx-px, a.y+t*dy-py
	return math.Hypot(ex, ey)
}

// line is a thick polyline with round joints.
func line(points []pt, width float64) mask {
	r := math.Max(0.5, width/2)
	return func(x, y int) bool {
		fx, fy := float64(x), float64(y)
		for i := 0; i+1 < len(points); i++ {
			if segmentDistance(fx, fy, points[i], points[i+1]) <= r {
				return true
			}
		}
		return false
	}
}

func lit(cx, cy, r, base float64) light {
	return func(x, y int) float64 {
		d := math.Hypot(float64(x)-(cx-r*0.35), float64(y)-(cy-r*0.4))
		return base + 0.4*(1-math.Min(1, d/(r*1.6)))
	}
}

func litDefault(cx, cy, r float64) light { return lit(cx, cy, r, 0.55) }

func flatLight(v float64) light { return func(int, int) float64 { return v } }

// ─── pose derivations ──────────────────────────────────────────────────────

func clone(src *image.NRGBA) *image.NRGBA {
	out := image.NewNRGBA(src.Bounds())
	copy(out.Pix, src.Pix)
	return out
}

// rotate turns an image by deg degrees counter-clockwise (nearest
// neighbour), growing the canvas to hold it.
func rotate(src *image.NRGBA, deg float64) *image.NRGBA {
	rad := deg * math.Pi / 180
	cos, sin := math.Cos(rad), math.Sin(rad)
	w, h := float64(src.Bounds().Dx()), float64(src.Bounds().Dy())
	nw := int(math.Ceil(math.Abs(w*cos) + math.Abs(h*sin)))
	nh := int(math.Ceil(math.Abs(w*sin) + math.Abs(h*cos)))
	out := image.NewNRGBA(image.Rect(0, 0, nw, nh))
	cx, cy := w/2, h/2
	ncx, ncy := float64(nw)/2, float64(nh)/2
	for y := 0; y < nh; y++ {
		for x := 0; x < nw; x++ {
			dx, dy := float64(x)+0.5-ncx, float64(y)+0.5-ncy
			// Inverse rotation (screen y points down).
			sx := cos*dx - sin*dy + cx
			sy := sin*dx + cos*dy + cy
			ix, iy := int(math.Floor(sx)), int(math.Floor(sy))
			if ix >= 0 && iy >= 0 && ix < int(w) && iy < int(h) {
				out.SetNRGBA(x, y, src.NRGBAAt(ix, iy))
			}
		}
	}
	return out
}

func flipVertical(src *image.NRGBA) *image.NRGBA {
	b := src.Bounds()
	out := image.NewNRGBA(b)
	for y := 0; y < b.Dy(); y++ {
		for x := 0; x < b.Dx(); x++ {
			out.SetNRGBA(x, b.Dy()-1-y, src.NRGBAAt(x, y))
		}
	}
	return out
}

// trim crops to the visible pixels.
func trim(src *image.NRGBA) *image.NRGBA {
	b := src.Bounds()
	minX, minY, maxX, maxY := b.Max.X, b.Max.Y, b.Min.X-1, b.Min.Y-1
	for y := b.Min.Y; y < b.Max.Y; y++ {
		for x := b.Min.X; x < b.Max.X; x++ {
			if src.NRGBAAt(x, y).A > 0 {
				minX, minY = min(minX, x), min(minY, y)
				maxX, maxY = max(maxX, x), max(maxY, y)
			}
		}
	}
	if maxX < minX {
		return src
	}
	out := image.NewNRGBA(image.Rect(0, 0, maxX-minX+1, maxY-minY+1))
	for y := minY; y <= maxY; y++ {
		for x := minX; x <= maxX; x++ {
			out.SetNRGBA(x-minX, y-minY, src.NRGBAAt(x, y))
		}
	}
	return out
}

// hurt is a recoil: a red flash over the body, tilted back.
func hurt(idle *image.NRGBA) *image.NRGBA {
	flash := clone(idle)
	for i := 0; i < len(flash.Pix); i += 4 {
		if flash.Pix[i+3] == 0 {
			continue
		}
		r, g, b := int(flash.Pix[i]), int(flash.Pix[i+1]), int(flash.Pix[i+2])
		flash.Pix[i] = uint8(min(255, r+(255-r)*3/5))
		flash.Pix[i+1] = uint8(g * 3 / 5)
		flash.Pix[i+2] = uint8(b * 3 / 5)
	}
	return trim(rotate(flash, -8))
}

// dead lays wide beasts belly up and upright ones on their side, darker.
func dead(idle *image.NRGBA) *image.NRGBA {
	var body *image.NRGBA
	if idle.Bounds().Dx() > idle.Bounds().Dy() {
		body = flipVertical(idle)
	} else {
		body = rotate(idle, 90)
	}
	for i := 0; i < len(body.Pix); i += 4 {
		if body.Pix[i+3] == 0 {
			continue
		}
		body.Pix[i] = uint8(float64(body.Pix[i]) * 0.6)
		body.Pix[i+1] = uint8(float64(body.Pix[i+1]) * 0.6)
		body.Pix[i+2] = uint8(float64(body.Pix[i+2]) * 0.6)
	}
	return trim(body)
}
