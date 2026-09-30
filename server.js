const express=require('express');
const http=require('http');
const {Server}=require('socket.io');
const fs=require('fs');
const app=express();
const server=http.createServer(app);
const io=new Server(server,{maxHttpBufferSize:1e8});
app.use(express.static('public'));
let users={}; // username -> {id,name,username,password,dp}
let online={}; // id -> socket
try{ users=JSON.parse(fs.readFileSync('users.json')); }catch(e){}
function save(){ fs.writeFileSync('users.json', JSON.stringify(users)); }

io.on('connection',socket=>{
  socket.on('register',({name,username,password})=>{
    username=username.toLowerCase();
    if(users[username]) return socket.emit('authError','Username taken');
    let id='u_'+Date.now();
    let dp=`https://i.pravatar.cc/150?u=${id}`;
    users[username]={id,name,username,password,dp};
    save();
    socket.emit('authOk',users[username]);
  });
  socket.on('login',({username,password})=>{
    username=username.toLowerCase();
    let u=users[username];
    if(!u) return socket.emit('authError','User not found');
    if(u.password!==password) return socket.emit('authError','Wrong password');
    socket.emit('authOk',u);
  });
  socket.on('join',u=>{
    online[u.id]=socket.id;
    socket.userId=u.id;
    socket.join(u.id);
    io.emit('users',Object.values(users));
  });
  socket.on('searchUser',q=>{
    q=q.toLowerCase();
    let res=Object.values(users).filter(u=>u.username.includes(q)||u.name.toLowerCase().includes(q)).slice(0,10);
    socket.emit('searchResult',res);
  });
  socket.on('send',d=>{
    io.to(d.to).emit('receive',d);
    socket.emit('sent',d);
  });
  socket.on('call',{to,from,offer,type})=>{
    io.to(to).emit('incomingCall',{from,offer,type});
  });
  socket.on('answer',{to,answer})=>{
    io.to(to).emit('callAnswered',{answer});
  });
  socket.on('ice',{to,candidate})=>{
    io.to(to).emit('ice',{candidate});
  });
  socket.on('endCall',{to})=>{
    io.to(to).emit('callEnded');
  });
  socket.on('updateProfile',({id,name,dp})=>{
    let uname=Object.keys(users).find(k=>users[k].id===id);
    if(uname){ if(name) users[uname].name=name; if(dp) users[uname].dp=dp; save(); io.emit('users',Object.values(users)); }
  });
  socket.on('disconnect',()=>{
    if(socket.userId) delete online[socket.userId];
  });
});
server.listen(3000,()=>console.log('running 3000'));
