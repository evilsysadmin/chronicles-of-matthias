package checkpoint
import "testing"
func TestInventoryAndQuests(t *testing.T){
 for _,raw:=range []string{
  `{"expectedWorldVersion":1,"currentMapId":"map","inventory":{"sword":{"quantity":2,"name":"Sword"}},"quests":{"intro":{"status":"active","title":"Intro"}}}`,
 } {if _,err:=Decode([]byte(raw));err!=nil{t.Fatal(err)}}
 for _,raw:=range []string{
  `{"expectedWorldVersion":1,"currentMapId":"map","inventory":{"sword":{"quantity":0}}}`,
  `{"expectedWorldVersion":1,"currentMapId":"map","inventory":{"sword":{"quantity":1.5}}}`,
  `{"expectedWorldVersion":1,"currentMapId":"map","inventory":{"sword":{"quantity":true}}}`,
  `{"expectedWorldVersion":1,"currentMapId":"map","quests":{"q":{"status":"unknown"}}}`,
  `{"expectedWorldVersion":1,"currentMapId":"map","quests":{"q":{"status":"active","order":1000001}}}`,
 } {if _,err:=Decode([]byte(raw));err==nil{t.Errorf("accepted %s",raw)}}
}
