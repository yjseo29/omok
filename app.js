var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var routes = require('./routes/index');

var app = express();
var http = require('http').Server(app);

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

app.use('/', routes);

var httpServer = http.listen(app.get('port'), function(){
	console.log("Express server listening on port " + app.get('port'));
});

var io = require('socket.io').listen(httpServer);

var session = require('express-session')({
	secret: 'sadfwer',
	resave: true,
	saveUninitialized: true
}),
sharedsession = require("express-socket.io-session");
app.use(session);

var rooms = [];
var connectCounter = 0;
var dollColor = "white";
var latestTurnId = "";

io.use(sharedsession(session));

/*** Socket.IO 추가 ***/
io.on('connection',function(socket){

	connectCounter++;

	socket.room = "test";
	socket.join("test");


	if(connectCounter%2 != 0){
		dollColor = "black";
	}else{
		dollColor = "white";
	}


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


	console.log(connectCounter%2);
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
