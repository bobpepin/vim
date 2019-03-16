// 1. Accessible by the Vim GC: Dictionary id -> channel obj
// 2. Wrapper for open channel, ch_open -> returns id
// 3. Read function: if data in buffer, resolve with buffer. 
//    Else register callback with resolve

require('promise.js')

var callbacks = {}
function set_callback(channel, fun) {
    callbacks[channel.id] = fun
    vim_eval("Duk_ch_enable_cb(" + channel.id + ")")
}
exports.set_callback = set_callback

function callback(channel_id, channel_msg, status) {
    // msg("Channel " + channel_id + " (" + status + ")" + ": " + channel_msg)
    vim_eval("Duk_ch_disable_cb(" + channel_id + ")")
    var fun = callbacks[channel_id]
    delete callbacks[channel_id]
    fun(channel_id, channel_msg, status)
}

globalThis.channel_callback = callback

function open(address) {
    var channel_id = vim_eval("Duk_ch_open('" + address + "')")
    if(channel_id == -1) {
        throw Error("Connection to " + address + " failed.");
    }
    var channel = {id: channel_id}
    channel.read = function () { return read(this); }
    channel.write = function (str) { return write(this, str); }
    Duktape.fin(channel, close)
    return channel
}

exports.open = open

function close(channel) {
    vim_eval("Duk_ch_close(" + channel.id + ")")
}

exports.close = close

function read(channel) {
    var p = new Promise(function (resolve, reject) {
        set_callback(channel, function (ch_id, ch_msg, status) {
            resolve(ch_msg);
            Promise.runQueue();
        })
    })
    return p;
}

function write(channel, str) {
    vim_eval("Duk_ch_write(" + channel.id + ", " + JSON.stringify(str) + ")")
    return Promise.resolve(str.length)
}

exports.read = read
exports.write = write
