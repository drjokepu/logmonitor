var fs = require('fs');
var express = require('express');
var app = express();
var http = require('http');
var server = http.createServer(app);
var io = require('socket.io').listen(server);
var config = require('./config.json');
var watchedFile = config.watchedFile;

server.listen(8080);

app.get('/', function(req, res)
{
	res.sendfile('index.html');
});

io.sockets.on('connection', function (socket)
{
	var knownLength = 0;
	var length = fs.stat(watchedFile, function(err, stats)
	{
		knownLength = stats.size;
		watch();
	});
	
	function watch()
	{
		var watcher = fs.watch(watchedFile, function (event, filename)
		{
			fs.stat(watchedFile, function(stat_err, stats)
			{
				var oldLength = knownLength;
				var newLength = stats.size;
				var tailLength = newLength - oldLength;
				if (tailLength <= 0) return;
				knownLength = newLength;
				
				fs.open(watchedFile, 'r', function(fd_err, fd)
				{
					var buffer = new Buffer(tailLength);
					fs.read(fd, buffer, 0, tailLength, oldLength, function(read_err, bytesRead, buffer)
					{
						var str = removeTrailingNewline(buffer.toString());
						fs.close(fd);	
						sendLogEvent({ contents: str });
					});
				});
			});
		});
	
		socket.on('disconnect', function()
		{
			watcher.close();
			watcher = null;
		})
	}
	
	function sendLogEvent(logEvent)
	{
		socket.emit('log', logEvent);
	}
});

function removeTrailingNewline(str)
{
	if (str[str.length - 1] == '\n')
	{
		return str.substring(0, str.length - 1);
	}
	else
	{
		return str;	
	}
}
