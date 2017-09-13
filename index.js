const http = require('http');
const SocketIO = require('socket.io')
const readFile = require('fs-readfile-promise');
const UglifyJS = require("uglify-js");
const Port = 9999;


const Koa = require('koa');
const Router = require('koa-router');

const app = new Koa();
const router = new Router();

const server = http.createServer(app.use(router.routes()).callback());
const io = SocketIO(server);

router
    .get('/', (ctx, next) => {
        ctx.body = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="initial-scale=1, maximum-scale=1, user-scalable=no, width=device-width">
        <meta name="renderer" content="webkit">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <meta name="HandheldFriendly" content="true">
        <title>LogServer</title>
      </head>
      <body>
        <h1>Log日志推送服务</h1>
        <p>在header最顶部引入js文件:<a href="${ctx.protocol}://${ctx.host}/xxx/log.js" target="_blank">${ctx.protocol}://${ctx.host}/xxx/log.js</a> (xxx为自定义的room) </p>
        <p>log服务访问 <a href="${ctx.protocol}://${ctx.host}/xxx" target="_blank">${ctx.protocol}://${ctx.host}/xxx</a></p>
        <p>log测试页面 <a href="${ctx.protocol}://${ctx.host}/test" target="_blank">${ctx.protocol}://${ctx.host}/test</a></p>
      </body>
      </html>
    `
    })
    .get('/test', (ctx, next) => {
        ctx.body = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>测试</title>
        <meta name="viewport" content="initial-scale=1, maximum-scale=1, user-scalable=no, width=device-width">
        <meta name="renderer" content="webkit">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <meta name="HandheldFriendly" content="true">
        <script src="${ctx.protocol}://${ctx.host}/xxx/log.js"></script>
      </head>
      <body>
        <button onclick="console.log(Math.random())" style="font-size:20px">console.log</button>
        <button onclick="test_error()" style="font-size:20px">测试报错</button>
      </body>
      </html>
    `
    })
    .get('/:namespace/log.js', async(ctx, next) => {
        const namespace = ctx.params.namespace;
        const socketjs = await readFile('./socket.io.min.js').then(res => res.toString())
        var js = `
      (function(global,undefined) {
        try{
          var socket = global.io('${ctx.protocol}://${ctx.host}');
          global.socket=socket;
        }catch(e){}
        if(socket){
          socket.log = true
          socket.on('connect', function (data) {
            socket.emit('join','${namespace}',function(data){
              console.log('join room:'+data)
            });
            window.onerror = function() {
              var log_data=[].slice.call(arguments)
              socket.log && socket.emit('log','${namespace}',{c_id:socket.id,log:log_data,error:true})
            }
            global.console.log = (function(oriLogFunc){
                return function(){
                  var log_data=[].slice.call(arguments)
                  socket.log && socket.emit('log','${namespace}',{c_id:socket.id,log:log_data})
                  oriLogFunc.apply(console,log_data);
                }
            })(global.console.log);
          });
          socket.on('sendEvel', function (evel_str) {
              eval(evel_str)
          });
          socket.on('log_on', function (data) {
            socket.log=data;
          });
        }
      }(this))
    `
        ctx.body = socketjs + UglifyJS.minify(js, { fromString: true }).code;
    })
    .get('/:namespace', async(ctx, next) => {
            const namespace = ctx.params.namespace
            const socketjs = await readFile('./socket.io.min.js').then(res => res.toString())
            const onlineClients = await getOnlineClients()

            const js = `
      var socket = io('${ctx.protocol}://${ctx.host}');
      if(socket){
         document.getElementById('list').addEventListener('click', function(e) {
            if(e.target.tagName=='P'){
              var t=e.target;
              var data = t.parentNode.id
              if(t.style.color){
                socket.emit('log_on',false,data,function(){
                  t.style.color="";
                });
              }else{
                socket.emit('log_on',true,data,function(){
                  t.style.color="#43E443";
                });
              }
            }
            if(e.target.tagName=='BUTTON'){
              var t=e.target;
              var data = t.parentNode.id
              var eval_str=prompt('推送要执行的代码!','alert("test")');
              if(eval_str){
                socket.emit('sendEvel',data,eval_str);
              }
            }
          }, false)
        
        socket.on('connect', function (data) {
          socket.emit('join','${namespace}',function(data){
            console.log('join room:'+data)
          });
        });
        socket.on('client_join', function (data) {
          var li=document.createElement('li');
          li.setAttribute('id',data);

          var btn=document.createElement('button');
          btn.innerText='执行代码';

          var p=document.createElement('p');
          p.innerText=data;
          p.style.color="#43E443";
          li.appendChild(p);
          li.appendChild(btn);
          document.getElementById('list').appendChild(li);
        });
        socket.on('client_level', function (data) {
          var li=document.getElementById(data);
          li && document.getElementById('list').removeChild(li);
        });
        socket.on('log', function (data) {
          if(data.error){
            console.error(data.log[0],'\\n','at:'+data.log[1]+':'+data.log[2]+'@from:'+data.c_id)
          }else{
            data.log.push('from:'+data.c_id)
            console.log.apply(console,data.log)
          }
        });
      }
    `
            ctx.body = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="initial-scale=1, maximum-scale=1, user-scalable=no, width=device-width">
        <meta name="renderer" content="webkit">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <meta name="HandheldFriendly" content="true">
        <title>LogServer On Room:${namespace}</title>
      </head>
      <body>
        <h1>LogServer On Room:${namespace}</h1>
        <h3>在线列表:</h3>
        <p>单击变成绿色开始监听console.log发送的数据(打开控制台看log)</p>
        <ul id="list">
          ${onlineClients.splice(1).map(v=>{
            return `<li id="${v}"><p style="color:#43E443">${v}</p><button>执行代码</button></li>`
          }).join('')}
        </ul>
      </body>
      <script>
        ${socketjs}
        ${UglifyJS.minify(js, {fromString: true}).code}
      </script>
      </html>
    `;
    })
io.on('connection', function(socket) {
    socket.on('join', function(namespace, cb) {
        socket.join(namespace);
        cb(namespace)
        socket.broadcast.to(namespace).emit('client_join', socket.id);
    });
    socket.on('log', function(namespace, data, fn) {
        socket.broadcast.to(namespace).emit('log', data);
    });
    socket.on('log_on', function(status, c_id, fn) {
        fn();
        socket.broadcast.to(c_id).emit('log_on', status);
    });

    socket.on('sendEvel', function(c_id, evel_str) {
        socket.broadcast.to(c_id).emit('sendEvel', evel_str);
    });
    socket.on('disconnect', function() {
        socket.broadcast.emit('client_level', socket.id);
    });
});
const getOnlineClients = () => new Promise((resolve, reject) => {
    io.clients(function(error, clients) {
        if (error) {
            reject(error);
        } else {
            resolve(clients)
        }
    });
})
server.listen(Port);