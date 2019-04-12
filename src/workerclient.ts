var channels = require("./channels.js")
var { ContentLengthTransport, JSONRPC } = require("./jsonrpc.ts");

async function echo(address, str) {
    var encoder = new TextEncoder();
    var decoder = new TextDecoder();
    var chan = new channels.Channel(address);
    let { readable, writable } = new ContentLengthTransport(chan);
    let reader = readable.getReader();
    let writer = writable.getWriter();
    await writer.write(encoder.encode(str));
    let resp = await reader.read();
    let respStr = decoder.decode(resp)
    msg("Response: " + respStr);
}

exports.echo = echo
