var fs = require('fs');
var express = require('express');
var app = express();
var http = require('http');
var server = http.createServer(app);
var io = require('socket.io').listen(server);
var config = require('./config.json');
var watchedFile = config.watchedFile;

app.set('views', __dirname);
app.engine('ejs', require('ejs').renderFile);
app.set('view engine', 'ejs');
server.listen(config.port, config.hostname);

app.get('/', function(req, res)
{
	res.render('./index.ejs', { watchedFile: watchedFile });
});

io.sockets.on('connection', function (socket)
{
	var knownLength = 0;
	var length = fs.stat(watchedFile, function(err, stats)
	{
		knownLength = stats.size;
		getTail(knownLength, function(str)
		{
			if (str != null)
			{
				sendLogEvent({ contents: str });
			}
		});
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
						fs.close(fd);
						var str = removeTrailingNewline(buffer.toString());	
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

function getTail(fileLength, callback)
{
	var maxTailLength = Math.min(fileLength, 512);
	
	if (maxTailLength > 0)
	{
		fs.open(watchedFile, 'r', function(fd_err, fd)
		{
			var buffer = new Buffer(maxTailLength);
			fs.read(fd, buffer, 0, maxTailLength, fileLength - maxTailLength, function(read_err, bytesRead, buffer)
			{
				fs.close(fd);
				
				var tailStartIndex0 = -1;
				for (var i = 0; i < maxTailLength; i++)
				{
					if (buffer[i] == 10)
					{
						tailStartIndex0 = i;
						break;
					}
				}
				
				var tailStartIndex1 = -1;
				var newLinesFound = 0;
				for (var i = maxTailLength - 1; i >= 0; i--)
				{
					if (buffer[i] == 10)
					{
						newLinesFound++;
						if (newLinesFound > 5)
						{
							tailStartIndex1 = i + 1;
							break;
						}
					}
				}
				
				var tailStartIndex = Math.min(Math.max(tailStartIndex0, tailStartIndex1), maxTailLength - 1);
				console.log('tailStartIndex = ' + tailStartIndex);
				if (tailStartIndex >= 0)
				{
					callback(buffer.toString('utf8', tailStartIndex));
				}
				else
				{
					callback(null);
				}
			});
		});
	}
	else
	{
		callback(null);
	}
}

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
