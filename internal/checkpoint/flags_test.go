package checkpoint
import "testing"
func TestWorldFlagIntegerContract(t *testing.T){
 for _,raw:=range []string{
  `{"expectedWorldVersion":0,"currentMapId":"map","worldFlags":{"coins":1.5}}`,
  `{"expectedWorldVersion":0,"currentMapId":"map","worldFlags":{"coins":-0.25}}`,
  `{"expectedWorldVersion":0,"currentMapId":"map","worldFlags":{"nested":[]}}`,
 } {if _,err:=Decode([]byte(raw));err==nil{t.Errorf("accepted invalid flag: %s",raw)}}
 for _,raw:=range []string{
  `{"expectedWorldVersion":0,"currentMapId":"map","worldFlags":{"coins":2,"ready":true,"note":"yes","unset":null}}`,
  `{"expectedWorldVersion":0,"currentMapId":"map","worldFlags":{"coins":-3}}`,
 } {if _,err:=Decode([]byte(raw));err!=nil{t.Errorf("rejected valid flags: %s: %v",raw,err)}}
}
