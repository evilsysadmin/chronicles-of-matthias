package main

// Creatures drawn as original pixel art. Each function draws one pose:
// "idle" or "attack"; hurt and dead are derived from idle.

import (
	"image"
	"image/color"
	"math"
)

var (
	outlineColour = hex(0x120c08)
	fur           = ramp(0x1e1814, 0x3a2e26, 0x584638, 0x786250, 0x9a826a, 0xbaa288)
	pink          = ramp(0x5a2228, 0x8a3a40, 0xb85a5e, 0xdc8486, 0xf4b0b0)
	goblin        = ramp(0x10200c, 0x22401a, 0x3a6428, 0x568a38, 0x78ac4c, 0xa0cc6a)
	rag           = ramp(0x1a120a, 0x34241a, 0x50382a, 0x6c4e3a, 0x8a6a50)
	wood          = ramp(0x1e1008, 0x351d0e, 0x4f2d16, 0x6b4021, 0x8a5630, 0xa86e40)
	shell         = ramp(0x3a1408, 0x6a2a10, 0x9a4a1e, 0xc4703a, 0xe0a070, 0xf6dcc4)
	salt          = ramp(0x8a8c90, 0xb4b8bc, 0xd8dcdc, 0xf4f6f4)
	drownedSkin   = ramp(0x142424, 0x264040, 0x3e5e5a, 0x5a7e76, 0x7ea098, 0xa8c4ba)
	weed          = ramp(0x081a0e, 0x12301a, 0x1e4a26, 0x2e6634, 0x488a48)
	cloth         = ramp(0x14161e, 0x262a36, 0x3a404e, 0x525a6a, 0x6e7686)
	robe          = ramp(0x101410, 0x202a1e, 0x34422e, 0x4a5c40, 0x627656)
	hag           = ramp(0x2a2a1a, 0x4a4a30, 0x6a6a46, 0x8c8a60, 0xaeaa80)
	orb           = ramp(0x0c3a10, 0x1a6a20, 0x34a030, 0x6ad850, 0xb4ff98, 0xf0fff0)
	bone          = ramp(0x6a6450, 0x9a927a, 0xc8c0a4, 0xeee8d4)
	eyeRed        = hex(0xff3a2a)
	eyeYellow     = hex(0xffe050)
	eyeGreen      = hex(0xa8ff80)
	eyeCyan       = hex(0x9af4ff)

	ghost     = ramp(0x1a2a4a, 0x2c4a78, 0x4a74a8, 0x7aa4d0, 0xb4d4f0, 0xeaf6ff)
	steel     = ramp(0x1c1f26, 0x343a46, 0x515a6a, 0x748094, 0x9aa6b8, 0xc8d0dc)
	gold      = ramp(0x3a2408, 0x6a4a10, 0x9a7420, 0xc8a038, 0xecd070, 0xfff0b0)
	velvet    = ramp(0x1a0608, 0x3a0c12, 0x5e1620, 0x86242e, 0xae3a40)
	ash       = ramp(0x0e0e12, 0x1c1c24, 0x2e2e3a, 0x444452, 0x5e5e6e)
	skin      = ramp(0x4a2a1a, 0x7a4a30, 0xa8704c, 0xcc9a72, 0xe8c4a0)
	pale      = ramp(0x6a6a72, 0x9a9aa4, 0xc4c4cc, 0xe8e8ee)
	trollHide = ramp(0x1a2418, 0x2e3e28, 0x46583a, 0x60744e, 0x7e9066)
	feather   = ramp(0x24160c, 0x3e2816, 0x5c3e22, 0x7c5832, 0xa07848)
	ember     = ramp(0x2a0a04, 0x5a1a06, 0x8e300a, 0xc4521a, 0xec8a36, 0xffc070)
	toad      = ramp(0x1a220c, 0x2e3a14, 0x48561e, 0x66762c, 0x8a9a40)
	ice       = ramp(0x2a4a6a, 0x4a7aa0, 0x7aaacc, 0xaad0e8, 0xdaf0fc, 0xffffff)
	void      = ramp(0x1a0a2a, 0x2e1048, 0x4a1a70, 0x7030a0, 0xa060d0)
	rust      = ramp(0x2a1408, 0x4a2410, 0x6e3a1c, 0x925630)
	flame     = ramp(0x8a2a04, 0xd06010, 0xf8a020, 0xffe070, 0xfffad0)
)

