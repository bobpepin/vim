function emsg_split(e) {
	var lines = JSON.stringify(e).split("\n"); //e.stack.split("\n");
	for(var i=0; i < lines.length; i++) {
	    emsg(lines[i]);
	}
}

function run_promise(p) {
    p.then(function (e) { msg("Result: " + e) })
        .catch(function (e) { emsg_split(e) });
    Promise.runQueue()
}

require.forget("./jsp-jsonrpc.ts")
require.forget("./jsprun.ts")

var jr = require("./jsprun.ts")
run_promise(jr.run())
