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

function runServer(port, Connection) {
    var readCallbacks = {};
    var writeCallbacks = {};
    function acceptConnection(listen_fd) {
        var conn_fd = accept(listen_fd);
        var conn = new Connection(conn_fd);
        if(conn.onReadReady)
            readCallbacks[conn_fd] = conn.onReadReady.bind(conn);
        if(conn.onWriteReady)
            writeCallbacks[conn_fd] = conn.onWriteReady.bind(conn);
    }
    var listen_fd = listen(0, port); 
    readCallbacks[listen_fd] = acceptConnection;
    while(true) {
        processEvents(readCallbacks, writeCallbacks);
    }
}

function EmsgConnection(fd) {
    this.fd = fd;
    this.buf = new Uint8Array(1024);
    this.filledBuf = this.buf.subarray(0, 0);
}

EmsgConnection.prototype.onReadReady = function(fd) {
    var n = read(fd, this.buf);
    var str = (new TextDecoder()).decode(this.buf.subarray(0, n));
    emsg(str);
}

runServer(12345, EmsgConnection)

/* WorkerConnection: Read data until a complete jsonrpc message has been received.
 * Then call onmessage() with the result.
 * read callback: unregister callback, read data, resolve Promise with data
 * write callback: flush write buffer, resolve Promise(s)
 * write sync: append to write buffer
 * async read: register Promise, return Promise
 * async write: append to write buffer, register Promise, return Promise
 */

function WorkerConnection(fd) {
    this.bufsize = 1024;
    this.writeBuf = new Uint8Array(this.bufsize);
    this.fd = fd;
    this.readPromises = [];
    this.writePromises = [];
}

var Posix = { read: read, write: write, accept: accept, close: close };

WorkerConnection.prototype.onReadReady = function(fd) {
    var buf = new Uint8Array(this.bufsize);
    var n = Posix.read(fd, buf);
    var data = buf.subarray(0, n);
    var promises = this.readPromises;
    this.readPromises = [];
    for(var i=0; i < promises.length; i++) {
        promises[i].resolve(data);
    }
}

WorkerConnection.prototype.read = function(fd) {

}