type drawFn func(pose string) *image.NRGBA

func fx(v int) float64 { return float64(v) }

func shade(base, slope float64, origin int) light {
	return func(x, _ int) float64 { return base - (float64(x)-float64(origin))*slope }
}

func vshade(base, slope float64, origin int) light {
	return func(_, y int) float64 { return base - (float64(y)-float64(origin))*slope }
}

// ─── the first five (were placeholders in Python) ──────────────────────────

func sewerRat(pose string) *image.NRGBA {
	s := newSprite(72, 52)
	lunge := 0.0
	if pose == "attack" {
		lunge = 4
	}
	s.fill(line([]pt{p(60, 44), p(68, 36), p(66, 24), p(70, 16)}, 3), pink, flatLight(0.55))
	s.fill(ellipse(42, 36, 20, 12), fur, litDefault(42, 36, 20))
	s.fill(union(ellipse(26, 30-lunge, 13, 11), poly(p(14, 30-lunge), p(4, 36-lunge), p(14, 40-lunge))), fur, litDefault(24, 30, 13))
	s.fill(union(ellipse(22, 20-lunge, 5, 6), ellipse(33, 19-lunge, 5, 6)), pink, flatLight(0.6))
	s.fill(ellipse(5, 36-lunge, 3, 2), pink, flatLight(0.75))
	for _, ex := range []int{17, 25} {
		s.dot(ex, 29-int(lunge), eyeRed)
		s.dot(ex+1, 29-int(lunge), eyeRed)
	}
	if pose == "attack" {
		s.fill(poly(p(5, 38-lunge), p(16, 37-lunge), p(16, 46-lunge), p(6, 42-lunge)), pink, flatLight(0.2))
		for _, tx := range []float64{8, 11} {
			s.flat(poly(p(tx, 38-lunge), p(tx+2, 38-lunge), p(tx+1, 42-lunge)), bone, flatLight(0.9))
		}
	} else {
		s.flat(poly(p(6, 39), p(10, 39), p(8, 43)), bone, flatLight(0.9))
	}
	for _, lx := range []float64{26, 34, 50, 58} {
		s.fill(line([]pt{p(lx, 44), p(lx-2, 50)}, 3), fur, flatLight(0.35))
	}
	return s.img
}

func ashGoblin(pose string) *image.NRGBA {
	s := newSprite(64, 76)
	raise := pose == "attack"
	if raise {
		s.fill(line([]pt{p(18, 34), p(10, 8)}, 4), wood, flatLight(0.55))
		s.fill(ellipse(9, 7, 6, 6), wood, flatLight(0.7))
	} else {
		s.fill(line([]pt{p(14, 50), p(8, 66)}, 4), wood, flatLight(0.55))
		s.fill(ellipse(7, 68, 5, 5), wood, flatLight(0.65))
	}
	arm := p(17, 50)
	if raise {
		arm = p(18, 32)
	}
	s.fill(union(
		poly(p(22, 36), p(42, 36), p(44, 58), p(20, 58)),
		line([]pt{p(22, 38), arm}, 6),
		line([]pt{p(42, 38), p(48, 54)}, 6),
		line([]pt{p(26, 58), p(24, 74)}, 6),
		line([]pt{p(38, 58), p(40, 74)}, 6),
		ellipse(32, 26, 11, 10),
		poly(p(22, 22), p(6, 14), p(22, 30)),
		poly(p(42, 22), p(58, 14), p(42, 30)),
	), goblin, litDefault(30, 30, 18))
	s.fill(poly(p(20, 52), p(44, 52), p(46, 62), p(18, 62)), rag, shade(0.5, 1.0/80, 18))
	for _, ex := range []int{28, 35} {
		s.dot(ex, 25, eyeYellow)
		s.dot(ex+1, 25, eyeYellow)
	}
	s.flat(poly(p(27, 31), p(37, 31), p(36, 33), p(28, 33)), rag, flatLight(0.05))
	s.dot(29, 31, bone[3])
	s.dot(34, 31, bone[3])
	return s.img
}

