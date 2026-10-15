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

func TestIDsNormalizeAndDeduplicate(t *testing.T){
 p,err:=Decode([]byte(`{"expectedWorldVersion":0,"currentMapId":"map","claimedRewards":[" alpha ","alpha","beta"],"consumedContentIds":[" x ","x"]}`))
 if err!=nil{t.Fatal(err)}
 if len(p.ClaimedRewards)!=2||p.ClaimedRewards[0]!="alpha"||p.ClaimedRewards[1]!="beta"{t.Fatalf("rewards not normalized: %#v",p.ClaimedRewards)}
 if len(p.ConsumedContentIDs)!=1||p.ConsumedContentIDs[0]!="x"{t.Fatalf("consumed not normalized: %#v",p.ConsumedContentIDs)}
}
