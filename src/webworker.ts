var tcpserver = require("./tcpserver.js");
var { ContentLengthTransport, JSONRPC } = require("./jsonrpc.ts");

function runConnection1(sock) {
    var reader = sock.readable.getReader();
    reader.read().then(function (buf) {
        var str = (new TextDecoder()).decode(buf);
        emsg(str);
        var writer = sock.writable.getWriter();
        writer.write((new TextEncoder()).encode(str.toUpperCase()))
        runConnection(sock);
    }).catch(function (e) {
        emsg("Promise error " + e);
    })
}

async function runConnection(sock) {
    var transport = new ContentLengthTransport(sock);
    var reader = transport.readable.getReader();
    var writer = transport.writable.getWriter();
    var decoder = new TextDecoder();
    var encoder = new TextEncoder();
    globalThis.__postMessage = function (obj) {
        var buf = encoder.encode(JSON.stringify(obj));
        writer.write(buf);
    }
    while(true) {
        let buf = await reader.read();
        let obj = JSON.parse(decoder.decode(buf));
        if(globalThis.onmessage) {
            globalThis.onmessage({data: obj});
        }
    }
}

exports.run = function run(port) {
    tcpserver.runServer(port, async function (sock) { 
        try {
            emsg("Accepted connection.");
            await runConnection(sock);
        } catch(e) {
            emsg("Connection error " + e.stack);
        }
    });
}
