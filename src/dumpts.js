function dumpTs(fname) {
    var decoder = new TextDecoder();
    var src = decoder.decode(read_blob(fname));
    var ts = require('typescript.js');
    var result = ts.transpileModule(src, {})
    var out = result.outputText;
    ex("tabe");
    var lines = out.split("\n");
    lines.forEach(function (l) {
        append("$", l);
    });
}
