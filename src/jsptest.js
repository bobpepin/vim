function emsg_split(e) {
	var lines = JSON.stringify(e).split("\n"); //e.stack.split("\n");
	for(var i=0; i < lines.length; i++) {
	    emsg(lines[i]);
	}
}

function run_promise(p, silent) {
    p.then(function (e) { if(!silent) msg("Result: " + e) })
        .catch(function (e) { emsg_split(e) });
    Promise.runQueue()
}

require.forget("./jsp-jsonrpc.ts")
require.forget("./jsprun.ts")

var jr = require("./jsprun.ts")
run_promise(jr.run())

function run_complete() {
    run_promise(jr.complete(), true);
}

function run_hide() {
    run_promise(jr.hide(), true);
}
