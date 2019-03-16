require("promise.js")

var origLoad = require.load;
function loadTs(resolved_id, exports, module) {
    var src = origLoad(resolved_id, exports, module);
    if(resolved_id.match(/\.ts$/)) {
        var ts = require('typescript.js');
        var result = ts.transpileModule(src, {})
        src = result.outputText;
    }
    return src;
}
require.load = loadTs
