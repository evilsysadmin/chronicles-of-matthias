package checkpoint
import (
 "strings"
 "testing"
)
func TestSectionSizeLimits(t *testing.T){
 raw:=`{"expectedWorldVersion":0,"currentMapId":"map","worldFlags":{"large":"`+strings.Repeat("x",65537)+`"}}`
 if _,err:=Decode([]byte(raw));err==nil{t.Fatal("oversized flags accepted")}
 for _,raw:=range []string{
  `{"expectedWorldVersion":0,"currentMapId":"map","claimedRewards":["   "]}`,
  `{"expectedWorldVersion":0,"currentMapId":"map","consumedContentIds":[""]}`,
 } {if _,err:=Decode([]byte(raw));err==nil{t.Errorf("invalid IDs accepted: %s",raw)}}
}
