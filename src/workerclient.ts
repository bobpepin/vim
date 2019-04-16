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

var workerPort = 17543; // "random" 

function sleep(t) {
    return new Promise(function (resolve, reject) {
        var cbid = registerCallbackOnce(function () {
            resolve();
            Promise.runQueue();
        });
        vim_eval("call('timer_start', [" + t + ", function('Duk_callback', [" + cbid + "])])");
    });
}

exports.sleep = sleep

exports.sleepTest = async function (t) {
    msg("Before sleep");
    await sleep(t);
    msg("After sleep");
};

class Worker {
    constructor (srcfile) {
        this.port = workerPort++;
        this.address = "127.0.0.1:" + this.port;
        var presrc = "function postMessage(obj) { return __postMessage(obj); }\n";
        var src = (new TextDecoder()).decode(read_blob(srcfile));
        var postsrc = "\nrequire('./webworker.ts').run(" + this.port + ");";
        create_thread(presrc + src + postsrc);
        this.connected = false;
        this.connect().catch(function (e) {
            emsg("Worker connection failed: " + e.stack);
        });
    }

    async connect() {
        var retries = 3;
        var delay = 6000;
        var last_exc = null;
        while(!this.connected && retries--) {
            await sleep(delay);
            try {
                msg("Trying to connect to worker " + this.address);
                var chan = new channels.Channel(this.address);
                let { readable, writable } = new ContentLengthTransport(chan);
                this.reader = readable.getReader();
                this.writer = writable.getWriter();
                this.connected = true;
                msg("Connected to worker " + this.address);
            } catch(e) {
                msg("Connection failed (" + e + "), retrying...");
                last_exc = e;
            }
        }
        if(!this.connected) {
            throw Error("Failed to connect to " + this.address + ": " + last_exc.stack);
        }
        this.runLoop();
    }

    async runLoop() {
        var decoder = new TextDecoder();
        while(true) {
            let buf = await this.reader.read();
            let obj = JSON.parse(decoder.decode(buf));
            if(this.onmessage) {
                this.onmessage({data: obj});
            }
        }
    }

    async postMessage(obj) {
        while(!this.connected) {
            msg("Waiting for worker connection...");
            await sleep(5000);
        }
        var encoder = new TextEncoder();
        var buf = encoder.encode(JSON.stringify(obj));
        this.writer.write(buf);
    }
}

exports.Worker = Worker

