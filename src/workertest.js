create_thread("require('./webworker.ts').run()")
call_internal_func("input", ["Wait for Listening message, then press Enter to continue"])
for(k in require.cache) delete require.cache[k]
var wc = require("./workerclient.ts")
wc.echo("localhost:12345", "FOO")
  .catch(function(e) { emsg("WC Error: " + e.stack); })
Promise.runQueue()
