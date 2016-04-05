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
var lobbyCounter = 0;

io.use(sharedsession(session));

/** controller **/
app.get('/', function(req, res, next) {
	if(req.session.username){
		res.redirect('/lobby');
	}else{
		res.render('home', {'gameUrl':req.query.gameUrl});
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

/*** Socket.IO 추가 ***/
io.on('connection',function(socket){

	/** 로비 초기화 **/
	socket.on("join_lobby", function(data){
		socket.username = data.username;
		socket.room = "lobby";
		socket.join("lobby");
		lobbyCounter++;
		var roomList = new Array();
		for(var room in rooms){
			roomList.push(rooms[room]);
		}
		io.sockets.in("lobby").emit('list_room',{rooms:roomList});
		io.sockets.in("lobby").emit('lobby_usercnt',{cnt:lobbyCounter});
	});

	/** 방 생성 **/
	socket.on("create_room", function(data){
		var url = makeUrl();

		if(rooms[url] == undefined) {
			rooms[url] = new Object();
			rooms[url].title = data.title;
			rooms[url].url = url;
			rooms[url].last_turn = "";
			rooms[url].passwd = data.passwd;
			rooms[url].username = socket.username;
			rooms[url].state = "ready";
			rooms[url].time = getTime();
			rooms[url].user_list = new Object();

			//방목록 업데이트
			var roomList = new Array();
			for(var room in rooms){
				roomList.push(rooms[room]);
			}
			io.sockets.in('lobby').emit('list_room',{rooms:roomList});

			//방생성 결과 응답
			socket.emit('res_create_room', {result:true, url:url});

			console.log(rooms);
		}else{
			//방생성 결과 응답
			socket.emit('res_create_room', {result:false, url:url});
		}
	});

	/** 방 입장 **/
	socket.on("join_room", function(data){
		var url = data.url;

		if(rooms[url] != undefined) {

			if(Object.keys(rooms[url].user_list).length)
			socket.room = url;
			socket.join(url);
			socket.username = data.username;

			rooms[url].user_list[socket.id] = new Object();
			rooms[url].user_list[socket.id].nickname = socket.username;
			if(Object.keys(rooms[url].user_list).length == 1){
				rooms[url].user_list[socket.id].type = "black";
				rooms[url].state = "ready";
			}else if(Object.keys(rooms[url].user_list).length == 2){
				if(rooms[url].user_list[Object.keys(rooms[url].user_list)[0]].type == "white"){
					rooms[url].user_list[socket.id].type = "black";
				}else{
					rooms[url].user_list[socket.id].type = "white";
				}
				rooms[url].state = "start";
			}else{
				rooms[url].user_list[socket.id].type = "viewer";
			}
			io.sockets.in(url).emit('broadcast_msg', {msg:socket.username+"님이 방에 입장하였습니다.",type:"system",time:getTime()});
			socket.emit('init_game', {result:true,doll_color:rooms[url].user_list[socket.id].type});

			//게임상황 업데이트
			io.sockets.in(url).emit('state_game', {state:rooms[url].state,time:getTime()});

			//유저목록 업데이트
			var userList = new Array();
			for(var user in rooms[url].user_list){
				if (rooms[url].user_list.hasOwnProperty(user)) {
					userList.push(rooms[url].user_list[user]);
				}
			}
			io.sockets.in(url).emit('user_list', {users:userList});
		}else{
			console.log("!! 존재하지않는 방");
			io.sockets.in(url).emit('init_game', {result:false});
		}
	});

	/** 방 퇴장 **/
	socket.on("leave_room", function(data){

	});

	/** 닉네임 설정 **/
	socket.on("nickname_init", function(data){
		socket.username = data.nickname; //소켓 네임 설정
	});

	/** 돌 처리 **/
	socket.on('doll_put',function(data){
		var date = new Date();
		var time = getTime();

		if(rooms[socket.room].last_turn != data.doll_color){
			io.sockets.in(socket.room).emit('doll_receive', {x:data.x,y:data.y,doll_color:data.doll_color,id:socket.id,username:socket.username,time:time});
			rooms[socket.room].last_turn = data.doll_color;
		}
	});

	/** 메시지 전송 처리 **/
	socket.on("send_msg", function(data){
		var date = new Date();
		var time = getTime();
		io.sockets.in(socket.room).emit('broadcast_msg', {msg:data.msg,username:socket.username,type:"message",id:socket.id,time:time});
	});

	/** 접속 해제시 **/
	socket.on('disconnect', function(){
		console.log("socket disconnect current room : "+ socket.room);
		if(socket.room != undefined && socket.room != "lobby"){
			delete rooms[socket.room].user_list[socket.id];
			io.sockets.in(socket.room).emit('broadcast_msg', {msg:socket.username+"님이 퇴장하였습니다.",type:"system",time:getTime()});

			//게임상황 업데이트
			rooms[socket.room].state = "stop";
			io.sockets.in(socket.room).emit('state_game', {state:rooms[socket.room].state,time:getTime()});

			//유저목록 업데이트
			var userList = new Array();
			for(var user in rooms[socket.room].user_list){
				if (rooms[socket.room].user_list.hasOwnProperty(user)) {
					userList.push(rooms[socket.room].user_list[user]);
				}
			}
			io.sockets.in(socket.room).emit('user_list', {users:userList});

			//유저가 아무도 없을시 방 없애기
			if(Object.keys(rooms[socket.room].user_list).length == 0){
				delete rooms[socket.room];
				//방목록 업데이트
				var roomList = new Array();
				for(var room in rooms){
					roomList.push(rooms[room]);
				}
				io.sockets.in('lobby').emit('list_room',{rooms:roomList});
			}

			socket.room = null;
			socket.leave(socket.room);
		}else if(socket.room != undefined && socket.room == "lobby"){
			socket.room = null;
			socket.leave("lobby");
			lobbyCounter--;
			io.sockets.in("lobby").emit('lobby_usercnt',{cnt:lobbyCounter});
		}
	});
});

io.on('disconnect',function(socket) {

});

function getTime(){
	var date = new Date();
	var time;
	if (date.getHours() <= 12) {
		time = "오전 "+date.getHours()+":"+parseMinute(date.getMinutes());
	}else {
		time = "오후 "+(date.getHours()-12)+":"+parseMinute(date.getMinutes());
	}
	return time;
}

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