func saltCrab(pose string) *image.NRGBA {
	s := newSprite(80, 56)
	open := pose == "attack"
	for _, side := range []float64{-1, 1} {
		for i := 0.0; i < 3; i++ {
			x0 := 40 + side*(12+i*5)
			s.fill(line([]pt{p(x0, 38), p(x0+side*8, 44), p(x0+side*10, 54)}, 3), shell, flatLight(0.4))
		}
	}
	s.fill(ellipse(40, 34, 22, 13), shell, litDefault(40, 34, 22))
	for i := 0; i < 16; i++ {
		x, y := 24+(i*7)%32, 26+(i*5)%9
		s.dot(x, y, salt[3])
		s.dot(x+1, y, salt[2])
	}
	for _, side := range []float64{-1, 1} {
		cx, cy, gap := 40+side*22, 20.0, 1.0
		if open {
			cx, cy, gap = 40+side*24, 14, 5
		}
		s.fill(line([]pt{p(40+side*14, 30), p(cx, cy+6)}, 5), shell, flatLight(0.5))
		s.fill(ellipse(cx, cy, 8, 7), shell, litDefault(cx, cy, 8))
		s.fill(poly(p(cx-3, cy-2), p(cx+side*4, cy-10-gap), p(cx+side*7, cy-4)), shell, flatLight(0.75))
	}
	for _, ex := range []float64{35, 45} {
		s.fill(line([]pt{p(ex, 24), p(ex, 17)}, 2), shell, flatLight(0.5))
		s.fill(ellipse(ex, 16, 2, 2), cloth, flatLight(0.05))
		s.dot(int(ex)-1, 15, salt[3])
	}
	return s.img
}

func drowned(pose string) *image.NRGBA {
	s := newSprite(60, 84)
	reach := pose == "attack"
	l, r := p(12, 56), p(50, 58)
	if reach {
		l, r = p(6, 30), p(54, 30)
	}
	s.fill(union(
		poly(p(20, 30), p(40, 30), p(42, 60), p(18, 60)),
		line([]pt{p(20, 32), l}, 6), line([]pt{p(40, 32), r}, 6),
		line([]pt{p(24, 60), p(22, 82)}, 6), line([]pt{p(36, 60), p(38, 82)}, 6),
		ellipse(30, 20, 9, 11),
	), drownedSkin, litDefault(28, 28, 22))
	s.fill(poly(p(18, 34), p(42, 34), p(44, 66), p(38, 62), p(32, 68), p(26, 62), p(16, 66)), cloth, shade(0.5, 1.0/70, 16))
	s.fill(union(poly(p(20, 14), p(30, 7), p(40, 14), p(40, 17), p(20, 17)),
		poly(p(19, 14), p(23, 14), p(22, 36), p(18, 30)),
		poly(p(37, 14), p(41, 14), p(42, 32), p(38, 36))), weed, vshade(0.7, 1.0/40, 7))
	for _, ex := range []int{26, 33} {
		s.dot(ex, 20, outlineColour)
		s.dot(ex+1, 20, eyeGreen)
	}
	s.flat(poly(p(26, 25), p(34, 25), p(33, 28), p(27, 28)), cloth, flatLight(0))
	for i := 0; i < 5; i++ {
		s.dot(20+i*5, 62+(i%2)*3, weed[4])
	}
	return s.img
}

