package checkpoint
import "testing"
func TestCheckpointValidation(t *testing.T){
 valid:=[]byte(`{"expectedWorldVersion":0,"currentMapId":"swordhaven-square","worldFlags":{"visited":true},"inventory":{},"quests":{}}`)
 if _,err:=Decode(valid);err!=nil{t.Fatal(err)}
 for _,raw:=range []string{
  `{"expectedWorldVersion":-1,"currentMapId":"map"}`,
  `{"expectedWorldVersion":0,"currentMapId":""}`,
  `{"expectedWorldVersion":0,"currentMapId":"map","worldFlags":{"bad":[]}}`,
  `{"expectedWorldVersion":0,"currentMapId":"map","terminalStatus":"invalid"}`,
  `{"expectedWorldVersion":0,"currentMapId":"map","unknown":true}`,
 } {if _,err:=Decode([]byte(raw));err==nil{t.Errorf("accepted invalid %s",raw)}}
}
