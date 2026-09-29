const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" }, maxHttpBufferSize: 1e8 });

const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let users = {};

io.on('connection', socket => {
  socket.on('join', (name) => {
    users[socket.id] = name;
    io.emit('users', Object.values(users));
  });
  socket.on('msg', (data) => io.emit('msg', data));
  socket.on('private_msg', (data) => {
    const targetId = Object.keys(users).find(k => users[k] === data.to);
    if(targetId) io.to(targetId).emit('private_msg', data);
    socket.emit('private_msg', data);
  });
  socket.on('file', (data) => io.emit('file', data));
  socket.on('call_user', (data) => {
    const targetId = Object.keys(users).find(k => users[k] === data.to);
    if(targetId) io.to(targetId).emit('incoming_call', { from: users[socket.id], offer: data.offer });
  });
  socket.on('answer_call', (data) => {
    const targetId = Object.keys(users).find(k => users[k] === data.to);
    if(targetId) io.to(targetId).emit('call_answered', data);
  });
  socket.on('ice', (data) => {
    const targetId = Object.keys(users).find(k => users[k] === data.to);
    if(targetId) io.to(targetId).emit('ice', data);
  });
  socket.on('disconnect', () => {
    delete users[socket.id];
    io.emit('users', Object.values(users));
  });
});

app.get('*', (req,res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

server.listen(PORT, () => console.log('WhatsApp Clone Live on ' + PORT));
