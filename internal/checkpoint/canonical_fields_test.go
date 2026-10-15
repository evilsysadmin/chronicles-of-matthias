package checkpoint

import "testing"

func TestCanonicalFieldsOnly(t *testing.T) {
 raw:=[]byte(`{"expectedWorldVersion":0,"currentMapId":"map","inventory":{"blade":{"id":"spoofed","quantity":1,"extra":"ignored"}},"quests":{"quest":{"id":"spoofed","status":"active","extra":{"nested":true}}}}`)
 p,err:=Decode(raw)
 if err!=nil{t.Fatal(err)}
 item:=p.Inventory["blade"].(map[string]any)
 if item["id"]!="blade"{t.Fatalf("item ID not canonical: %#v",item)}
 if _,ok:=item["extra"];ok{t.Fatalf("unexpected inventory field: %#v",item)}
 quest:=p.Quests["quest"].(map[string]any)
 if quest["id"]!="quest"{t.Fatalf("quest ID not canonical: %#v",quest)}
 if _,ok:=quest["extra"];ok{t.Fatalf("unexpected quest field: %#v",quest)}
}
