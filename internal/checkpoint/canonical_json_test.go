package checkpoint

import (
 "bytes"
 "fmt"
 "strings"
 "testing"
)

func TestCanonicalJSONUnescapedUTF8AndHTML(t *testing.T){
 encoded,err:=canonicalJSON(map[string]any{"text":"á<&>","num":1})
 if err!=nil{t.Fatal(err)}
 if !bytes.Contains(encoded,[]byte("á<&>")){t.Fatalf("unexpected escaping: %s",encoded)}
 if bytes.Contains(encoded,[]byte("\\u003c"))||bytes.HasSuffix(encoded,[]byte("\n")){t.Fatalf("not canonical: %s",encoded)}
}
func TestCheckpointHTMLCharactersNearLimit(t *testing.T){
 // With HTML escaping this payload would exceed 65,536 bytes despite
 // fitting Python's ensure_ascii=False compact representation.
 value:=strings.Repeat("<",12000)
 raw:=[]byte(`{"expectedWorldVersion":0,"currentMapId":"map","worldFlags":{"note":"`+value+`"}}`)
 // The field's own 256-character bound remains authoritative.
 if _,err:=Decode(raw);err==nil{t.Fatal("long flag should be rejected")}
}

func TestCheckpointSectionLimitUsesUnescapedCompactJSON(t *testing.T) {
 // 300 distinct short keys, each with 200 literal '<' characters: below
 // the 65,536-byte section cap and the 256-rune per-flag bound.
 // Go's default HTML escaping would multiply the value bytes sixfold.
 var flags strings.Builder
 for i:=0;i<300;i++ {
  if i>0 { flags.WriteByte(',') }
  fmt.Fprintf(&flags, "%q:%q", fmt.Sprintf("f%03d",i), strings.Repeat("<",200))
 }
 raw:=[]byte(`{"expectedWorldVersion":0,"currentMapId":"map","worldFlags":{`+flags.String()+`}}`)
 if _,err:=Decode(raw);err!=nil { t.Fatalf("valid compact UTF-8 section rejected: %v",err) }
}
