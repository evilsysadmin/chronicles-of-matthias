// Package legacyread implements the read-only public Chronicles run document
// shape from the established Python and Chess Studio Go APIs.
//
// It intentionally does not implement any HTTP authentication or writes.
package legacyread

import (
 "errors"
 "time"

 "go.mongodb.org/mongo-driver/v2/bson"
)

var ErrCorruptRun = errors.New("invalid legacy Chronicles run document")

// PublicRun is the allowlisted /api/chronicles/runs/{run_id} response.
// Internal owner IDs and create fingerprints must never be serialized.
type PublicRun struct {
 RunID string `json:"runId"`
 Seed int64 `json:"seed"`
 PartyLevel *int64 `json:"partyLevel,omitempty"`
 ContentPlacementVersion *int64 `json:"contentPlacementVersion,omitempty"`
 CurrentMapID string `json:"currentMapId"`
 ContentVersion int64 `json:"contentVersion"`
 ManifestRevision string `json:"manifestRevision"`
 Status string `json:"status"`
 WorldVersion int64 `json:"worldVersion"`
 ConsumedContentIDs []string `json:"consumedContentIds"`
 ClaimedRewards []string `json:"claimedRewards"`
 WorldFlags map[string]any `json:"worldFlags"`
 Inventory map[string]any `json:"inventory"`
 Quests map[string]any `json:"quests"`
 CreatedAt *string `json:"createdAt"`
 UpdatedAt *string `json:"updatedAt"`
 Route *Route `json:"route,omitempty"`
 PlannerSnapshot any `json:"plannerSnapshot,omitempty"`
}

type Route struct {
 PolicyVersion int64 `json:"policyVersion"`
 MapIDs []string `json:"mapIds"`
 PrimaryExitIDs map[string]any `json:"primaryExitIds"`
}

func field(doc bson.D, key string) (any, bool) {
 for _, entry := range doc {
  if entry.Key == key { return entry.Value, true }
 }
 return nil, false
}

func integer(value any) (int64, bool) {
 switch n := value.(type) {
 case int: return int64(n), true
 case int32: return int64(n), true
 case int64: return n, true
 }
 return 0, false
}
func requiredInt(doc bson.D, key string) (int64,error) {
 value,ok:=field(doc,key)
 if !ok {return 0,ErrCorruptRun}
 n,valid:=integer(value)
 if !valid {return 0,ErrCorruptRun}
 return n,nil
}
func optionalInt(doc bson.D, key string) (*int64,error) {
 value,present:=field(doc,key)
 if !present || value==nil {return nil,nil}
 n,ok:=integer(value)
 if !ok{return nil,ErrCorruptRun}
 return &n,nil
}
func requiredString(doc bson.D,key string)(string,error){
 value,ok:=field(doc,key)
 if !ok{return "",ErrCorruptRun}
 s,valid:=value.(string)
 if !valid || s=="" {return "",ErrCorruptRun}
 return s,nil
}
func list(value any)([]string,error){
 result:=[]string{}
 if value==nil{return result,nil}
 switch a:=value.(type){
 case []string:return append(result,a...),nil
 case bson.A:
  for _,v:=range a {
   s,ok:=v.(string)
   if !ok{return nil,ErrCorruptRun}
   result=append(result,s)
  }
 case []any:
  for _,v:=range a {
   s,ok:=v.(string)
   if !ok{return nil,ErrCorruptRun}
   result=append(result,s)
  }
 default:return nil,ErrCorruptRun
 }
 return result,nil
}
func normalized(value any) any {
 switch v:=value.(type) {
 case bson.D:
  obj:=make(map[string]any,len(v))
  for _,e:=range v{obj[e.Key]=normalized(e.Value)}
  return obj
 case bson.M:
  obj:=make(map[string]any,len(v))
  for k,val:=range v{obj[k]=normalized(val)}
  return obj
 case map[string]any:
  obj:=make(map[string]any,len(v))
  for k,val:=range v{obj[k]=normalized(val)}
  return obj
 case bson.A:
  array:=make([]any,0,len(v))
  for _,item:=range v{array=append(array,normalized(item))}
  return array
 case []any:
  array:=make([]any,0,len(v))
  for _,item:=range v{array=append(array,normalized(item))}
  return array
 case []string:
  return append([]string(nil),v...)
 default:return v
 }
}
func object(value any)(map[string]any,error){
 if value==nil{return map[string]any{},nil}
 v:=normalized(value)
 result,ok:=v.(map[string]any)
 if !ok{return nil,ErrCorruptRun}
 return result,nil
}
func timestamp(value any)(*string,error){
 if value==nil{return nil,nil}
 var t time.Time
 switch v:=value.(type){
 case bson.DateTime: t=time.UnixMilli(int64(v)).UTC()
 case time.Time: t=v.UTC()
 default:return nil,ErrCorruptRun
 }
 pattern:="2006-01-02T15:04:05"
 if t.Nanosecond()!=0 {pattern+=".000000"}
 encoded:=t.Format(pattern)
 return &encoded,nil
}

