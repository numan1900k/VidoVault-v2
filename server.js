const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { cors: { origin: "*" } });
const path = require('path');

app.use(express.static(path.join(__dirname, 'public')));

let users = {}; // id -> {id,name,username,dp,socketId,online}

app.get('/', (req,res)=> res.sendFile(path.join(__dirname,'public','index.html')));
app.get('/clear', (req,res)=>{ users={}; res.send('cleared all ✅ ab sab username free hai'); });

function isTaken(name, myId){
  name=name.toLowerCase().trim();
  return Object.values(users).some(u=> u.username.toLowerCase()===name && u.id!==myId && u.online);
}

io.on('connection', (socket)=>{

  socket.on('checkUsername', ({q, myId})=>{
    socket.emit('checkResult', {q, available:!isTaken(q, myId)});
  });

  socket.on('join', (data)=>{
    data.username = data.username.toLowerCase().trim();
    if(isTaken(data.username, data.id)){
      return socket.emit('usernameTaken');
    }
    // same username ka purana offline delete
    Object.keys(users).forEach(k=>{ if(users[k].username===data.username && k!==data.id) delete users[k]; });

    users[data.id] = { id:data.id, name:data.name, username:data.username, dp:data.dp, socketId:socket.id, online:true };
    socket.userId = data.id;
    socket.emit('joinOk', users[data.id]);
    io.emit('users', Object.values(users));
    console.log('JOINED:', data.username, 'Total:', Object.keys(users).length);
  });

  socket.on('searchUser', (q)=>{
    q=q.toLowerCase().trim();
    if(!q) return;
    // saare users me search, online/offline dono
    let res = Object.values(users).filter(u=> u.username.includes(q) || u.name.toLowerCase().includes(q)).slice(0,20);
    socket.emit('searchResult', res);
  });

  socket.on('send', (data)=>{
    // data = {msgId,text,from,to,time}
    let target = users[data.to];
    if(!target){
      // username se bhi dhoondo
      target = Object.values(users).find(u=>u.username===data.to);
    }
    if(target && target.socketId){
      io.to(target.socketId).emit('receive', data);
      // sender ko delivered tick bhejo
      socket.emit('delivered', {msgId: data.msgId});
    }
  });

  socket.on('updateProfile', (data)=>{
    data.username=data.username.toLowerCase().trim();
    if(isTaken(data.username, data.id)) return socket.emit('usernameTaken');
    Object.keys(users).forEach(k=>{ if(users[k].username===data.username && k!==data.id) delete users[k]; });
    if(users[data.id]){
      users[data.id] = {...users[data.id], name:data.name, username:data.username, dp:data.dp, socketId: users[data.id].socketId, online:true};
      socket.emit('profileUpdated', users[data.id]);
      io.emit('users', Object.values(users));
    }
  });

  socket.on('deleteMsg', (d)=> io.emit('deleteMsg', d));
  socket.on('typing', (d)=>{
    let target = users[d.to];
    if(target) io.to(target.socketId).emit('typing', {from:d.from});
  });

  socket.on('disconnect', ()=>{
    if(socket.userId && users[socket.userId]){
      users[socket.userId].online=false;
      // 10 sec baad offline ko list se hata do taaki search clean rahe
      setTimeout(()=>{ if(users[socket.userId] &&!users[socket.userId].online) delete users[socket.userId]; }, 10000);
      io.emit('users', Object.values(users));
    }
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, ()=> console.log('Running '+PORT));
