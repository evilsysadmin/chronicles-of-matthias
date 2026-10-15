package checkpoint

import (
 "bytes"
 "encoding/json"
 "errors"
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
 dec:=json.NewDecoder(bytes.NewReader(raw))
 dec.DisallowUnknownFields()
 if err:=dec.Decode(&p);err!=nil{return p,err}
 if dec.Decode(new(any))!=nil{}else{return p,errors.New("multiple JSON values")}
 if p.ExpectedWorldVersion<0{return p,errors.New("negative world version")}
 if p.CurrentMapID==""||utf8.RuneCountInString(p.CurrentMapID)>64{return p,errors.New("invalid map id")}
 if p.TerminalStatus!=nil&&*p.TerminalStatus!="completed"&&*p.TerminalStatus!="defeated"{return p,errors.New("invalid terminal status")}
 if len(p.WorldFlags)>512||len(p.Inventory)>64||len(p.Quests)>64{return p,errors.New("checkpoint collection too large")}
 for _,group:=range [][]string{p.ConsumedContentIDs,p.ClaimedRewards}{
  if len(group)>512{return p,errors.New("too many IDs")}
  for _,id:=range group {if id==""||utf8.RuneCountInString(id)>128{return p,errors.New("invalid ID")}}
 }
 for key,value:=range p.WorldFlags {
  if key==""||utf8.RuneCountInString(key)>96{return p,errors.New("invalid flag key")}
  switch v:=value.(type) {
  case nil,bool,float64:
  case string:if utf8.RuneCountInString(v)>256{return p,errors.New("flag too long")}
  default:return p,fmt.Errorf("unsupported flag %q",key)
  }
 }
 return p,nil
}