func mireWitch(pose string) *image.NRGBA {
	s := newSprite(72, 92)
	cast := pose == "attack"
	top := p(60, 18)
	if cast {
		top = p(58, 6)
	}
	s.fill(line([]pt{p(60, 88), top}, 3), wood, flatLight(0.55))
	glow, r := orb[:5], 5.0
	if cast {
		glow, r = orb, 6
	}
	s.fill(ellipse(top.x, top.y-2, r, r), glow, func(x, y int) float64 {
		return 1 - math.Hypot(fx(x)-top.x+2, fx(y)-top.y)/8
	})
	if cast {
		for i := 0; i < 8; i++ {
			a := float64(i) * math.Pi / 4
			s.dot(int(top.x+math.Cos(a)*9), int(top.y-2+math.Sin(a)*9), orb[4])
		}
	}
	s.fill(poly(p(14, 90), p(20, 40), p(30, 24), p(46, 22), p(54, 34), p(56, 90)), robe, litDefault(30, 40, 30))
	s.fill(poly(p(24, 40), p(30, 18), p(44, 16), p(52, 30), p(46, 46), p(30, 48)), robe, shade(0.55, 1.0/60, 24))
	s.fill(ellipse(40, 34, 8, 9), hag, litDefault(40, 34, 8))
	s.fill(poly(p(35, 31), p(24, 40), p(27, 42), p(35, 37)), hag, flatLight(0.62))
	s.dot(29, 39, hag[0])
	for _, ex := range []int{37, 43} {
		s.dot(ex, 31, outlineColour)
		s.dot(ex+1, 31, eyeGreen)
	}
	s.flat(poly(p(35, 39), p(45, 38), p(43, 41), p(36, 41)), robe, flatLight(0))
	s.dot(39, 40, bone[3])
	s.dot(42, 39, bone[3])
	hand := p(56, 52)
	if cast {
		hand = p(56, 40)
	}
	s.fill(line([]pt{p(44, 50), hand}, 5), robe, flatLight(0.45))
	s.fill(ellipse(hand.x+2, hand.y, 3, 3), hag, flatLight(0.65))
	for i := 0; i < 6; i++ {
		s.dot(18+i*7, 88-(i%3)*2, weed[3])
	}
	return s.img
}

// ─── Act V: Varren's cult and the oathbound ────────────────────────────────

func silentAcolyte(pose string) *image.NRGBA {
	s := newSprite(60, 88)
	strike := pose == "attack"
	// Robe and hood.
	s.fill(poly(p(14, 86), p(18, 44), p(22, 30), p(38, 30), p(42, 44), p(46, 86)), ash, litDefault(26, 50, 30))
	s.fill(poly(p(18, 34), p(22, 12), p(30, 6), p(38, 12), p(42, 34), p(30, 40)), ash, shade(0.6, 1.0/50, 18))
	// A pale mask with no mouth: the cult swore silence.
	s.fill(ellipse(30, 22, 6, 8), pale, litDefault(30, 22, 6))
	s.dot(27, 20, outlineColour)
	s.dot(33, 20, outlineColour)
	s.flat(line([]pt{p(26, 26), p(34, 26)}, 1), velvet, flatLight(0.3))
	// Rope belt.
	s.flat(line([]pt{p(19, 56), p(41, 56)}, 2), rag, flatLight(0.6))
	if strike {
		s.fill(line([]pt{p(40, 40), p(52, 20)}, 5), ash, flatLight(0.4))
		s.fill(poly(p(50, 20), p(56, 4), p(54, 22)), steel, flatLight(0.85))
		s.fill(line([]pt{p(20, 40), p(10, 50)}, 5), ash, flatLight(0.35))
	} else {
		// Candle held before the chest.
		s.fill(line([]pt{p(22, 42), p(28, 48)}, 5), ash, flatLight(0.35))
		s.fill(line([]pt{p(38, 42), p(32, 48)}, 5), ash, flatLight(0.45))
		s.fill(poly(p(28, 36), p(32, 36), p(32, 46), p(28, 46)), bone, flatLight(0.8))
		s.flat(ellipse(30, 33, 2, 3), flame, func(_, y int) float64 { return 1 - (fx(y)-30)/6 })
	}
	return s.img
}

