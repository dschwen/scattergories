var app = require('http').createServer(handler)
  , io = require('socket.io').listen(app)
  , fs = require('fs')
  , mongodb = require('mongodb'), db, mcol = null, map = {d:[]}
  , files = [ 
      'lib/jquery-1.7.min.js', 'lib/jquery.event.drag-2.0.min.js', 'lib/all.js',
      'index.html', 'favicon.ico' 
    ], cache = {}
  , alias = { '/': '/index.html' }
  , i,j,k
  , cat = [ 'Rivers', 'Capitals', 'On the oceanside', 'Things you find in the forrest', 'Famous females', 'Superheroes', 
            'Things you find at a carnival', 'Dangerous animals', 'Jewlery', 'Colors', 'Things you cannot afford',
            'Things to bring on a camping trip', 'Every party needs this', 'In the cinema', 'At the mall', 'Famous monuments',
            'Games', 'TV shows', 'Plants', 'Pets' ]
  , letters = 'ABCDEFGHIJKLMNOPRSTUVWZ'
  , users = {}

// build file cache
function addToCache(file) {
  fs.readFile( __dirname + '/' + file,
  function( err, data ) {
    if( err ) {
      throw err;
    }
    cache['/'+file] = data;
  });
}
for( i = 0; i < files.length; ++i ) {
  addToCache(files[i]);
}

// start listening on port
app.listen( process.env.PORT || 8001 );

// serve cached files, return error if not explicitly listed in files table
function handler( req, res ) {
  console.log(req.url);

  // apply aliasing
  if( alias[req.url] ) {
    req.url = alias[req.url];
  } 

  // trap invalid requests
  if( !cache[req.url] ) {
    res.writeHead(500);
    return res.end('Error loading ' + req.url);
  }

  res.writeHead(200);
  res.end(cache[req.url]);
}

io.sockets.on('connection', function (socket) {

  socket.emit( 'ready', { motd: 'no news today!', map: map.d } );
  socket.broadcast.emit( 'newuser', { id: socket.id } );
  users[socket.id] = { ready: false, list: [] };
  
  socket.on('disconnect', function () {
    users[socket.id] = undefined;
    io.sockets.emit('userleft', { id: socket.id } );
  });

  // user ready to start round
  socket.on('ready', function (data) {
    socket.broadcast.emit( 'ready', data );
    users[socket.id].ready = true;
    
    // check if all users are ready
    for( id in users ) { 
      if( users.hasOwnProperty(id) ) {
        if( !users[id].ready ) return;
      }
    }

    // reset ready states
    for( id in users ) { 
      if( users.hasOwnProperty(id) ) {
        users[id].ready = false;
      }
    }

    // emit contdown start signal
    io.sockets.emit( 'startcountdown' );

    // deliver letter in 3 seconds
    setTimeout( function() {
      io.sockets.emit( 'startgame', { letter: 'A' } );
    }, 3000);
  } );

  // edit events get applied to the server copy of the map and rebroadcast to all clients
  socket.on('update', function (data) {
    //socket.broadcast.emit( 'update', data );
    user[socket.id].list[data.n] = data.word;
  } );


});

