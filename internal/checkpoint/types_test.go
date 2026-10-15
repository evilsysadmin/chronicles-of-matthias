package checkpoint
import "testing"
func TestStrictJSONTypes(t *testing.T){
 for _,raw:=range []string{
  `{"expectedWorldVersion":0.5,"currentMapId":"map"}`,
  `{"expectedWorldVersion":"0","currentMapId":"map"}`,
  `{"expectedWorldVersion":0,"currentMapId":"map","worldFlags":[]}`,
  `{"expectedWorldVersion":0,"currentMapId":"map","inventory":[]}`,
  `{"expectedWorldVersion":0,"currentMapId":"map","quests":[]}`,
  `{"expectedWorldVersion":0,"currentMapId":"map","claimedRewards":{}}`,
 } {if _,err:=Decode([]byte(raw));err==nil{t.Errorf("accepted %s",raw)}}
}
