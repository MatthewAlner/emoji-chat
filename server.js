var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

var emojiStore = require('./emoji-memory');

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

io.on('connection', function (socket) {

	var userID = socket.id;
	var emojiID = assignEmoji(userID);
	socket.emojiID = emojiID;

    io.emit('initialMessage', {
        id: userID,
        emoji: emojiID,
        position: {
            x: Math.random() * 100,
            y: Math.random() * 100
        }
    });

	socket.broadcast.emit('connected', {
		id: userID,
		emoji: emojiID,
		position: {
			x: Math.random() * 100,
			y: Math.random() * 100
		}
	});

	socket.on('disconnect', function () {
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
		// data	= {emoji: ':tongue:'};
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
});
