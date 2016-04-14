var express = require('express')
  , path = require('path')
  , favicon = require('serve-favicon')
  //, logger = require('morgan')
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
//app.use(logger('dev'));
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
			rooms[url].last_turn = "white";
			rooms[url].password = data.password;
			rooms[url].username = socket.username;
			rooms[url].state = "ready";
			rooms[url].white_state = "standby";
			rooms[url].black_state = "standby";
			rooms[url].time = getTime();
			rooms[url].start_time = new Date().toISOString();
			rooms[url].user_list = new Object();
			rooms[url].board = new Array(
				new Array("","","","","","","","","","","","","","","","","","",""),
				new Array("","","","","","","","","","","","","","","","","","",""),
				new Array("","","","","","","","","","","","","","","","","","",""),
				new Array("","","","","","","","","","","","","","","","","","",""),
				new Array("","","","","","","","","","","","","","","","","","",""),
				new Array("","","","","","","","","","","","","","","","","","",""),
				new Array("","","","","","","","","","","","","","","","","","",""),
				new Array("","","","","","","","","","","","","","","","","","",""),
				new Array("","","","","","","","","","","","","","","","","","",""),
				new Array("","","","","","","","","","","","","","","","","","",""),
				new Array("","","","","","","","","","","","","","","","","","",""),
				new Array("","","","","","","","","","","","","","","","","","",""),
				new Array("","","","","","","","","","","","","","","","","","",""),
				new Array("","","","","","","","","","","","","","","","","","",""),
				new Array("","","","","","","","","","","","","","","","","","",""),
				new Array("","","","","","","","","","","","","","","","","","",""),
				new Array("","","","","","","","","","","","","","","","","","",""),
				new Array("","","","","","","","","","","","","","","","","","",""),
				new Array("","","","","","","","","","","","","","","","","","","")
			);

			//클라이언트에게 추가된방 전송
			io.sockets.in('lobby').emit('add_list_room',{room:rooms[url]});

			//방생성 결과 응답
			socket.emit('res_create_room', {result:true, url:url});

		}else{
			//방생성 결과 응답
			socket.emit('res_create_room', {result:false, url:url});
		}
	});

	/** 게임 준비 요청 **/
	socket.on("ready_game", function(data){
		if(data.fn == "ready"){
			if(data.doll_color == "black"){
				rooms[socket.room].black_state = "ready";
			}else{
				rooms[socket.room].white_state = "ready";
			}
			io.sockets.in(socket.room).emit('broadcast_msg', {msg:socket.username+"님이 준비중입니다.",type:"system",time:getTime()});
			if(rooms[socket.room].black_state == "ready" && rooms[socket.room].white_state == "ready"){
				rooms[socket.room].board = new Array(
					new Array("","","","","","","","","","","","","","","","","","",""),
					new Array("","","","","","","","","","","","","","","","","","",""),
					new Array("","","","","","","","","","","","","","","","","","",""),
					new Array("","","","","","","","","","","","","","","","","","",""),
					new Array("","","","","","","","","","","","","","","","","","",""),
					new Array("","","","","","","","","","","","","","","","","","",""),
					new Array("","","","","","","","","","","","","","","","","","",""),
					new Array("","","","","","","","","","","","","","","","","","",""),
					new Array("","","","","","","","","","","","","","","","","","",""),
					new Array("","","","","","","","","","","","","","","","","","",""),
					new Array("","","","","","","","","","","","","","","","","","",""),
					new Array("","","","","","","","","","","","","","","","","","",""),
					new Array("","","","","","","","","","","","","","","","","","",""),
					new Array("","","","","","","","","","","","","","","","","","",""),
					new Array("","","","","","","","","","","","","","","","","","",""),
					new Array("","","","","","","","","","","","","","","","","","",""),
					new Array("","","","","","","","","","","","","","","","","","",""),
					new Array("","","","","","","","","","","","","","","","","","",""),
					new Array("","","","","","","","","","","","","","","","","","","")
				);
				rooms[socket.room].state = "start";
				rooms[socket.room].start_time = new Date().toISOString();
				io.sockets.in(socket.room).emit('state_game', {state:"start",time:getTime()});
			}
		}else{
			if(data.doll_color == "black"){
				rooms[socket.room].black_state = "standby";
			}else{
				rooms[socket.room].white_state = "standby";
			}
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
			if(Object.keys(rooms[url].user_list).length == 1){
				rooms[url].user_list[socket.id].type = "black";
			}else if(Object.keys(rooms[url].user_list).length == 2){
				if(rooms[url].user_list[Object.keys(rooms[url].user_list)[0]].type == "white"){
					rooms[url].user_list[socket.id].type = "black";
				}else{
					rooms[url].user_list[socket.id].type = "white";
				}
			}else{
				var hasBlack = 0;
				var hasWhite = 0;
				for(var user in rooms[url].user_list){
					if (rooms[url].user_list.hasOwnProperty(user)) {
						if(rooms[url].user_list[user].type == "black"){
							hasBlack++;
						}else if(rooms[url].user_list[user].type == "white"){
							hasWhite++;
						}
					}
					if(hasBlack == 0){
						rooms[url].user_list[socket.id].type = "black";
					}else if(hasWhite == 0){
						rooms[url].user_list[socket.id].type = "white";
					}else{
						rooms[url].user_list[socket.id].type = "viewer";
					}
				}
			}

			//접속중인 유저들에게 새로접속한 유저 알리기
			socket.broadcast.to(url).emit('add_room_user', {user:rooms[url].user_list[socket.id]});

			io.sockets.in(url).emit('broadcast_msg', {msg:socket.username+"님이 방에 입장하였습니다.",type:"system",time:getTime()});
			socket.emit('init_game', {result:true, doll_color: rooms[url].user_list[socket.id].type, board:rooms[url].board, state: rooms[url].state,start_time:rooms[url].start_time});

			//기존 유저목록 보내기
			var userList = new Array();
			for(var user in rooms[url].user_list){
				if (rooms[url].user_list.hasOwnProperty(user)) {
					userList.push(rooms[url].user_list[user]);
				}
			}
			socket.emit('room_user_list', {users:userList});
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
		if(rooms[socket.room].last_turn != data.doll_color){
			rooms[socket.room].board[data.x][data.y] = data.doll_color;
			rooms[socket.room].last_turn = data.doll_color;
			var result = boardJudgment(rooms[socket.room].board, data.x, data.y, data.doll_color, socket.username);
			console.log(result);
			if(result.result == "end"){
				rooms[socket.room].last_turn = "white";
				rooms[socket.room].white_state = "standby";
				rooms[socket.room].black_state = "standby";
				rooms[socket.room].state = "ready";
				io.sockets.in(socket.room).emit('state_game', {state:"end", doll_color: data.doll_color, username: socket.username, time:getTime()});
			}
			io.sockets.in(socket.room).emit('doll_receive', {x:data.x,y:data.y,doll_color:data.doll_color,id:socket.id,username:socket.username,time:getTime()});
		}
	});

	/** 메시지 전송 처리 **/
	socket.on("send_msg", function(data){
		io.sockets.in(socket.room).emit('broadcast_msg', {msg:data.msg,username:socket.username,type:"message",id:socket.id,time:getTime()});
	});

	/** 접속 해제시 **/
	socket.on('disconnect', function(){
		if(socket.room != undefined && socket.room != "lobby"){

			//유저목록 업데이트
			io.sockets.in(socket.room).emit('del_room_user', {user:rooms[socket.room].user_list[socket.id],id:socket.id});
			io.sockets.in(socket.room).emit('broadcast_msg', {msg:socket.username+"님이 퇴장하였습니다.",type:"system",time:getTime()});

			//게임상황 업데이트
			if(rooms[socket.room].user_list[socket.id].type == "black" || rooms[socket.room].user_list[socket.id].type == "white"){
				rooms[socket.room].white_state = "standby";
				rooms[socket.room].black_state = "standby";
				rooms[socket.room].last_turn = "white";
				if(rooms[socket.room].state != "ready"){
					rooms[socket.room].state = "stop";
					io.sockets.in(socket.room).emit('state_game', {state:"stop",time:getTime()});
				}
			}

			delete rooms[socket.room].user_list[socket.id];

			//유저가 아무도 없을시 방 없애기
			if(Object.keys(rooms[socket.room].user_list).length == 0){
				delete rooms[socket.room];
				//방목록 업데이트
				io.sockets.in('lobby').emit('del_list_room',{url:socket.room});
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

function boardJudgment(board, x, y, color, username){

	var goalCnt = 0;

	//수평 오른쪽방향 검사 →
	for(var i=0; i<19; i++){
		if(typeof board[x][y+i] != "undefined"){
			if(board[x][y+i] == color){
				goalCnt++;
			}else{
				break;
			}
			if(goalCnt == 5){
				if(board[x][y-1] == color) break;
				console.log("!!");
				return {"result":"end", "color":color, "username":username};
				break;
			}
		}
	}

	//수평 왼쪽방향 검사 ←
	goalCnt = 0;
	for(var i=0; i<19; i++){
		if(typeof board[x][y-i] != "undefined"){
			if(board[x][y-i] == color){
				goalCnt++;
			}else{
				break;
			}
			if(goalCnt == 5){
				if(board[x][y+1] == color) break;
				return {"result":"end", "color":color, "username":username};
				break;
			}
		}
	}

	//수직 아래쪽방향 검사 ↓
	goalCnt = 0;
	for(var i=0; i<19; i++){
		if(x == 18) break;
		if(typeof board[x+i][y] != "undefined"){
			if(board[x+i][y] == color){
				goalCnt++;
			}else{
				break;
			}
			if(goalCnt == 5){
				if(x != 0 && board[x-1][y] == color) break;
				return {"result":"end", "color":color, "username":username};
				break;
			}
		}
	}

	//수직 위쪽방향 검사 ↑
	goalCnt = 0;
	for(var i=0; i<19; i++){
		if(x-i < 0) break;
		if(typeof board[x-i][y] != "undefined"){
			if(board[x-i][y] == color){
				goalCnt++;
			}else{
				break;
			}
			if(goalCnt == 5){
				if(board[x+1][y] == color) break;
				return {"result":"end", "color":color, "username":username};
				break;
			}
		}
	}

	//대각선 오른쪽 아래방향 검사 ↘
	goalCnt = 0;
	for(var i=0; i<19; i++){
		if(y == 18 || x == 18) break;
		if(typeof board[x+i][y+i] != "undefined"){
			if(board[x+i][y+i] == color){
				goalCnt++;
			}else{
				break;
			}
			if(goalCnt == 5){
				if(board[x-1][y-1] == color) break;
				return {"result":"end", "color":color, "username":username};
				break;
			}
		}
	}

	//대각선 오른쪽 위에방향 검사 ↗
	goalCnt = 0;
	for(var i=0; i<19; i++){
		if(x-i < 0) break;
		if(typeof board[x-i][y+i] != "undefined"){
			if(board[x-i][y+i] == color){
				goalCnt++;
			}else{
				break;
			}
			if(goalCnt == 5){
				if(board[x+1][y-1] == color) break;
				return {"result":"end", "color":color, "username":username};
				break;
			}
		}
	}

	//대각선 왼쪽 위에방향 검사 ↖
	goalCnt = 0;
	for(var i=0; i<19; i++) {
		if (x - i < 0) break;
		if (typeof board[x - i][y - i] != "undefined") {
			if (board[x - i][y - i] == color) {
				goalCnt++;
			} else {
				break;
			}
			if (goalCnt == 5) {
				if(gameStats[x+1][y+1] == color) break;
				return {"result":"end", "color":color, "username":username};
				break;
			}
		}
	}

	//대각선 왼쪽 아래방향 검사 ↙
	goalCnt = 0;
	for(var i=0; i<19; i++){
		if(x == 18 || y == 0) break;
		if(typeof board[x+i][y-i] != "undefined"){
			if(board[x+i][y-i] == color){
				goalCnt++;
			}else{
				break;
			}
			if(goalCnt == 5){
				if(board[x-1][y+1] == color) break;
				return {"result":"end", "color":color, "username":username};
				break;
			}
		}
	}
	console.log("!!!!");
	return {"result":"progress", "color":color, "username":username};
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
