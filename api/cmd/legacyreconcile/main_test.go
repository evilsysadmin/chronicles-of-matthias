package main

import (
 "bytes"
 "encoding/json"
 "os"
 "path/filepath"
 "strings"
 "testing"
)

func temp(t *testing.T,name,content string) string {
 t.Helper();p:=filepath.Join(t.TempDir(),name)
 if err:=os.WriteFile(p,[]byte(content),0600);err!=nil{t.Fatal(err)}
 return p
}
func check(t *testing.T,source,target string)(int,audit,string){
 t.Helper()
 var out bytes.Buffer
 code:=run([]string{"-source",temp(t,"source.jsonl",source),"-target",temp(t,"target.jsonl",target)},&out)
 var result audit
 if err:=json.Unmarshal(out.Bytes(),&result);err!=nil{t.Fatal(err)}
 return code,result,out.String()
}
func TestAuditIgnoresChangedCheckpointsAndNewTargetSaves(t *testing.T){
 source:="{\"_id\":\"secret-1\",\"owner\":\"alice\",\"inventory\":{\"gold\":2}}\n{\"owner\":\"bob\",\"_id\":\"secret-2\"}\n"
 target:="{\"_id\":\"secret-2\",\"owner\":\"bob\"}\n{\"_id\":\"secret-1\",\"owner\":\"alice\",\"inventory\":{\"gold\":999}}\n{\"_id\":\"native\",\"owner\":\"bob\"}\n"
 status,result,output:=check(t,source,target)
 if status!=0||result.Status!="complete"||result.Source!=2||result.Target!=3||result.ExtraTarget!=1||!result.ReadOnly||result.ProvesGameplay{t.Fatalf("audit failed: %+v (%d)",result,status)}
 for _,secret:=range []string{"alice","bob","secret-1","inventory"}{if strings.Contains(output,secret){t.Fatal("private data leaked")}}
}
func TestAuditCatchesMissingAndCrossOwnerCollision(t *testing.T){
 source:="{\"_id\":\"private-1\",\"owner\":\"alice\"}\n{\"_id\":\"private-2\",\"owner\":\"alice\"}\n"
 target:="{\"_id\":\"private-1\",\"owner\":\"bob\"}\n"
 status,result,output:=check(t,source,target)
 if status!=1||result.Status!="incomplete"||result.Missing!=1||result.WrongOwner!=1{t.Fatalf("unexpected result %+v %d",result,status)}
 if strings.Contains(output,"alice")||strings.Contains(output,"bob")||strings.Contains(output,"private-"){t.Fatal("identity leak")}
}
func TestInvalidOrAmbiguousExportsFailClosed(t *testing.T){
 valid:="{\"_id\":\"valid\",\"owner\":\"person\"}\n"
 invalid:=[]string{"","[]\n","garbage","{\"_id\":\"id\"}\n","{\"_id\":\"x\",\"owner\":5}\n",
 "{\"_id\":\"x\",\"owner\":\" \"}\n","{\"_id\":\"x\",\"owner\":\"a\",\"owner\":\"b\"}\n",
 "{\"_id\":\"x\",\"_id\":\"y\",\"owner\":\"a\"}\n","{\"_id\":null,\"owner\":\"a\"}\n",
 "{\"_id\":\"x\",\"owner\":\"a\"} trailing\n","{\"_id\":\"x\",\"owner\":\"a\"}\n{\"_id\":\"x\",\"owner\":\"b\"}\n",
 "{\"_id\":{\"$oid\":\"nope\"},\"owner\":\"a\"}\n"}
 for i,src:=range invalid{
  code,result,output:=check(t,src,valid)
  if code!=2||result.Status!="input-error"{t.Fatalf("case %d: %+v %d",i,result,code)}
  if strings.Contains(output,"person")||strings.Contains(output,"valid"){t.Fatal("data leak")}
 }
 code,result,_:=check(t,valid,"")
 if code!=1||result.Missing!=1{t.Fatalf("empty target accepted %+v",result)}
}
func TestMongoStringIDAndObjectIDRemainDistinct(t *testing.T){
 id:="0123456789abcdef01234567"
 src:="{\"_id\":{\"$oid\":\""+id+"\"},\"owner\":\"a\"}\n"
 dst:="{\"_id\":\""+id+"\",\"owner\":\"a\"}\n"
 code,result,_:=check(t,src,dst)
 if code!=1||result.Missing!=1||result.ExtraTarget!=1{t.Fatalf("type conflation: %+v",result)}
 dst="{\"_id\":{\"$oid\":\""+strings.ToUpper(id)+"\"},\"owner\":\"a\"}\n"
 code,result,_=check(t,src,dst)
 if code!=0||result.Status!="complete"{t.Fatalf("ObjectID normalization broke: %+v",result)}
}
func TestAliasesToSameExportCannotPretendMigration(t *testing.T){
 src:=temp(t,"archive.jsonl","{\"_id\":\"run\",\"owner\":\"private-owner\"}\n")
 alias:=filepath.Join(t.TempDir(),"alias.jsonl")
 if err:=os.Symlink(src,alias);err!=nil{t.Fatal(err)}
 var out bytes.Buffer
 code:=run([]string{"-source",src,"-target",alias},&out)
 if code!=2 || !strings.Contains(out.String(),"input-error") || strings.Contains(out.String(),"private-owner"){t.Fatalf("same export alias erroneously certified")}
}

func TestArgumentErrorsDoNotPrintPaths(t *testing.T){
 p:=temp(t,"private-username.jsonl","{\"_id\":\"x\",\"owner\":\"secret-owner\"}\n")
 for _,args:=range [][]string{{},{"-source",p},{"-source",p,"-target",p},{"-invalid","secret"}}{
  var out bytes.Buffer
  if run(args,&out)!=2||!strings.Contains(out.String(),"input-error")||strings.Contains(out.String(),"private-username")||strings.Contains(out.String(),"secret-owner"){t.Fatal("unsafe arg response")}
 }
}
