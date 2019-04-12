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
    var read = reader.read.bind(reader);
    //var writer = sock.writable.getWriter();
    var writer = transport.writable.getWriter();
    var write = writer.write.bind(writer);
    var decoder = new TextDecoder();
    var decode = decoder.decode.bind(decoder);
    var encoder = new TextEncoder();
    var encode = encoder.encode.bind(encoder);
    while(true) {
        var str = decode(await read());
        write(encode(str.toLowerCase()));
    }
}

exports.run = function run() {
    tcpserver.runServer(12345, async function (sock) { 
        try {
            emsg("Accepted connection.");
            await runConnection(sock);
        } catch(e) {
            emsg("Connection error " + e.stack);
        }
    });
}
