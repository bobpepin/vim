var channels = require("./channels.js")
var jsp = require("./jsp-jsonrpc.ts")

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

async function init() {
    let params = {
        processId: null, 
        rootUri: "file:///Users/bob/Documents/vim/src"
        capabilities: {}
    }
    let r = await conn.request("initialize", params)
    msg("Initialize Response: " + JSON.stringify(r))

    let params = {
        textDocument: curbufTextDoc()
    }
    //msg("params " + JSON.stringify(params))
    await conn.notify("textDocument/didOpen", params)
}

async function sync() {
    let textDoc = curbufTextDoc();
    let text = textDoc.text;
    let params = {
        textDocument: textDoc,
        contentChanges: [{text}]
    }
    await conn.notify("textDocument/didChange", params)
}

async function query_sym() {
    let params = {
        textDocument: { uri: "file://" + expand("%:p") },
    }
    try {
        let r = await conn.request("textDocument/documentSymbol", params)
        msg("DocSymbol Response: " + JSON.stringify(r))
    } catch(e) {
        emsg_split(e)
    }
}

async function query() {
    let params = { 
        textDocument: { uri: "file://" + expand("%:p") },
        position: { line: line(".")-1, character: col(".")-1 }
    }
    try {
        let r = await conn.request("textDocument/completion", params)
        msg("Completion Response: " + JSON.stringify(r))
        return r;
    } catch(e) {
        emsg_split(e)
    }
}

var wm;
async function complete() {
    if(wm) {
        wm.selectNext();
        wm.redraw();
        return;
    }
    await sync();
    let completions = await query();
    if(completions.items.length > 0) {
        var items = [];
        for(c of completions.items) {
            items.push(c.label);
        }
        wm = new Wildmenu(items);
        wm.redraw();
    }
}

async function hide() {
    wm = undefined;
}

var conn;
async function run() {
    let ch = channels.open("127.0.0.1:8888")
    conn = new jsp.JSPConnection(ch)
    await init()
}

exports.run = run
exports.query = query
exports.query_sym = query_sym
exports.complete = complete
exports.hide = hide
