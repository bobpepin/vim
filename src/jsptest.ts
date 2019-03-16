var channels = require("./channels.js")
var jsp = require("./jsp-jsonrpc.ts")

async function run() {
    var ch = channels.open("127.0.0.1:8888")
    var conn = new jsp.JSPConnection(ch)
    var params = {
        processId: null, 
        rootUri: "file:///Users/bob/Documents/vim/src"
        capabilities: {}
    }
    var init = {
        jsonrpc: "2.0",
        method: "initialize",
        id: 1,
        params }
    await conn.write(init)
    var r;
    while(r = await conn.read()) {
        msg("Read: " + JSON.stringify(r));
        if(r.id == 1)
            break;
    }
    var sym = {
        jsonrpc: "2.0",
        method: "workspace/symbol",
        id: 2,
        params: {query: "main"} 
    }
    await conn.write(sym)
    var r;
    while(r = await conn.read()) {
        msg("Read: " + JSON.stringify(r));
        if(r.id == 2)
            break;
    }
}

exports.run = run
