package main

import (
 "errors"
 "os"
 "path/filepath"
 "strings"
 "testing"
)

func TestMongoURIFromEnvironment(t *testing.T) {
 t.Run("no configuration",func(t *testing.T){
  t.Setenv("CHRONICLES_MONGODB_URI","")
  t.Setenv("CHRONICLES_MONGODB_URI_FILE","")
  got,err:=mongoURIFromEnvironment()
  if err!=nil||got!="" {t.Fatalf("got %q, %v",got,err)}
 })
 t.Run("legacy environment",func(t *testing.T){
  t.Setenv("CHRONICLES_MONGODB_URI","mongodb://local:27017")
  t.Setenv("CHRONICLES_MONGODB_URI_FILE","")
  got,err:=mongoURIFromEnvironment()
  if err!=nil||got!="mongodb://local:27017" {t.Fatalf("got %q, %v",got,err)}
 })
 t.Run("file secret",func(t *testing.T){
  t.Setenv("CHRONICLES_MONGODB_URI","")
  secret:=filepath.Join(t.TempDir(),"uri")
  if err:=os.WriteFile(secret,[]byte("mongodb://local:27017\n"),0600);err!=nil {t.Fatal(err)}
  t.Setenv("CHRONICLES_MONGODB_URI_FILE",secret)
  got,err:=mongoURIFromEnvironment()
  if err!=nil||got!="mongodb://local:27017" {t.Fatalf("got %q, %v",got,err)}
 })
 t.Run("conflicting sources",func(t *testing.T){
  t.Setenv("CHRONICLES_MONGODB_URI","mongodb://direct")
  t.Setenv("CHRONICLES_MONGODB_URI_FILE","/run/secrets/mongo_uri")
  if _,err:=mongoURIFromEnvironment();!errors.Is(err,errMongoSecret) {t.Fatalf("expected conflict, got %v",err)}
 })
 t.Run("relative file rejected",func(t *testing.T){
  t.Setenv("CHRONICLES_MONGODB_URI","")
  t.Setenv("CHRONICLES_MONGODB_URI_FILE","secret.txt")
  if _,err:=mongoURIFromEnvironment();!errors.Is(err,errMongoSecret) {t.Fatalf("expected failure, got %v",err)}
 })
 t.Run("missing file rejected",func(t *testing.T){
  t.Setenv("CHRONICLES_MONGODB_URI","")
  t.Setenv("CHRONICLES_MONGODB_URI_FILE",filepath.Join(t.TempDir(),"missing"))
  if _,err:=mongoURIFromEnvironment();!errors.Is(err,errMongoSecret) {t.Fatalf("expected failure, got %v",err)}
 })
 t.Run("empty file rejected",func(t *testing.T){
  t.Setenv("CHRONICLES_MONGODB_URI","")
  secret:=filepath.Join(t.TempDir(),"uri")
  if err:=os.WriteFile(secret,[]byte("\n"),0600);err!=nil {t.Fatal(err)}
  t.Setenv("CHRONICLES_MONGODB_URI_FILE",secret)
  if _,err:=mongoURIFromEnvironment();!errors.Is(err,errMongoSecret) {t.Fatalf("expected failure, got %v",err)}
 })
 t.Run("oversize file rejected",func(t *testing.T){
  t.Setenv("CHRONICLES_MONGODB_URI","")
  secret:=filepath.Join(t.TempDir(),"uri")
  if err:=os.WriteFile(secret,[]byte(strings.Repeat("x",4097)),0600);err!=nil {t.Fatal(err)}
  t.Setenv("CHRONICLES_MONGODB_URI_FILE",secret)
  if _,err:=mongoURIFromEnvironment();!errors.Is(err,errMongoSecret) {t.Fatalf("expected failure, got %v",err)}
 })
 t.Run("symlink rejected",func(t *testing.T){
  t.Setenv("CHRONICLES_MONGODB_URI","")
  root:=t.TempDir()
  target:=filepath.Join(root,"uri")
  link:=filepath.Join(root,"link")
  if err:=os.WriteFile(target,[]byte("mongodb://local"),0600);err!=nil{t.Fatal(err)}
  if err:=os.Symlink(target,link);err!=nil{t.Fatal(err)}
  t.Setenv("CHRONICLES_MONGODB_URI_FILE",link)
  if _,err:=mongoURIFromEnvironment();!errors.Is(err,errMongoSecret) {t.Fatalf("expected failure, got %v",err)}
 })
}
