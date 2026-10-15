package checkpoint

import (
 "encoding/json"
 "testing"
)

func TestQuestDefaults(t *testing.T) {
 p,err:=Decode([]byte(`{"expectedWorldVersion":0,"currentMapId":"map","quests":{"rescue":{"status":"active"}}}`))
 if err!=nil{t.Fatal(err)}
 q:=p.Quests["rescue"].(map[string]any)
 if q["id"]!="rescue"||q["title"]!="rescue"||q["description"]!=""||q["objective"]!=""||q["order"].(json.Number).String()!="0" {t.Fatalf("bad quest defaults: %#v",q)}
}

func TestQuestExplicitFieldsRemain(t *testing.T) {
 p,err:=Decode([]byte(`{"expectedWorldVersion":0,"currentMapId":"map","quests":{"rescue":{"status":"completed","title":"Hero","description":"Done","objective":"Return","order":0.5}}}`))
 if err!=nil{t.Fatal(err)}
 q:=p.Quests["rescue"].(map[string]any)
 if q["title"]!="Hero"||q["description"]!="Done"||q["objective"]!="Return"||q["order"].(json.Number).String()!="0.5" {t.Fatalf("changed quest values: %#v",q)}
}
