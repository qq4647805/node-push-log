# node-push-log
把客户端的console.log和error推送到服务器  
通过访问服务端的日志页面,可以控制开关监听,显示日志,推送代码的功能  
并且加入了room隔离,可以隔离监控多个应用的日志

安装&启动
```
npm install --save
npm start
```
1. 打开 [http://127.0.0.1:9999](http://127.0.0.1:9999/)  
2. 切换room [http://127.0.0.1:9999/myApp](http://127.0.0.1:9999/myApp)
3. 把[http://127.0.0.1:9999/myApp/log.js](http://127.0.0.1:9999/myApp/log.js)引入html(建议在header的最上边)
4. 在[http://127.0.0.1:9999/myApp](http://127.0.0.1:9999/myApp)控制监控或操作客户端日志
