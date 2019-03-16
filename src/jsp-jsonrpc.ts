class JSPConnection {
    constructor(channel) {
        this.channel = channel
        this.buf = String()
    }

    async readHeaderLine() {
        let idx
        while((idx = this.buf.indexOf("\r\n")) == -1) {
            this.buf += await this.channel.read()
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
            this.buf += await this.channel.read()
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
        // no radix, be liberal in what you except etc.
        let len = parseInt(headers["Content-Length"]) 
        let body = await this.readBody(len)
        return JSON.parse(body)
    }

    async write(val) {
        let body = JSON.stringify(val)
        let len = body.length;
        let header = "Content-Length: " + len + "\r\n\r\n"
        await this.channel.write(header)
        await this.channel.write(body)
    }
}

exports.JSPConnection = JSPConnection
