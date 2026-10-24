// Offline, aggregate-only comparison of two private mongoexport JSONL files.
// No Mongo connection, secrets, writes, or individual owner/run details.
package main

import (
 "bufio"
 "bytes"
 "encoding/hex"
 "encoding/json"
 "flag"
 "io"
 "os"
 "strings"
)

type audit struct {
 Status string `json:"audit"`
 Source int `json:"sourceRuns"`
 Target int `json:"targetRuns"`
 Missing int `json:"missing"`
 WrongOwner int `json:"wrongOwner"`
 ExtraTarget int `json:"extraTarget"`
 ReadOnly bool `json:"readOnly"`
 ProvesGameplay bool `json:"provesGameplayCompatibility"`
}

func runIdentity(line []byte) (string,string,bool) {
 d:=json.NewDecoder(bytes.NewReader(line))
 start,err:=d.Token(); if err!=nil || start!=json.Delim('{') {return "","",false}
 var id,owner string
 hasID,hasOwner:=false,false
 for d.More() {
  token,err:=d.Token();if err!=nil{return "","",false}
  key,ok:=token.(string);if !ok{return "","",false}
  var raw json.RawMessage
  if d.Decode(&raw)!=nil{return "","",false}
  switch key {
  case "_id":
   if hasID{return "","",false};hasID=true
   var value string
   if json.Unmarshal(raw,&value)==nil {
    if strings.TrimSpace(value)=="" {return "","",false}
    id="string:"+value
   } else {
    var obj map[string]json.RawMessage
    if json.Unmarshal(raw,&obj)!=nil || len(obj)!=1{return "","",false}
    rawOID,ok:=obj["$oid"];if !ok || json.Unmarshal(rawOID,&value)!=nil || len(value)!=24 {return "","",false}
    if _,err:=hex.DecodeString(value);err!=nil{return "","",false}
    id="oid:"+strings.ToLower(value)
   }
  case "owner":
   if hasOwner || json.Unmarshal(raw,&owner)!=nil || strings.TrimSpace(owner)=="" {return "","",false}
   hasOwner=true
  }
 }
 end,err:=d.Token()
 if err!=nil || end!=json.Delim('}') || !hasID || !hasOwner{return "","",false}
 var extra any
 if d.Decode(&extra)!=io.EOF{return "","",false}
 return id,owner,true
}

func readArchive(path string)(map[string]string,bool) {
 f,err:=os.Open(path);if err!=nil{return nil,false};defer f.Close()
 scan:=bufio.NewScanner(f)
 scan.Buffer(make([]byte,64*1024),20<<20)
 records:=make(map[string]string)
 for scan.Scan() {
  row:=bytes.TrimSpace(scan.Bytes());if len(row)==0{continue}
  id,owner,ok:=runIdentity(row);if !ok{return nil,false}
  if _,exists:=records[id];exists{return nil,false}
  records[id]=owner
 }
 if scan.Err()!=nil{return nil,false}
 return records,true
}

func compare(source,target map[string]string) audit {
 out:=audit{Status:"complete",Source:len(source),Target:len(target),ReadOnly:true}
 for id,owner:=range source {
  foundOwner,exists:=target[id]
  if !exists {out.Missing++} else if foundOwner!=owner {out.WrongOwner++}
 }
 for id:=range target {if _,exists:=source[id];!exists{out.ExtraTarget++}}
 if out.Missing>0 || out.WrongOwner>0 {out.Status="incomplete"}
 return out
}

func run(args []string,output io.Writer) int {
 flags:=flag.NewFlagSet("legacyreconcile",flag.ContinueOnError)
 flags.SetOutput(io.Discard)
 sourcePath:=flags.String("source","","private source mongoexport JSONL")
 targetPath:=flags.String("target","","private target mongoexport JSONL")
 emit:=func(a audit){_ = json.NewEncoder(output).Encode(a)}
 invalid:=func()int{emit(audit{Status:"input-error",ReadOnly:true});return 2}
 if flags.Parse(args)!=nil || flags.NArg()!=0 || *sourcePath=="" || *targetPath=="" || *sourcePath==*targetPath{return invalid()}
 srcInfo,srcErr:=os.Stat(*sourcePath)
 dstInfo,dstErr:=os.Stat(*targetPath)
 if srcErr!=nil || dstErr!=nil || !srcInfo.Mode().IsRegular() || !dstInfo.Mode().IsRegular() || os.SameFile(srcInfo,dstInfo){return invalid()}
 source,ok:=readArchive(*sourcePath)
 if !ok || len(source)==0{return invalid()} // empty source could be wrong database
 target,ok:=readArchive(*targetPath)
 if !ok{return invalid()}
 result:=compare(source,target);emit(result)
 if result.Status!="complete"{return 1};return 0
}

func main(){os.Exit(run(os.Args[1:],os.Stdout))}
