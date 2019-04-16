var Worker = require("./workerclient.ts").Worker;
var worker = new Worker("./lcworker.js"); 
worker.onmessage = function(x) { msg("Message: " + JSON.stringify(x)); }
Promise.runQueue()
