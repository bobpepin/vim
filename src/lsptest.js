ex("dukfile wildmenu.js")

function emsg_split(e) {
	// var lines = JSON.stringify(e).split("\n"); //e.stack.split("\n");
	var lines = e.stack.split("\n");
	for(var i=0; i < lines.length; i++) {
	    emsg(lines[i]);
	}
}

function run_promise(p, silent) {
    p.then(function (e) { if(!silent) msg("Result: " + e) })
        .catch(function (e) { emsg_split(e) });
    Promise.runQueue()
}

require.forget("./lsp-jsonrpc.ts")
require.forget("./lsprun.ts")

var lr = require("./lsprun.ts")
run_promise(lr.run())

function run_complete() {
    run_promise(lr.complete(), true);
}

function run_hide() {
    run_promise(lr.hide(), true);
}

ex("augroup lsp")
ex("autocmd! CursorMovedI * call dukcall('run_hide', [])")
ex("augroup end")
ex("imap <Tab> <C-O>:call dukcall('run_complete', [])<CR>")
