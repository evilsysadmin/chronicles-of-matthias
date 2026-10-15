package checkpoint
import "testing"
func TestRequiredCheckpointFields(t *testing.T){
 for _,raw:=range []string{
  `{}`,
  `{"currentMapId":"map"}`,
  `{"expectedWorldVersion":0}`,
  `{"expectedWorldVersion":null,"currentMapId":"map"}`,
  `{"expectedWorldVersion":true,"currentMapId":"map"}`,
  `{"expectedWorldVersion":0,"currentMapId":null}`,
  `null`,
  `[]`,
 } {if _,err:=Decode([]byte(raw));err==nil{t.Errorf("accepted %s",raw)}}
}
