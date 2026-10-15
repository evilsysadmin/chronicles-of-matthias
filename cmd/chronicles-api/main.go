package main

import (
 "context"
 "errors"
 "fmt"
 "log"
 "net"
 "net/http"
 "os"
 "time"
)

func healthcheck() error {
 ctx,cancel:=context.WithTimeout(context.Background(),2*time.Second)
 defer cancel()
 dialer:=net.Dialer{}
 conn,err:=dialer.DialContext(ctx,"tcp","127.0.0.1:8080")
 if err!=nil{return err}
 defer conn.Close()
 if _,err=fmt.Fprintf(conn,"GET /healthz HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n");err!=nil{return err}
 buf:=make([]byte,128)
 n,err:=conn.Read(buf)
 if err!=nil{return err}
 if n<12 || string(buf[:12])!="HTTP/1.1 200" {return errors.New("unhealthy HTTP response")}
 return nil
}
func handler() http.Handler {
 mux:=http.NewServeMux()
 mux.HandleFunc("GET /healthz",func(w http.ResponseWriter,r *http.Request){w.Header().Set("Content-Type","application/json");w.Write([]byte("{\"status\":\"ok\"}"))})
 return mux
}
func main(){
 if len(os.Args)==2 && os.Args[1]=="healthcheck" {if err:=healthcheck();err!=nil{log.Fatal(err)};return}
 if len(os.Args)!=1 {log.Fatal("usage: chronicles-api [healthcheck]")}
 server:=&http.Server{Addr:":8080",Handler:handler(),ReadHeaderTimeout:5*time.Second}
 log.Fatal(server.ListenAndServe())
}
