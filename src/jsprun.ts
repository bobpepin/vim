var channels = require("./channels.js")
var jsp = require("./jsp-jsonrpc.ts")

async function init() {
    let params = {
        processId: null, 
        rootUri: "file:///Users/bob/Documents/vim/src"
        capabilities: {}
    }
    let r = await conn.request("initialize", params)
    msg("Initialize Response: " + JSON.stringify(r))
    function curbufTextDoc() {
        let fname = expand("%:p")
        let text = "";
        let nlines = line("$")
        for(let i=1; i <= nlines; i++) {
            text += getline(i)
            text += "\n"
        }
        return {
            uri: "file://" + fname,
            languageId: "c",
            version: $b.changedtick,
            text 
        }
    }

    let params = {
        textDocument: curbufTextDoc()
    }
    //msg("params " + JSON.stringify(params))
    await conn.notify("textDocument/didOpen", params)
}

async function query() {
    let params = { 
        textDocument: { uri: "file://" + expand("%:p") },
        position: { line: line("."), character: col(".")-1 }
    }
    try {
        let r = await conn.request("textDocument/completion", params)
        msg("Completion Response: " + JSON.stringify(r))
    } catch(e) {
        emsg_split(e)
    }
}

var conn;
async function run() {
    let ch = channels.open("127.0.0.1:8888")
    conn = new jsp.JSPConnection(ch)
    await init()
}

exports.run = run
exports.query = query
