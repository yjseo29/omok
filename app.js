var express = require('express')
  , path = require('path')
  , favicon = require('serve-favicon')
  , logger = require('morgan')
  , cookieParser = require('cookie-parser')
  , bodyParser = require('body-parser')
  , routes = require('./routes/index')
  , fs = require('fs')
  , app = express()
  , http = require('http').Server(app);

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// uncomment after placing your favicon in /public
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.set( "ipaddr", "127.0.0.1" );
app.set( "port", 3010 );

var httpServer = http.listen(app.get('port'), function(){
	console.log("Express server listening on port " + app.get('port'));
});

var io = require('socket.io').listen(httpServer);

var session = require('express-session')({
	secret: 'omok game',
	resave: true,
	saveUninitialized: true
});
var sharedsession = require("express-socket.io-session");
app.use(session);

var rooms = [];
var connectCounter = 0;
var lobbyCounter = 0;
var dollColor = "white";
var latestTurnId = "";

io.use(sharedsession(session));

/** controller **/
app.get('/', function(req, res, next) {
	if(req.session.username){
		res.redirect('/lobby');
	}else{
		res.render('home', {'gameUrl':req.params.gameUrl});
	}
});

app.get('/lobby', routes.lobbyGet);
app.post('/lobby', routes.lobbyPost);
app.get('/game/:url', function(req, res) {
	if(rooms[req.params.url] != undefined){
		if(req.session.username){
			res.render('game',{'title':rooms[req.params.url].title,'url':req.params.url, 'username': req.session.username});
		}else{
			res.redirect('/?gameUrl='+req.params.url);
		}
	}else{
		fs.readFile('views/404.html', function(error, data){
			res.writeHead(200, {'Content-Type':'text/html'});
			res.end(data);
		});
	}
});
app.post('/create', function(req, res) {
	var url = makeUrl();

	rooms[url] = new Object();
	rooms[url].title = req.body.title;
	rooms[url].passwd = req.body.passwd;
	rooms[url].url = url;
	rooms[url].user_list = new Object();

	res.redirect('/game/'+url);
});

/*** Socket.IO 추가 ***/
io.on('connection',function(socket){
	connectCounter++;

	/** 로비 초기화 **/
	socket.on("join_lobby", function(data){
		lobbyCounter++;
		var roomList = new Array();
		for(var room in rooms){
			roomList.push(rooms[room]);
		}
		io.sockets.emit('list_room',{rooms:roomList});
	});


	if(connectCounter%2 != 0){
		dollColor = "black";
	}else{
		dollColor = "white";
	}

	/** 방 생성 **/
	socket.on("create_room", function(data){
		var url = data.url;

		if(rooms[url] == undefined) {
			rooms[url] = new Object();
			rooms[url].title = data.title;
			rooms[url].url = url;
			rooms[url].passwd = data.passwd;
			rooms[url].user_list = new Object();

			/*rooms[url].user_list[socket.id] = new Object();
			rooms[url].user_list[socket.id].nickname = socket.username;
			rooms[url].user_list[socket.id].type = "black";

			io.sockets.in(url).emit('broadcast_msg', {msg:socket.username+"님이 방에 입장하였습니다",type:"notify"});*/

			//방목록 업데이트
			var roomList = new Array();
			for(var room in rooms){
				roomList.push(rooms[room]);
			}
			io.sockets.emit('list_room',{rooms:roomList});

			console.log(rooms);
		}else{

		}
	});

	/** 방 입장 **/
	socket.on("join_room", function(data){
		var url = data.url;

		if(rooms[url] != undefined) {
			socket.room = url;
			socket.join(url);
			socket.username = data.username;

			rooms[url].user_list[socket.id] = new Object();
			rooms[url].user_list[socket.id].nickname = socket.username;
			if(Object.keys(rooms[url].user_list).length == 0){
				rooms[url].user_list[socket.id].type = "black";
			}else if(Object.keys(rooms[url].user_list).length == 1){
				rooms[url].user_list[socket.id].type = "white";
			}else{
				rooms[url].user_list[socket.id].type = "viewer";
			}
			io.sockets.in(url).emit('broadcast_msg', {msg:socket.username+"님이 방에 입장하였습니다",type:"notify"});
		}else{
			console.log("!! 존재하지않는 방");
		}
	});

	/** 방 퇴장 **/
	socket.on("leave_room", function(data){

	});

	/** 닉네임 설정 **/
	socket.on("nickname_init", function(data){
		socket.username = data.nickname; //소켓 네임 설정
	});

	/** 게임방 초기화 **/
	socket.emit("omok_init", {id:socket.id,doll_color:dollColor});

	/** 돌 처리 **/
	socket.on('doll_put',function(data){
		var date = new Date();
		var time;
		if (date.getHours() <= 12) {
			time = "오전 "+date.getHours()+":"+parseMinute(date.getMinutes());
		}else {
			time = "오후 "+(date.getHours()-12)+":"+parseMinute(date.getMinutes());
		}

		if(latestTurnId != socket.id){
			io.sockets.in(socket.room).emit('doll_receive', {x:data.x,y:data.y,doll_color:data.doll_color,id:socket.id,time:time});
			latestTurnId = socket.id;
		}
	});

	/** 메시지 전송 처리 **/
	socket.on("send_msg", function(data){
		var date = new Date();
		var time;
		if (date.getHours() <= 12) {
			time = "오전 "+date.getHours()+":"+parseMinute(date.getMinutes());
		}else {
			time = "오후 "+(date.getHours()-12)+":"+parseMinute(date.getMinutes());
		}
		io.sockets.in(socket.room).emit('broadcast_msg', {msg:data.msg,username:socket.username,type:"message",id:socket.id,time:time});
	});

	/** 접속 해제시 **/
	socket.on('disconnect', function(){
		console.log("socket disconnect");
	});
});

io.on('disconnect',function(socket) {

});

function parseMinute(minute){
	if(minute < 10) {
		return "0" + minute;
	}else{
		return minute;
	}
}

function makeUrl(){
	var text = "";
	var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	for( var i=0; i < 6; i++ ) text += possible.charAt(Math.floor(Math.random() * possible.length));

	return text;
}

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});


module.exports = app;