func oathboundKnight(pose string) *image.NRGBA {
	s := newSprite(68, 96)
	strike := pose == "attack"
	if strike {
		s.fill(line([]pt{p(48, 40), p(60, 4)}, 4), steel, flatLight(0.85))
		s.fill(line([]pt{p(42, 42), p(54, 42)}, 3), gold, flatLight(0.6))
	} else {
		s.fill(line([]pt{p(54, 40), p(56, 92)}, 4), steel, flatLight(0.8))
		s.fill(line([]pt{p(48, 42), p(62, 42)}, 3), gold, flatLight(0.6))
	}
	armL := p(12, 64)
	armR := p(54, 42)
	if strike {
		armR = p(50, 40)
	}
	s.fill(union(
		poly(p(20, 32), p(48, 32), p(46, 66), p(22, 66)),
		line([]pt{p(22, 36), armL}, 8), line([]pt{p(46, 36), armR}, 8),
		line([]pt{p(28, 66), p(26, 92)}, 9), line([]pt{p(40, 66), p(42, 92)}, 9),
		ellipse(14, 34, 8, 6), ellipse(54, 34, 8, 6),
	), ghost, litDefault(30, 40, 30))
	// Great helm with a glowing slit.
	s.fill(poly(p(24, 8), p(44, 8), p(46, 30), p(22, 30)), ghost, litDefault(32, 16, 12))
	s.flat(line([]pt{p(27, 18), p(41, 18)}, 2), ice, flatLight(1))
	// Chains of the false oath across the chest.
	s.flat(line([]pt{p(20, 36), p(48, 58)}, 2), rust, flatLight(0.5))
	s.flat(line([]pt{p(48, 36), p(20, 58)}, 2), rust, flatLight(0.4))
	// The lower legs fade into mist.
	for y := 80; y < 96; y++ {
		for x := 0; x < 68; x++ {
			if (x+y)%3 == 0 {
				s.img.SetNRGBA(x, y, color.NRGBA{})
			}
		}
	}
	return s.img
}

func chancellorVarren(pose string) *image.NRGBA {
	s := newSprite(72, 104)
	cast := pose == "attack"
	// Staff topped with an empty ring.
	s.fill(line([]pt{p(58, 100), p(58, 26)}, 3), wood, flatLight(0.55))
	ring := union(ellipse(58, 20, 7, 7))
	hole := ellipse(58, 20, 4, 4)
	s.fill(func(x, y int) bool { return ring(x, y) && !hole(x, y) }, gold, litDefault(58, 20, 7))
	// Robe with gold trim.
	s.fill(poly(p(14, 102), p(20, 46), p(28, 32), p(44, 32), p(52, 46), p(56, 102)), velvet, litDefault(30, 54, 34))
	s.flat(line([]pt{p(35, 34), p(35, 102)}, 3), gold, flatLight(0.7))
	s.flat(line([]pt{p(15, 100), p(55, 100)}, 2), gold, flatLight(0.6))
	// Head, beard and the hollow crown.
	s.fill(ellipse(36, 24, 8, 9), skin, litDefault(36, 24, 8))
	s.fill(poly(p(29, 26), p(43, 26), p(40, 40), p(36, 44), p(32, 40)), pale, vshade(0.75, 1.0/30, 26))
	s.dot(33, 22, outlineColour)
	s.dot(39, 22, outlineColour)
	crown := poly(p(26, 16), p(28, 6), p(31, 12), p(36, 4), p(41, 12), p(44, 6), p(46, 16))
	crownHole := poly(p(30, 14), p(42, 14), p(41, 12), p(36, 8), p(31, 12))
	s.fill(func(x, y int) bool { return crown(x, y) && !crownHole(x, y) }, gold, litDefault(36, 10, 10))
	if cast {
		s.fill(line([]pt{p(28, 40), p(12, 22)}, 6), velvet, flatLight(0.45))
		s.fill(ellipse(10, 16, 7, 7), void, func(x, y int) float64 { return 1 - math.Hypot(fx(x)-8, fx(y)-14)/10 })
		for i := 0; i < 10; i++ {
			a := float64(i) * math.Pi / 5
			s.dot(int(10+math.Cos(a)*11), int(16+math.Sin(a)*11), void[4])
		}
	} else {
		s.fill(line([]pt{p(28, 42), p(22, 62)}, 6), velvet, flatLight(0.4))
		s.fill(line([]pt{p(46, 42), p(56, 52)}, 6), velvet, flatLight(0.5))
		s.fill(ellipse(57, 53, 3, 3), skin, flatLight(0.7))
	}
	return s.img
}

