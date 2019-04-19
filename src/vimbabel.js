require("polyfill.es5");
delete globalThis.Promise;
require("promise.js");

var origLoad = require.load;
function loadBabel(resolved_id, exports, module) {
    var src = origLoad(resolved_id, exports, module);
    if(resolved_id.match(/\.(js|es|ts)$/)) {
        var Babel = require("babel.es5");
        babelConfig = { 
            plugins: ["transform-async-to-generator"], 
            presets: ["es2015"], 
        };
        var result = Babel.transform(src, babelConfig);
        src = result.code;
    }
    return src;
}
require.load = loadBabel
