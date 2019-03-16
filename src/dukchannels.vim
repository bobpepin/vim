let s:channels = {}
let s:seq = -1

function! Duk_ch_open(address)
    let options = {
                \ "mode": "raw",
                \ "noblock": 0,
                \ "drop": "never",
                \ "waittime": 500,
                \ }
    let channel = ch_open(a:address, options)
    if ch_status(channel) != "open"
        return -1
    endif
    let s:seq = s:seq + 1
    let s:channels[s:seq] = channel
    return s:seq
endfunction

function! Duk_ch_enable_cb(channel_id)
    let options = {
                \ "mode": "raw",
                \ "noblock": 0,
                \ "drop": "never",
                \ "callback": function("Duk_ch_callback", [a:channel_id])
                \ }
    call ch_setoptions(s:channels[a:channel_id], options)
endfunction

function! Duk_ch_disable_cb(channel_id)
    let options = {
                \ "mode": "raw",
                \ "noblock": 0,
                \ "drop": "never",
                \ "callback": ""
                \ }
    call ch_setoptions(s:channels[a:channel_id], options)
endfunction

function! Duk_ch_close(channel_id)
    call ch_close(s:channels[a:channel_id])
    unlet s:channels[a:channel_id]
endfunction

function! Duk_ch_callback(channel_id, channel, msg)
    call dukcall("channel_callback", [a:channel_id, a:msg, ch_status(a:channel)])
endfunction

function! Duk_ch_write(channel_id, str)
    "echo "Duk_ch_write " . a:str
    call ch_sendraw(s:channels[a:channel_id], a:str)
endfunction