// ─── Terra's new bestiary ──────────────────────────────────────────────────

func skeleton(pose string) *image.NRGBA {
	s := newSprite(60, 88)
	strike := pose == "attack"
	// Round shield on the left arm.
	s.fill(ellipse(14, 52, 10, 11), rust, litDefault(14, 52, 10))
	s.dot(14, 52, gold[4])
	// Bones.
	limbs := []mask{
		line([]pt{p(30, 30), p(30, 58)}, 3),
		line([]pt{p(22, 34), p(16, 50)}, 3),
		line([]pt{p(26, 60), p(24, 86)}, 3), line([]pt{p(34, 60), p(36, 86)}, 3),
		ellipse(30, 60, 8, 4),
	}
	if strike {
		limbs = append(limbs, line([]pt{p(38, 34), p(46, 18)}, 3))
	} else {
		limbs = append(limbs, line([]pt{p(38, 34), p(44, 52)}, 3))
	}
	s.fill(union(limbs...), bone, flatLight(0.7))
	for i := 0; i < 4; i++ {
		y := 36 + float64(i)*5
		s.fill(line([]pt{p(22, y), p(38, y)}, 2), bone, flatLight(0.8-float64(i)*0.08))
	}
	s.fill(ellipse(30, 20, 9, 10), bone, litDefault(30, 20, 9))
	s.fill(union(ellipse(26, 20, 2, 3), ellipse(34, 20, 2, 3)), cloth, flatLight(0))
	s.dot(26, 20, eyeRed)
	s.dot(34, 20, eyeRed)
	s.flat(line([]pt{p(26, 27), p(34, 27)}, 1), cloth, flatLight(0.1))
	if strike {
		s.fill(line([]pt{p(46, 18), p(52, 0)}, 3), rust, flatLight(0.6))
	} else {
		s.fill(line([]pt{p(44, 52), p(50, 72)}, 3), rust, flatLight(0.6))
	}
	return s.img
}