// Public copies and normalizes a *trusted, owner-scoped* BSON record.
// Callers MUST filter by both _id and authenticated owner before invoking it.
func Public(doc bson.D)(PublicRun,error){
 var out PublicRun
 id,err:=requiredString(doc,"_id")
 if err!=nil {id,err=requiredString(doc,"runId")}
 if err!=nil{return out,err}
 out.RunID=id
 if out.Seed,err=requiredInt(doc,"seed");err!=nil{return PublicRun{},err}
 if out.PartyLevel,err=optionalInt(doc,"partyLevel");err!=nil{return PublicRun{},err}
 if out.ContentPlacementVersion,err=optionalInt(doc,"contentPlacementVersion");err!=nil{return PublicRun{},err}
 if out.CurrentMapID,err=requiredString(doc,"currentMapId");err!=nil{return PublicRun{},err}
 if out.ContentVersion,err=requiredInt(doc,"contentVersion");err!=nil{return PublicRun{},err}
 if out.ManifestRevision,err=requiredString(doc,"manifestRevision");err!=nil{return PublicRun{},err}
 out.Status="active"
 if status,present:=field(doc,"status");present{
  s,ok:=status.(string)
  if !ok || s=="" {return PublicRun{},ErrCorruptRun}
  out.Status=s
 }
 if raw,present:=field(doc,"worldVersion");present{
  n,ok:=integer(raw)
  if !ok {return PublicRun{},ErrCorruptRun}
  out.WorldVersion=n
 }
 consumed,_:=field(doc,"consumedContentIds")
 if out.ConsumedContentIDs,err=list(consumed);err!=nil{return PublicRun{},err}
 claimed,_:=field(doc,"claimedRewards")
 if out.ClaimedRewards,err=list(claimed);err!=nil{return PublicRun{},err}
 flags,_:=field(doc,"worldFlags")
 if out.WorldFlags,err=object(flags);err!=nil{return PublicRun{},err}
 inv,_:=field(doc,"inventory")
 if out.Inventory,err=object(inv);err!=nil{return PublicRun{},err}
 quests,_:=field(doc,"quests")
 if out.Quests,err=object(quests);err!=nil{return PublicRun{},err}
 created,_:=field(doc,"createdAt")
 if out.CreatedAt,err=timestamp(created);err!=nil{return PublicRun{},err}
 updated,_:=field(doc,"updatedAt")
 if out.UpdatedAt,err=timestamp(updated);err!=nil{return PublicRun{},err}
 routeIDs,_:=field(doc,"routeMapIds")
 ids,err:=list(routeIDs)
 if err!=nil{return PublicRun{},err}
 if len(ids)>0 {
  route:=&Route{MapIDs:ids}
  if value,present:=field(doc,"routePolicyVersion");present{
   v,ok:=integer(value)
   if !ok {return PublicRun{},ErrCorruptRun}
   route.PolicyVersion=v
  }
  exits,_:=field(doc,"routePrimaryExitIds")
  if route.PrimaryExitIDs,err=object(exits);err!=nil{return PublicRun{},err}
  out.Route=route
 }
 if planner,present:=field(doc,"plannerSnapshot");present && planner!=nil{
  out.PlannerSnapshot=normalized(planner)
 }
 return out,nil
}
