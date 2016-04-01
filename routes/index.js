var express = require('express')
   ,router = express.Router()
   ,fs = require('fs');

exports.lobbyGet = function(req, res){
	if(req.session.username){
		res.render('lobby', {username:req.session.username});
	}else{
		res.redirect('/');
	}
};

exports.lobbyPost = function(req, res) {
	if(req.body.username){
		req.session.username = req.body.username;
		if(req.body.gameUrl != ""){
			res.redirect('/game/'+req.body.gameUrl);
		}else{
			res.render('lobby', {username:req.session.username});
		}
	}else{
		res.redirect('/');
	}
};