func harpy(pose string) *image.NRGBA {
	s := newSprite(96, 76)
	dive := pose == "attack"
	wingTip := 4.0
	if dive {
		wingTip = 0
	}
	for _, side := range []float64{-1, 1} {
		s.fill(poly(p(48+side*8, 30), p(48+side*44, wingTip), p(48+side*46, 20), p(48+side*40, 34), p(48+side*30, 40), p(48+side*12, 42)),
			feather, shade(0.6, side/120, 48))
		for i := 0.0; i < 4; i++ {
			s.flat(line([]pt{p(48+side*(16+i*7), 40-i*2), p(48+side*(20+i*7), 30-i*6)}, 1), feather, flatLight(0.25))
		}
	}
	s.fill(poly(p(40, 28), p(56, 28), p(54, 50), p(42, 50)), skin, litDefault(46, 34, 14))
	s.fill(ellipse(48, 20, 7, 8), skin, litDefault(48, 20, 7))
	s.fill(poly(p(40, 18), p(48, 10), p(56, 18), p(58, 34), p(52, 24), p(44, 24), p(38, 34)), cloth, flatLight(0.25))
	s.dot(45, 20, eyeYellow)
	s.dot(51, 20, eyeYellow)
	s.fill(poly(p(42, 48), p(54, 48), p(52, 58), p(44, 58)), feather, flatLight(0.5))
	feet := []pt{p(44, 58), p(40, 72)}
	feet2 := []pt{p(52, 58), p(56, 72)}
	if dive {
		feet = []pt{p(44, 58), p(36, 66)}
		feet2 = []pt{p(52, 58), p(60, 66)}
	}
	s.fill(union(line(feet, 3), line(feet2, 3)), shell, flatLight(0.5))
	for _, f := range []pt{feet[1], feet2[1]} {
		for _, d := range []float64{-3, 0, 3} {
			s.flat(line([]pt{f, p(f.x+d, f.y+4)}, 1), bone, flatLight(0.9))
		}
	}
	return s.img
}

func troll(pose string) *image.NRGBA {
	s := newSprite(92, 108)
	swing := pose == "attack"
	if swing {
		s.fill(line([]pt{p(70, 40), p(84, 4)}, 7), wood, flatLight(0.5))
		s.fill(ellipse(84, 6, 8, 7), wood, flatLight(0.6))
	} else {
		s.fill(line([]pt{p(72, 76), p(86, 104)}, 7), wood, flatLight(0.5))
		s.fill(ellipse(86, 102, 8, 6), wood, flatLight(0.6))
	}
	armR := p(72, 80)
	if swing {
		armR = p(70, 40)
	}
	s.fill(union(
		ellipse(44, 52, 28, 26),
		line([]pt{p(22, 44), p(14, 92)}, 11), line([]pt{p(66, 44), armR}, 11),
		line([]pt{p(32, 74), p(28, 104)}, 13), line([]pt{p(56, 74), p(60, 104)}, 13),
		ellipse(44, 26, 12, 11),
	), trollHide, litDefault(40, 44, 34))
	s.fill(poly(p(22, 70), p(66, 70), p(68, 86), p(20, 86)), rag, shade(0.5, 1.0/90, 20))
	s.dot(39, 25, eyeYellow)
	s.dot(48, 25, eyeYellow)
	s.flat(union(poly(p(37, 31), p(39, 31), p(38, 36)), poly(p(49, 31), p(51, 31), p(50, 36))), bone, flatLight(0.9))
	s.fill(poly(p(42, 26), p(46, 26), p(47, 31), p(41, 31)), trollHide, flatLight(0.75))
	return s.img
}

func iceWraith(pose string) *image.NRGBA {
	s := newSprite(68, 92)
	reach := pose == "attack"
	// Tattered shroud.
	hem := []pt{p(10, 84), p(16, 74), p(22, 88), p(30, 76), p(38, 90), p(46, 76), p(52, 86), p(58, 74)}
	body := append([]pt{p(22, 20), p(46, 20), p(58, 74)}, reverse(hem)...)
	s.fill(poly(body...), ice, litDefault(32, 36, 32))
	l, r := p(8, 54), p(60, 54)
	if reach {
		l, r = p(2, 34), p(66, 34)
	}
	s.fill(union(line([]pt{p(22, 30), l}, 5), line([]pt{p(46, 30), r}, 5)), ice, flatLight(0.6))
	for _, h := range []pt{l, r} {
		for _, d := range []float64{-3, 0, 3} {
			s.flat(line([]pt{h, p(h.x+d, h.y+6)}, 1), ice, flatLight(0.95))
		}
	}
	s.fill(ellipse(34, 18, 10, 12), ice, litDefault(34, 18, 10))
	s.fill(union(ellipse(30, 18, 2, 3), ellipse(38, 18, 2, 3)), ghost, flatLight(0))
	s.dot(30, 18, eyeCyan)
	s.dot(38, 18, eyeCyan)
	return s.img
}

