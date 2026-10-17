package main

// Ordered JSON: manifests are written key by key in the order they are
// authored, with Python-json-compatible formatting (indent 2, ", " never
// on one line, non-ASCII kept), so the committed maps stay byte-stable.

import (
	"bytes"
	"encoding/json"
	"fmt"
	"math"
	"sort"
	"strconv"
	"strings"
)

// O is an ordered JSON object.
type O struct{ kv []kv }

type kv struct {
	k string
	v any
}

// A is a JSON array.
type A = []any

// obj builds an object from alternating key, value arguments.
func obj(pairs ...any) *O {
	if len(pairs)%2 != 0 {
		panic("obj: odd number of arguments")
	}
	o := &O{}
	for i := 0; i < len(pairs); i += 2 {
		o.Set(pairs[i].(string), pairs[i+1])
	}
	return o
}

// Set replaces the value in place or appends a new key (Python dict semantics).
func (o *O) Set(k string, v any) *O {
	for i := range o.kv {
		if o.kv[i].k == k {
			o.kv[i].v = v
			return o
		}
	}
	o.kv = append(o.kv, kv{k, v})
	return o
}

func (o *O) Get(k string) any {
	for _, e := range o.kv {
		if e.k == k {
			return e.v
		}
	}
	return nil
}

func (o *O) Has(k string) bool {
	for _, e := range o.kv {
		if e.k == k {
			return true
		}
	}
	return false
}

func (o *O) Str(k string) string { s, _ := o.Get(k).(string); return s }

func (o *O) Int(k string) int {
	switch v := o.Get(k).(type) {
	case int:
		return v
	case json.Number:
		n, _ := v.Int64()
		return int(n)
	}
	return 0
}

func (o *O) Obj(k string) *O { v, _ := o.Get(k).(*O); return v }

func (o *O) Arr(k string) A { v, _ := o.Get(k).(A); return v }

// Update copies every key of other into o (dict.update).
func (o *O) Update(other *O) *O {
	for _, e := range other.kv {
		o.Set(e.k, e.v)
	}
	return o
}

// Clone is a deep copy.
func (o *O) Clone() *O { return deepCopy(o).(*O) }

// With returns a shallow copy with extra keys ({**o, k: v}).
func (o *O) With(pairs ...any) *O {
	c := &O{kv: append([]kv(nil), o.kv...)}
	return c.Update(obj(pairs...))
}

func deepCopy(v any) any {
	switch x := v.(type) {
	case *O:
		c := &O{kv: make([]kv, len(x.kv))}
		for i, e := range x.kv {
			c.kv[i] = kv{e.k, deepCopy(e.v)}
		}
		return c
	case A:
		c := make(A, len(x))
		for i, e := range x {
			c[i] = deepCopy(e)
		}
		return c
	}
	return v
}

// parse reads JSON keeping object key order and number literals.
func parse(text string) any {
	dec := json.NewDecoder(strings.NewReader(text))
	dec.UseNumber()
	v, err := parseValue(dec)
	if err != nil {
		panic(err)
	}
	return v
}

func parseObj(text string) *O { return parse(text).(*O) }

func parseValue(dec *json.Decoder) (any, error) {
	tok, err := dec.Token()
	if err != nil {
		return nil, err
	}
	switch t := tok.(type) {
	case json.Delim:
		switch t {
		case '{':
			o := &O{}
			for dec.More() {
				kt, err := dec.Token()
				if err != nil {
					return nil, err
				}
				val, err := parseValue(dec)
				if err != nil {
					return nil, err
				}
				o.kv = append(o.kv, kv{kt.(string), val})
			}
			_, err := dec.Token()
			return o, err
		case '[':
			a := A{}
			for dec.More() {
				val, err := parseValue(dec)
				if err != nil {
					return nil, err
				}
				a = append(a, val)
			}
			_, err := dec.Token()
			return a, err
		}
	case json.Number:
		if n, err := t.Int64(); err == nil && !strings.ContainsAny(string(t), ".eE") {
			return int(n), nil
		}
		f, err := t.Float64()
		return f, err
	}
	return tok, nil
}

// dump renders like json.dumps(v, ensure_ascii=False, indent=2).
func dump(v any) string {
	var b bytes.Buffer
	write(&b, v, 0)
	return b.String()
}

func write(b *bytes.Buffer, v any, depth int) {
	pad := func(d int) { b.WriteByte('\n'); b.WriteString(strings.Repeat("  ", d)) }
	switch x := v.(type) {
	case nil:
		b.WriteString("null")
	case bool:
		if x {
			b.WriteString("true")
		} else {
			b.WriteString("false")
		}
	case int:
		b.WriteString(strconv.Itoa(x))
	case float64:
		b.WriteString(pyFloat(x))
	case string:
		writeString(b, x)
	case *O:
		if len(x.kv) == 0 {
			b.WriteString("{}")
			return
		}
		b.WriteByte('{')
		for i, e := range x.kv {
			if i > 0 {
				b.WriteByte(',')
			}
			pad(depth + 1)
			writeString(b, e.k)
			b.WriteString(": ")
			write(b, e.v, depth+1)
		}
		pad(depth)
		b.WriteByte('}')
	case A:
		if len(x) == 0 {
			b.WriteString("[]")
			return
		}
		b.WriteByte('[')
		for i, e := range x {
			if i > 0 {
				b.WriteByte(',')
			}
			pad(depth + 1)
			write(b, e, depth+1)
		}
		pad(depth)
		b.WriteByte(']')
	case []string:
		a := make(A, len(x))
		for i, s := range x {
			a[i] = s
		}
		write(b, a, depth)
	case []*O:
		a := make(A, len(x))
		for i, s := range x {
			a[i] = s
		}
		write(b, a, depth)
	default:
		panic(fmt.Sprintf("dump: unsupported %T", v))
	}
}

func pyFloat(f float64) string {
	if math.IsInf(f, 0) || math.IsNaN(f) {
		panic("dump: non-finite float")
	}
	s := strconv.FormatFloat(f, 'g', -1, 64)
	if !strings.ContainsAny(s, ".en") {
		s += ".0"
	}
	return s
}

func writeString(b *bytes.Buffer, s string) {
	b.WriteByte('"')
	for _, r := range s {
		switch r {
		case '"':
			b.WriteString(`\"`)
		case '\\':
			b.WriteString(`\\`)
		case '\n':
			b.WriteString(`\n`)
		case '\r':
			b.WriteString(`\r`)
		case '\t':
			b.WriteString(`\t`)
		case '\b':
			b.WriteString(`\b`)
		case '\f':
			b.WriteString(`\f`)
		default:
			if r < 0x20 {
				fmt.Fprintf(b, `\u%04x`, r)
			} else {
				b.WriteRune(r)
			}
		}
	}
	b.WriteByte('"')
}

func sortedKeys[V any](m map[string]V) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}
