var channels = require("./channels.js")
var jsp = require("./jsp-jsonrpc.ts")

var ch = channels.open("127.0.0.1:8888")
var conn = new jsp.JSPConnection(ch)
var p = conn.read()
p.then(function (r) { msg(JSON.stringify(r)) })
Promise.runQueue()
