package main

import (
 "bytes"
 "errors"
 "os"
 "path/filepath"
)

var errReadConfig = errors.New("invalid staging read API configuration")

// stagingReadOptionsFromEnv never loads a signing key unless reads were
// explicitly enabled. The default deployment remains health/readiness only.
func stagingReadOptionsFromEnv() (readOptions,error) {
 flag:=os.Getenv("CHRONICLES_ENABLE_READ_API")
 if flag=="" || flag=="false" {return readOptions{},nil}
 if flag!="true" || os.Getenv("CHRONICLES_ENVIRONMENT")!="staging" {
  return readOptions{},errReadConfig
 }
 secret,err:=readSigningKey(os.Getenv("CHRONICLES_JWT_SECRET_FILE"))
 if err!=nil {return readOptions{},errReadConfig}
 return readOptions{Enabled:true,Environment:"staging",SessionSecret:secret},nil
}

// A mounted file is mandatory for staging; never accept key material directly
// in a command-line argument or in the Docker Compose manifest.
func readSigningKey(path string)([]byte,error) {
 if !filepath.IsAbs(path) {return nil,errReadConfig}
 info,err:=os.Lstat(path)
 if err!=nil || !info.Mode().IsRegular() || info.Size()<32 || info.Size()>4096 {
  return nil,errReadConfig
 }
 contents,err:=os.ReadFile(path)
 if err!=nil {return nil,errReadConfig}
 key:=bytes.TrimSuffix(contents,[]byte("\n"))
 key=bytes.TrimSuffix(key,[]byte("\r"))
 if len(key)<32 || len(key)>4096 || bytes.IndexByte(key,0)>=0 {
  return nil,errReadConfig
 }
 return key,nil
}
