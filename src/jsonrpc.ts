class ContentLengthReader {
    constructor(reader) {
        this.reader = reader;
        this.encoder = new TextEncoder()
        this.decoder = new TextDecoder()
        this.buf = String()
    }

    async readHeaderLine() {
        let idx
        while((idx = this.buf.indexOf("\r\n")) == -1) {
            this.buf += this.decoder.decode(await this.reader.read())
        }
        let line;
        [line, this.buf] = [this.buf.slice(0, idx), this.buf.slice(idx+2)]
        return line
    }
    async readHeader() {
        let headers = {}
        let line;
        while((line = await this.readHeaderLine()) != "") {
            let [field, value] = line.split(":", 2)
            headers[field] = value
        }
        return headers
    }
    // If a message is in progress, fill this.buf until we have read
    // Content-Length bytes.
    async readBody(len) {
        while(this.buf.length < len) {
            this.buf += this.decoder.decode(await this.reader.read())
        }
        let r;
        [r, this.buf] = [this.buf.slice(0, len), this.buf.slice(len)]
        return r
    }

    async read() {
        let headers = await this.readHeader()
        if(!headers["Content-Length"]) {
            throw Error("Missing Content-Length header")
        }
        let len = parseInt(headers["Content-Length"], 10) 
        let body = await this.readBody(len)
        let enc = this.encoder.encode(body)
        return enc;
    }
}

class ContentLengthWriter {
    constructor(writer) {
        this.writer = writer;
    }

    async write(body) {
        let encoder = new TextEncoder();
        let len = body.length;
        let header_str = "Content-Length: " + len + "\r\n\r\n"
        let header = encoder.encode(header_str);
        await this.writer.write(header)
        await this.writer.write(body)
    }
}


class ContentLengthTransport {
    constructor(byteStream) {
        this.readable = { getReader() { return new ContentLengthReader(byteStream.readable.getReader()); } }
        this.writable = { getWriter() { return new ContentLengthWriter(byteStream.writable.getWriter()); } }
    }
}

class JSONRPC {
    constructor(transport) {
        this.reader = transport.readable.getReader()
        this.writer = transport.writable.getWriter()
        this.seq = 0
        this.inFlight = {}
        this.notifications = []
        this.loopPromise = this.runLoop()
        this.readable = this.writable = this;
    }

    getReader() {
        return this;
    }

    getWriter() {
        return this;
    }

    async write(data) {
        return await this.writer.write(JSON.stringify(data))
    }

    async read() {
        return JSON.parse(await this.reader.read())
    }

    async notify(method, params) {
        return await this.write({ jsonrpc: "2.0", method, params })
    }

    // request: register a Promise that is resolved when the matching Response
    // is received
    async request(method, params) {
        let id = this.seq
        this.seq++
        let jsonrpc = { jsonrpc: "2.0", method, id, params }
        await this.write(jsonrpc)
        let p = new Promise((resolve, reject) => {
            this.inFlight[id] = {resolve, reject}
        })
        return await p;
    }

    async respond(id, result, error) {
        let jsonrpc = { jsonrpc: "2.0", id }
        if(result !== undefined) {
            jsonrpc.result = result
        } else {
            jsonrpc.error = error
        }
        return await this.write(jsonrpc)
    }

    processMessage(jsonrpc) {
        if("id" in jsonrpc) {
            let id = jsonrpc.id
            if(!this.inFlight[id]) {
                throw Error("No response handler for id " + id + " (jsonrpc=" + JSON.stringify(jsonrpc) + ")")
            }
            ({resolve, reject} = this.inFlight[id])
            delete this.inFlight[id]
            if("result" in jsonrpc) {
                resolve(jsonrpc.result)
            } else {
                reject(Error(JSON.stringify(jsonrpc.error)))
            }
        } else {
            this.notifications.push(jsonrpc)
        }
    }

    async runLoop() {
        while(true) {
            let jsonrpc = await this.read()
            this.processMessage(jsonrpc)
        }
    }
}

exports.ContentLengthTransport = ContentLengthTransport
exports.JSONRPC = JSONRPC