func ashSalamander(pose string) *image.NRGBA {
	s := newSprite(100, 56)
	spit := pose == "attack"
	s.fill(line([]pt{p(70, 40), p(84, 34), p(94, 40), p(98, 30)}, 6), ember, flatLight(0.45))
	s.fill(ellipse(52, 38, 24, 10), ember, litDefault(52, 38, 24))
	jaw := 0.0
	if spit {
		jaw = 5
	}
	s.fill(union(ellipse(24, 34, 12, 8), poly(p(14, 32), p(2, 34), p(14, 38+jaw))), ember, litDefault(22, 32, 12))
	for _, lx := range []float64{36, 46, 60, 70} {
		s.fill(line([]pt{p(lx, 44), p(lx-4, 52)}, 4), ember, flatLight(0.3))
	}
	for i := 0; i < 8; i++ {
		x := 30 + i*6
		s.flat(poly(p(fx(x), 30), p(fx(x+3), 22-float64(i%2)*4), p(fx(x+5), 30)), flame, flatLight(0.75))
	}
	s.dot(20, 31, eyeYellow)
	s.dot(21, 31, eyeYellow)
	if spit {
		s.flat(poly(p(2, 36), p(-0, 30), p(0, 44)), flame, flatLight(0.9))
		for i := 0; i < 6; i++ {
			s.dot(1+i%2, 32+i*2, flame[4])
		}
	}
	return s.img
}

func bogToad(pose string) *image.NRGBA {
	s := newSprite(88, 64)
	tongue := pose == "attack"
	s.fill(union(ellipse(48, 40, 32, 18), line([]pt{p(22, 48), p(10, 60)}, 9), line([]pt{p(74, 48), p(84, 60)}, 9)),
		toad, litDefault(44, 34, 32))
	s.fill(union(ellipse(34, 22, 8, 7), ellipse(62, 22, 8, 7)), toad, litDefault(48, 20, 14))
	s.fill(union(ellipse(34, 21, 4, 4), ellipse(62, 21, 4, 4)), gold, flatLight(0.8))
	s.dot(34, 21, outlineColour)
	s.dot(62, 21, outlineColour)
	for i := 0; i < 12; i++ {
		s.dot(26+(i*13)%46, 34+(i*7)%14, toad[0])
	}
	s.flat(line([]pt{p(24, 42), p(48, 48), p(72, 42)}, 2), toad, flatLight(0.05))
	if tongue {
		s.fill(line([]pt{p(48, 48), p(40, 58), p(14, 60), p(4, 54)}, 4), pink, flatLight(0.6))
		s.fill(ellipse(4, 54, 4, 4), pink, flatLight(0.8))
	}
	return s.img
}

func reverse(points []pt) []pt {
	out := make([]pt, len(points))
	for i, v := range points {
		out[len(points)-1-i] = v
	}
	return out
}

// procedural lists every creature this tool draws, in sheet order.
var procedural = []struct {
	id   string
	draw drawFn
}{
	{"sewer-rat", sewerRat},
	{"ash-goblin", ashGoblin},
	{"salt-crab", saltCrab},
	{"drowned", drowned},
	{"mire-witch", mireWitch},
	{"silent-acolyte", silentAcolyte},
	{"oathbound-knight", oathboundKnight},
	{"chancellor-varren", chancellorVarren},
	{"skeleton", skeleton},
	{"harpy", harpy},
	{"troll", troll},
	{"ice-wraith", iceWraith},
	{"ash-salamander", ashSalamander},
	{"bog-toad", bogToad},
}
