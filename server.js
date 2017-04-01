// Set up express server, and socket server
const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const port = process.env.PORT || 3000;
const turf = require('turf');


server.listen(port, function() {
  console.log('Map Sync Server listening at port %d', port);
});

// Routing
app.use(express.static(__dirname + '/public'));

// Chat room
var numUsers = 0;


// Runs when a new connection is established with the server
io.on('connection', function(socket) {
  var addedUser = false;

  // When client emits 'new message', this listens and executes
  socket.on('new message', function(data) {
    // Tell the client to execute 'new message'
    socket.broadcast.emit('new message', {
      username: socket.username,
      message: data
    });
  });


  // When client emits 'add user', this listens and executes
  socket.on('add user', function(username) {
    if (addedUser) return;

    // Store the username in the socket session for this client
    socket.username = username;
    ++numUsers;
    addedUser = true;
    socket.emit('login', {
      numUsers: numUsers
    });

    // Echo globally (to all clients) that a new person has connected
    socket.broadcast.emit('user joined', {
      username: socket.username,
      numUsers: numUsers
    });
  });

  // When user clicks on map
  socket.on('user clicked', function(data) {
    socket.broadcast.emit('user clicked', {
      username: socket.username,
      coordinates: data
    });
  });

  // When user finishes drawing
  socket.on('feature drawn', function(data, randomID) {
    socket.broadcast.emit('feature drawn', {
      username: socket.username,
      geom: data,
      id: randomID
    });
  });

  // When a feature is deleted
  socket.on('features deleted', function(ids) {
    socket.broadcast.emit('features deleted', {
      username: socket.username,
      ids: ids
    });
  });


  // When a feature is requested to be buffered
  socket.on('buffer feature', function(data, amount, id) {

    var feature = turf.polygon(data);

    var buffered = turf.buffer(feature, amount, 'meters');

    // Broadcast to everyone, including sender
    io.sockets.emit('feature buffered', {
      username: socket.username,
      id: id,
      feature: buffered
    });
  });

  // When two features are requested to be unioned
  socket.on('union features', function(geom1, geom2, id1, id2) {
    var f1 = turf.polygon(geom1);
    var f2 = turf.polygon(geom2);

    var union = turf.union(f1, f2);

    io.sockets.emit('features unioned', {
      username: socket.username,
      feature: union,
      id: Math.random(),
      toRemove: [id1, id2]
    });
  });


  // When the intersection of two features is requested
  socket.on('intersect features', function(geom1, geom2) {
    var f1 = turf.polygon(geom1);
    var f2 = turf.polygon(geom2);

    var intersection = turf.intersect(f1, f2);

    io.sockets.emit('features intersected', {
      username: socket.username,
      feature: intersection,
      id: Math.random()
    });


  });


  // When the user disconnects, do this:
  socket.on('disconnect', function() {
    if (addedUser) {
      --numUsers;

      // Echo globally that this client has left
      socket.broadcast.emit('user left', {
        username: socket.username,
        numUsers: numUsers
      });
    }
  });

});
