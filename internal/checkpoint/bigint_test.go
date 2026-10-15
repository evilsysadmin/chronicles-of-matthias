package checkpoint
import (
 "encoding/json"
 "testing"
)
func TestArbitraryPrecisionWorldFlags(t *testing.T){
 raw:=[]byte(`{"expectedWorldVersion":0,"currentMapId":"map","worldFlags":{"large":12345678901234567890123456789012345678901234567890,"negative":-123456789012345678901234567890}}`)
 p,err:=Decode(raw);if err!=nil{t.Fatal(err)}
 if p.WorldFlags["large"].(json.Number).String()!="12345678901234567890123456789012345678901234567890"{t.Fatal("large integer changed")}
 if p.WorldFlags["negative"].(json.Number).String()!="-123456789012345678901234567890"{t.Fatal("negative integer changed")}
}
