package checkpoint
import (
 "encoding/json"
 "testing"
)
func TestExactNumericContracts(t *testing.T){
 for _,raw:=range []string{
  `{"expectedWorldVersion":0,"currentMapId":"map","inventory":{"a":{"quantity":1.5}}}`,
  `{"expectedWorldVersion":0,"currentMapId":"map","inventory":{"a":{"quantity":1.0}}}`,
  `{"expectedWorldVersion":0,"currentMapId":"map","worldFlags":{"x":1e3}}`,
  `{"expectedWorldVersion":0,"currentMapId":"map","worldFlags":{"x":9223372036854775808}}`,
  `{"expectedWorldVersion":0,"currentMapId":"map","quests":{"a":{"status":"active","order":1000001}}}`,
 } {if _,err:=Decode([]byte(raw));err==nil{t.Errorf("accepted invalid number: %s",raw)}}
 p,err:=Decode([]byte(`{"expectedWorldVersion":0,"currentMapId":"map","worldFlags":{"x":9007199254740993},"inventory":{"a":{"quantity":2}},"quests":{"q":{"status":"active","order":0.5}}}`))
 if err!=nil{t.Fatal(err)}
 if p.WorldFlags["x"].(json.Number).String()!="9007199254740993"{t.Fatal("lost integer precision")}
}
