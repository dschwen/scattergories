var app = require('http').createServer(handler)
  , io = require('socket.io').listen(app)
  , fs = require('fs')
  , mongodb = require('mongodb'), db, mcol = null, map = {d:[]}
  , files = [ 
      'lib/jquery-1.7.min.js', 'lib/jquery.event.drag-2.0.min.js', 'lib/all.js',
      'css/style.css',
      'sound/complete.oga',
      'index.html', 'favicon.ico' 
    ], cache = {}
  , alias = { '/': '/index.html' }
  , i,j,k
  , cat = [ 'Rivers', 'Capitals', 'On the oceanside', 'Things you find in the forrest', 'Famous females', 'Superheroes', 
            'Things you find at a carnival', 'Dangerous animals', 'Jewlery', 'Colors', 'Things you cannot afford',
            'Things to bring on a camping trip', 'Every party needs this', 'In the cinema', 'At the mall', 'Famous monuments',
            'Games', 'TV shows', 'Plants', 'Pets', 'At the cocktail bar', 'Funny movies', 'Scary things','Cars, makes & models',
            'Bodies of water', 'Musical acts', 'Countries', 'Trouble with the law',  ]
  , selected = []
  , letters = 'ABCDEFGHIJKLMNOPRSTUVWZ'
  , roundletter
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

// select 12 random categories
function selectCats() {
  var i;
  // reinsert old selection
  while( selected.length >0 ) {
    cat.push( selected.splice(0,1)[0] );
  }
  // pick random categories
  for( i = 0; i < 12; ++i ) {
    selected.push( cat.splice( Math.floor( Math.random() * cat.length ), 1 )[0] );
  }
}
for( var j=0;j<5;++j) {
selectCats();
console.log(selected,roundletter);
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

// check for agreement on a consensus decission
function checkConsensus(item) {
  var current = false;

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

}

io.sockets.on('connection', function (socket) {

  socket.emit( 'ready', { motd: '' } );
  users[socket.id] = { ready: false, list: [], name: null };
  
  socket.on('login', function (data) {
    users[socket.id].name = data.name;
    socket.broadcast.emit( 'newuser', { name: users[socket.id].name } );
  });

  socket.on('disconnect', function () {
    io.sockets.emit('userleft', { name: users[socket.id].name } );
    users[socket.id] = undefined;
  });


  // user ready to start next letter
  socket.on('ready', function (data) {
    socket.broadcast.emit( 'ready', data );
    users[socket.id].ready = true;
    
    // check if all users are ready

    // emit contdown start signal
    io.sockets.emit( 'startcountdown' );

    // deliver letter in 3 seconds
    setTimeout( function() {
      // pick letter
      roundletter = letters.substr(  Math.floor( Math.random() * letters.length ), 1 );
      io.sockets.emit( 'startgame', { letter: roundletter } );
    }, 3000);
  } );

  // edit events get applied to the server copy of the map and rebroadcast to all clients
  socket.on('update', function (data) {
    //socket.broadcast.emit( 'update', data );
    user[socket.id].list[data.n] = data.word;
  } );


});

