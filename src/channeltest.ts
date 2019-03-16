ex("source dukchannels.vim")
ex("set rtp+=.")
var channels = require("./channels.js")

async function foo(ch) {
    for(let i=0; i < 3; i++) {
        let r = await channels.read(ch);
        msg(`msg ${i}: ${r}`);
    }
    return "23";
}

exports.foo = foo

exports.run = function () {
    var ch = channels.open("127.0.0.1:8888")
    return foo(ch)
}
