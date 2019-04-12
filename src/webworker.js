var tcpserver = require("./tcpserver.js")

function runConnection(sock) {
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

tcpserver.runServer(12345, runConnection)
