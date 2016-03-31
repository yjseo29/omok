var express = require('express')
   ,router = express.Router()
   ,fs = require('fs');

exports.lobbyGet = function(req, res){
	if(req.session.username){
		res.render('lobby');
	}else{
		res.redirect('/');
	}
};

exports.lobbyPost = function(req, res) {
	if(req.body.username){
		req.session.username = req.body.username;
		console.log(req.session.username);
		res.render('lobby');
	}else{
		res.redirect('/');
	}
};