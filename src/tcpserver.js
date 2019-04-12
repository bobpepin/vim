require('promise.js')

/* Subset of https://streams.spec.whatwg.org */
function ReadableStream(source) {
    this.chunks = [];
    this.inFlights = [];
    source.start(this);
}
ReadableStream.prototype.enqueue = function enqueue(chunk) {
    this.chunks.push(chunk);
    this.notifyInFlight();
}
ReadableStream.prototype.notifyInFlight = function notifyInFlight() {
    while(this.inFlights.length > 0 && this.chunks.length > 0) {
        var inFlight = this.inFlights.shift();
        var chunk = this.chunks.shift();
        inFlight.resolve(chunk);
    }
}
ReadableStream.prototype.read = function read() {
    var inFlights = this.inFlights;
    var p = new Promise(function (resolve, reject) {
        inFlights.push({resolve: resolve, reject: reject});
    })
    this.notifyInFlight();
    return p;
}
ReadableStream.prototype.getReader = function getReader() {
    return this;
}

function WritableStream(sink) {
    this.sink = sink;
}
WritableStream.prototype.write = function write(chunk) {
    return Promise.resolve(this.sink.write(chunk));
}
WritableStream.prototype.getWriter = function getWriter() {
    return this;
}

function processEvents(readCallbacks, writeCallbacks) {
    var readfds = [];
    var writefds = [];
    for(var fd in readCallbacks) {
        readfds.push(parseInt(fd));
    }
    for(var fd in writeCallbacks) {
        writefds.push(parseInt(fd));
    }
    var r = select(readfds, writefds, [], null);
    var readReady = r[1];
    var writeReady = r[2];
    for(var i=0; i < readReady.length; i++) {
        var fd = readReady[i];
        readCallbacks[fd](fd);
    }
    for(var i=0; i < writeReady.length; i++) {
        var fd = writeReady[i];
        writeCallbacks[fd](fd);
    }
}

function runServer(port, handler) {
    var buf = new Uint8Array(1024);
    function readInto(fd, controller) {
        var n = read(fd, buf);
        var chunk = new Uint8Array(buf.subarray(0, n));
        controller.enqueue(chunk);
    }
    var readCallbacks = {};
    var writeCallbacks = {};
    function acceptConnection(listen_fd) {
        var sock_fd = accept(listen_fd);
        var readable = new ReadableStream({
            start: function (controller) {
                readCallbacks[sock_fd] = function () { 
                    readInto(sock_fd, controller); 
                }
            }
        });
        var writeQueue = [];
        function flushWriteQueue() {
            delete writeCallbacks[sock_fd];
            while(writeQueue.length > 0) {
                write(sock_fd, writeQueue.shift());
            }
        }
        var writable = new WritableStream({
            write: function write(chunk) {
                emsg("write " + chunk)
                writeQueue.push(chunk);
                writeCallbacks[sock_fd] = flushWriteQueue;
            }
        });
        var sock = { readable, writable };
        Promise.resolve(handler(sock)).catch(function (e) { throw("Error in handler: " + e); });
    }
    var listen_fd = listen(0, port); 
    readCallbacks[listen_fd] = acceptConnection;
    emsg("Listening on port " + port);
    try {
        while(true) {
            processEvents(readCallbacks, writeCallbacks);
            Promise.runQueue();
        }
    } finally {
        close(listen_fd);
    }
}

exports.runServer = runServer

