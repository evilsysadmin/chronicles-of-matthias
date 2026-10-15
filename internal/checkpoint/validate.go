package checkpoint

import (
 "bytes"
 "encoding/json"
 "errors"
 "io"
 "math"
 "math/big"
 "strconv"
 "strings"
 "fmt"
 "unicode/utf8"
)

type Payload struct {
 ExpectedWorldVersion int64 `json:"expectedWorldVersion"`
 CurrentMapID string `json:"currentMapId"`
 WorldFlags map[string]any `json:"worldFlags"`
 Inventory map[string]any `json:"inventory"`
 Quests map[string]any `json:"quests"`
 ConsumedContentIDs []string `json:"consumedContentIds"`
 ClaimedRewards []string `json:"claimedRewards"`
 TerminalStatus *string `json:"terminalStatus"`
}
func Decode(raw []byte)(Payload,error){
 var p Payload
 var fields map[string]json.RawMessage
 if err:=json.Unmarshal(raw,&fields);err!=nil{return p,err}
 if fields==nil{return p,errors.New("checkpoint must be an object")}
 for _,key:=range []string{"expectedWorldVersion","currentMapId"}{value,exists:=fields[key];if !exists||string(value)=="null"{return p,fmt.Errorf("missing required %s",key)}}
 if len(fields["expectedWorldVersion"])==0||fields["expectedWorldVersion"][0]<48||fields["expectedWorldVersion"][0]>57{return p,errors.New("world version must be integer")}
 for _,key:=range []string{"worldFlags","inventory","quests"} {if value,exists:=fields[key];exists&&string(value)!="null"&&len(value)>0&&value[0]!=123{return p,fmt.Errorf("%s must be object",key)}}
 for _,key:=range []string{"consumedContentIds","claimedRewards"} {if value,exists:=fields[key];exists&&string(value)!="null"&&len(value)>0&&value[0]!=91{return p,fmt.Errorf("%s must be array",key)}}
 dec:=json.NewDecoder(bytes.NewReader(raw))
 dec.DisallowUnknownFields()
 dec.UseNumber()
 if err:=dec.Decode(&p);err!=nil{return p,err}
 if err:=dec.Decode(new(any));err!=io.EOF {if err==nil{return p,errors.New("multiple JSON values")};return p,err}
 if p.ExpectedWorldVersion<0{return p,errors.New("negative world version")}
 if p.CurrentMapID==""||utf8.RuneCountInString(p.CurrentMapID)>64{return p,errors.New("invalid map id")}
 if p.TerminalStatus!=nil&&*p.TerminalStatus!="completed"&&*p.TerminalStatus!="defeated"{return p,errors.New("invalid terminal status")}
 if len(p.WorldFlags)>512||len(p.Inventory)>64||len(p.Quests)>64{return p,errors.New("checkpoint collection too large")}
 for _,section:=range []struct{v any;max int}{{p.WorldFlags,65536},{p.Inventory,16384},{p.Quests,32768}} {encoded,err:=json.Marshal(section.v);if err!=nil||len(encoded)>section.max{return p,errors.New("checkpoint section too large")}}
 for index,group:=range [][]string{p.ConsumedContentIDs,p.ClaimedRewards}{
  if len(group)>512{return p,errors.New("too many IDs")}
  seen:=map[string]bool{}
  normalizedIDs:=make([]string,0,len(group))
  for _,id:=range group {normalized:=strings.TrimSpace(id);if normalized==""||utf8.RuneCountInString(normalized)>128{return p,errors.New("invalid ID")};if !seen[normalized]{seen[normalized]=true;normalizedIDs=append(normalizedIDs,normalized)}}
  if index==0{p.ConsumedContentIDs=normalizedIDs}else{p.ClaimedRewards=normalizedIDs}
 }
 for key,value:=range p.WorldFlags {
  if key==""||utf8.RuneCountInString(key)>96{return p,errors.New("invalid flag key")}
  switch v:=value.(type) {
  case nil,bool:
  case json.Number:if _,ok:=new(big.Int).SetString(string(v),10);!ok{return p,fmt.Errorf("flag %q must be integer",key)}
  case string:if utf8.RuneCountInString(v)>256{return p,errors.New("flag too long")}
  default:return p,fmt.Errorf("unsupported flag %q",key)
  }
 }
 for itemID,raw:=range p.Inventory {
  if itemID==""||utf8.RuneCountInString(itemID)>96{return p,errors.New("invalid inventory ID")}
  item,ok:=raw.(map[string]any);if !ok{return p,errors.New("invalid inventory entry")}
  quantity,ok:=item["quantity"].(json.Number);if !ok||!isJSONIntegerInRange(quantity,1,9999){return p,errors.New("invalid inventory quantity")}
  if name,exists:=item["name"];exists {s,ok:=name.(string);if !ok||s==""||utf8.RuneCountInString(s)>160{return p,errors.New("invalid item name")}}
  if desc,exists:=item["description"];exists {s,ok:=desc.(string);if !ok||utf8.RuneCountInString(s)>1024{return p,errors.New("invalid item description")}}
  if _,exists:=item["name"];!exists{item["name"]=itemID}
  if _,exists:=item["description"];!exists{item["description"]=""}
  item["id"]=itemID
 }
 for questID,raw:=range p.Quests {
  if questID==""||utf8.RuneCountInString(questID)>96{return p,errors.New("invalid quest ID")}
  quest,ok:=raw.(map[string]any);if !ok{return p,errors.New("invalid quest entry")}
  status,ok:=quest["status"].(string);if !ok||(status!="active"&&status!="completed"){return p,errors.New("invalid quest status")}
  for key,max:=range map[string]int{"title":200,"description":2048,"objective":1024} {
   if value,exists:=quest[key];exists {
    s,ok:=value.(string);if !ok||utf8.RuneCountInString(s)>max||(key=="title"&&s==""){return p,fmt.Errorf("invalid quest %s",key)}
   }
  }
  if order,exists:=quest["order"];exists {v,ok:=order.(json.Number);if !ok||!isJSONFiniteNumberInRange(v,-1000000,1000000){return p,errors.New("invalid quest order")}}
 }
 return p,nil
}

func isJSONIntegerInRange(v json.Number,min,max int64)bool{
 n,err:=strconv.ParseInt(string(v),10,64)
 return err==nil&&n>=min&&n<=max
}
func isJSONFiniteNumberInRange(v json.Number,min,max float64)bool{
 n,err:=strconv.ParseFloat(string(v),64)
 return err==nil&&!math.IsNaN(n)&&!math.IsInf(n,0)&&n>=min&&n<=max
}
