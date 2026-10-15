package checkpoint
import "testing"
func TestInventoryDefaults(t *testing.T){
 p,err:=Decode([]byte(`{"expectedWorldVersion":0,"currentMapId":"map","inventory":{"sword":{"quantity":2}}}`))
 if err!=nil{t.Fatal(err)}
 item:=p.Inventory["sword"].(map[string]any)
 if item["name"]!="sword"||item["description"]!=""||item["id"]!="sword"{t.Fatalf("wrong inventory defaults: %#v",item)}
}
