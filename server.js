var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

var emojiStore = require('./emoji-memory');

var map = {
    width:  50,
    height: 20
};

function assignEmoji(userID) {
    var list = emojiStore.availableEmojis;

    var emojiID = list[Math.floor(Math.random() * list.length)];
    while (!emojiStore.assignEmojiToUserID(userID, emojiID)) {
        emojiID = list[Math.floor(Math.random() * list.length)];
    }

    return emojiID;
}

app.get('/', function(req, res){
    res.sendFile(__dirname + '/index.html');
});

app.use(express.static(__dirname));

http.listen(3000, function(){
    console.log('listening on *:3000');
});

var userPositions = [];
for (var i = 0; i < map.width; i++) {
    userPositions[i] = [];
}

function check(x, boundary) {
  if (x < 0) return 0;
  if (x >= boundary) return boundary - 1;
  return x;
}

function checkWidth(x) { return check(x, map.width) }
function checkHeight(x) { return check(x, map.height) }


function getUserByPosition(x, y, current) {
    x = Math.floor(x);
    y = Math.floor(y);
    for (var i = checkWidth(x - 2); i < checkWidth(x + 2); i++) {
        for (var j = checkHeight(y - 2); j < checkHeight(y + 2); j++) {
            if (userPositions[i][j] !== undefined && userPositions[i][j] !== current) {
                return userPositions[i][j];
            }
        }
    }

}

function getUserInitialPosition() {
    var x = Math.floor(Math.random() * map.width);
    var y = Math.floor(Math.random() * map.height);
    while (getUserByPosition(x, y, {}) !== undefined) {
        var x = Math.floor(Math.random() * map.width);
        var y = Math.floor(Math.random() * map.height);
    }


    return {x: x, y:  y};
}

var users = {};

io.on('connection', function (socket) {

    var userID = socket.id;
    var emojiID = assignEmoji(userID);
    socket.emojiID = emojiID;

    var position = getUserInitialPosition();

    users[userID] = {

        id: userID,
        emoji: emojiID,
        position: position,
    };
    userPositions[position.x][position.y] = users[userID];


    socket.emit('initialMessage', {
        you: users[userID],
        users: users
    });

    socket.broadcast.emit('connected', {
        id: userID,
        emoji: emojiID,
        position: position
    });

    socket.on('disconnect', function () {
        var position = users[userID].position;
        userPositions[position.x][position.y] = null;
        delete users[userID];

        io.emit('disconnected', {
            id: userID,
            emoji: emojiID
        });
    });

    socket.on('messageSent', function (message) {
        console.log('got a chat message', message);

        socket.broadcast.emit('messageReceived', {
            emoji: socket.emojiID,
            message: message,
            id: socket.id
        });
    });

    socket.on('changeEmoji', function (data) {
        // data = {emoji: ':tongue:'};
        if (emojiStore.availableEmojis.indexOf(data.emoji) === -1) {
            this.emit('emojiNotAvailable');
            return;
        }

        var emojiID = emojiStore.assignEmojiToUserID(socket.id, data.emoji);
        if (emojiID === false) {
            this.emit('emojiAlreadyInUse');
            return;
        }

        this.emit('emojiChanged', {emoji: emojiID});


    });

    socket.on('positionChanged', function (position) {
        console.log(position);
	
	var x = Math.floor(position.x);
        var y = Math.floor(position.y);

	if (x < 0 || x >= map.width || y < 0 || y > map.height) {
	    this.emit('positionInvalid', users[userID]);
            return;
	}

        if (getUserByPosition(x, y, users[userID]) !== undefined) {
            this.emit('positionInvalid', users[userID]);
            return;
        }
	
        var current = users[userID].position;

	console.log('Current: ', current);
	
        users[userID].position = {x: x, y: y};
        userPositions[current.x][current.y] = undefined;
	console.log('Updating ', x, y)
        userPositions[x][y] = users[userID];

        //this.emit('positionUpdated', users[userID]);
	socket.broadcast.emit('positionUpdated', users[userID]);
    });
});
