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
  , cat = [ 'Rivers', 'Capitals', 'On the oceanside', 'Things you find in the forrest', 
            'Famous females', 'Superheroes', 'Things you find at a carnival', 
            'Dangerous animals', 'Jewlery', 'Colors', 'Things you cannot afford',
            'Things to bring on a camping trip', 'Every party needs this', 'In the cinema', 
            'At the mall', 'Famous monuments', 'Games', 'TV shows', 'Plants', 'Pets', 
            'At the cocktail bar', 'Funny movies', 'Scary things','Cars, makes & models',
            'Bodies of water', 'Musical acts', 'Countries', 'Trouble with the law', 
            'Car parts', 'Magazines and journals' 
          ]
  , selected = []
  , letters = 'ABCDEFGHIJKLMNOPRSTUVWZ'
  , roundletter
  , users = {}
  , votes = {}

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

// change all users with status from to status to
function changeStatus(from, to) {
  var id;

  for( id in users ) { 
    if( users.hasOwnProperty(id) ) {
      // only consider users with the required status
      if( users[id].status === from ) {
        users[id].status = to;
      }
    }
  }
}

// open vote and add callback
function openVote(item,callback,requiredStatus) {
  votes[item] = { fn: callback, status: requiredStatus };
}
// close vote
function closeVote(item,callback) {
  votes[item] = undefined;
}
// check for agreement on a consensus decission
function checkConsensus(item) {
  var id, current = undefined, nplayer = 0;

  for( id in users ) { 
    if( users.hasOwnProperty(id) ) {
      // only consider users with the required status
      if( users[id].status !== votes[item].status ) continue;

      nplayer++;
      
      // at least one player has not voted yet
      if( users[id].vote[item] === undefined ) return undefined;
      
      if( current === undefined ) {
        // looking at first vote
        current = users[id].vote[item];
      } else {
        // are subsequent votes identical?
        if( current !== users[id].vote[item] ) return undefined;
      }
    }
  }

  // need more than one player for a consensus
  if( nplayer <= 1 ) return undefined;
  
  // reset votes
  for( id in users ) { 
    if( users.hasOwnProperty(id) ) {
      users[id].vote[item] = undefined;
    }
  }

  // broadcast and return vote result
  io.sockets.emit('vote', { item: item, outcome: current } );
  return current;
}

// init game
function initGame() {
  // select categories for the next game
  selectCats();

  // user ready to start next letter
  openVote('ready',function(consensus) {
    if( consensus ) {
      console.log('All players ready!')
      // deliver letter in 3 seconds
      setTimeout( function() {
        // pick and send letter
        roundletter = letters.substr(  Math.floor( Math.random() * letters.length ), 1 );
        io.sockets.emit( 'startround', { letter: roundletter } );

        // set status to 2 (in round)
        changeStatus(1,2);

        // stop round in 3 minutes
        setTimeout( function() {
          // set status to 3 (after round)
          changeStatus(2,3);

          // stop round by sending every user the server copy of their list
          for( id in users ) { 
            if( users.hasOwnProperty(id) ) {
              // only consider users with the required status
              if( users[id].status === 3 ) {
                users[id].socket.emit('stopround', { list: users[id].list } );
              }
            }
          }
        }, 3*60*1000 );
      }, 3000);
    } else {
      console.log('No players ready!')
      initGame();
    }
  },1);
}
initGame();

io.sockets.on('connection', function (socket) {

  socket.emit( 'ready', { motd: '' } );
  users[socket.id] = { ready: false, list: [], name: null, vote: {}, status: 0, socket: socket };
  
  socket.on('login', function (data) {
    users[socket.id].name = data.name;
    users[socket.id].status = 1;
    socket.broadcast.emit( 'newuser', { name: users[socket.id].name } );
    socket.emit( 'categories', { list: selected } );
  });

  socket.on('disconnect', function () {
    io.sockets.emit('userleft', { name: users[socket.id].name } );
    users[socket.id] = undefined;
  });

  socket.on('vote', function (data) {
    // is the vote open (callback set)
    if( votes[data.item] === undefined ) {
      console.log('Cheating! Voting on closed vote!');
      return false;
    }
    if( votes[data.item].status !== users[socket.id].status ) {
      console.log('User is not in the correct status!');
      return false;
    }

    // apply vote and vheck consensus
    users[socket.id].vote[data.item] = data.vote;
    var consensus = checkConsensus(data.item),
        callback = votes[data.item].fn;
    if( consensus !== undefined ) {
      closeVote(data.item);
      callback(consensus);
    }
  });

  // edit events get applied to the server copy of the map and rebroadcast to all clients
  socket.on('update', function (data) {
    //socket.broadcast.emit( 'update', data );
    if( users[socket.id].status === 2 ) {
      users[socket.id].list[data.n] = data.word;
      console.log(data);
    }
  } );


});

