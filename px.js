const http=require('http'),net=require('net'),{spawn}=require('child_process');
let nxt=null;
function go(){
  if(nxt)return;
  nxt=spawn('node',['node_modules/next/dist/bin/next','start','-p','3001','-H','127.0.0.1'],{
    cwd:'/home/z/my-project',env:{...process.env,NODE_OPTIONS:'--dns-result-order=ipv4first'},stdio:'ignore',detached:true
  });
  nxt.unref();
}
function chk(cb){const s=net.connect(3001,'127.0.0.1',()=>{s.destroy();cb(true)});s.on('error',()=>{s.destroy();cb(false)});s.setTimeout(1000,()=>{s.destroy();cb(false)})}
http.createServer((q,r)=>{
  chk(ok=>{
    if(ok){
      const p=http.request({hostname:'127.0.0.1',port:3001,path:q.url,method:q.method,headers:q.headers},pr=>{r.writeHead(pr.statusCode,pr.headers);pr.pipe(r)});
      p.on('error',()=>{r.writeHead(502);r.end()});q.pipe(p);
    }else{
      go();
      let a=0;const t=()=>{chk(o=>{if(o){const p=http.request({hostname:'127.0.0.1',port:3001,path:q.url,method:q.method,headers:q.headers},pr=>{r.writeHead(pr.statusCode,pr.headers);pr.pipe(r)});p.on('error',()=>{r.writeHead(504);r.end()});q.pipe(p)}else if(a++<40)setTimeout(t,500);else{r.writeHead(504);r.end('starting...')}})};
      r.on('close',()=>a=999);
      t();
    }
  });
}).listen(3000,'127.0.0.1',()=>{console.log('px:3000');go()});
