function initGlobal(globalThis) {
    globalThis.globalThis = globalThis
}

function initVim(globalThis) { 
    var vim_builtin_functions = ['abs', 'acos', 'add', 'and', 'append',
	'append', 'argc', 'argidx', 'argv', 'argv', 'asin', 'atan', 'atan2',
	'browse', 'browsedir', 'bufexists', 'buflisted', 'bufloaded',
	'bufname', 'bufnr', 'bufwinnr', 'byte2line', 'byteidx', 'call', 'ceil',
	'changenr', 'char2nr', 'cindent', 'clearmatches', 'col', 'complete',
	'complete_add', 'complete_check', 'confirm', 'copy', 'cos', 'cosh',
	'count', 'cscope_connection', 'cursor', 'cursor', 'deepcopy', 'delete',
	'did_filetype', 'diff_filler', 'diff_hlID', 'empty', 'escape', /* 'eval', */
	'eventhandler', 'executable', 'exists', 'extend', 'exp', 'expand',
	'feedkeys', 'filereadable', 'filewritable', 'filter', 'finddir',
	'findfile', 'float2nr', 'floor', 'fmod', 'fnameescape', 'fnamemodify',
	'foldclosed', 'foldclosedend', 'foldlevel', 'foldtext',
	'foldtextresult', 'foreground', 'function', 'garbagecollect', 
	/* 'get' */, 'getbufline', 'getbufvar', 'getchar', 'getcharmod',
	'getcmdline', 'getcmdpos', 'getcmdtype', 'getcwd', 'getfperm',
	'getfsize', 'getfontname', 'getftime', 'getftype', 'getline',
	'getline', 'getloclist', 'getmatches', 'getpid', 'getpos', 'getqflist',
	'getreg', 'getregtype', 'gettabvar', 'gettabwinvar', 'getwinposx',
	'getwinposy', 'getwinvar', 'glob', 'globpath', 'has', 'has_key',
	'haslocaldir', 'hasmapto', 'histadd', 'histdel', 'histget', 'histnr',
	'hlexists', 'hlID', 'hostname', 'iconv', 'indent', 'index', 'input',
	'inputdialog', 'inputlist', 'inputrestore', 'inputsave', 'inputsecret',
	'insert', 'invert', 'isdirectory', 'islocked', 'items', 'join', 'keys',
	'len', 'libcall', 'libcallnr', 'line', 'line2byte', 'lispindent',
	'localtime', 'log', 'log10', 'luaeval', 'map', 'maparg', 'mapcheck',
	'match', 'matchadd', 'matcharg', 'matchdelete', 'matchend',
	'matchlist', 'matchstr', 'max', 'min', 'mkdir', 'mode', 'mzeval',
	'nextnonblank', 'nr2char', 'or', 'pathshorten', 'pow', 'prevnonblank',
	'printf', 'pumvisible', 'pyeval', 'py3eval', 'range', 'readfile',
	'reltime', 'reltimestr', 'remote_expr', 'remote_foreground',
	'remote_peek', 'remote_read', 'remote_send', 'remove', 'remove',
	'rename', 'repeat', 'resolve', 'reverse', 'round', 'screencol',
	'screenrow', 'search', 'searchdecl', 'searchpair', 'searchpairpos',
	'searchpos', 'server2client', 'serverlist', 'setbufvar', 'setcmdpos',
	'setline', 'setloclist', 'setmatches', 'setpos', 'setqflist', 'setreg',
	'settabvar', 'settabwinvar', 'setwinvar', 'sha256', 'shellescape',
	'shiftwidth', 'simplify', 'sin', 'sinh', 'sort', 'soundfold',
	'spellbadword', 'spellsuggest', 'split', 'sqrt', 'str2float', 'str2nr',
	'strchars', 'strdisplaywidth', 'strftime', 'stridx', 'string',
	'strlen', 'strpart', 'strridx', 'strtrans', 'strwidth', 'submatch',
	'substitute', 'synID', 'synIDattr', 'synIDtrans', 'synconcealed',
	'synstack', 'system', 'tabpagebuflist', 'tabpagenr', 'tabpagewinnr',
	'taglist', 'tagfiles', 'tempname', 'tan', 'tanh', 'tolower', 'toupper',
	'tr', 'trunc', 'type', 'undofile', 'undotree', 'values', 'virtcol',
	'visualmode', 'wildmenumode', 'winbufnr', 'wincol', 'winheight',
	'winline', 'winnr', 'winrestcmd', 'winrestview', 'winsaveview',
	'winwidth', 'writefile', 'xor']

    vim_builtin_functions.forEach(function (fn) {
	globalThis[fn] = function () {
	    var arglist = Array.prototype.slice.call(arguments);
	    return call_internal_func(fn, arglist)
	}
    })

    globalThis.vim_eval = function(str) {
        return call_internal_func('eval', [str]);
    }

    globalThis.get = function(obj, key, default_val) {
        if(key in obj) {
            return obj[key];
        } else {
            return default_val;
        }
    }

    globalThis.ex = do_cmdline_cmd

    function NamespaceProxy(ns) {
	var handler = {
	    has: function (target, key) {
		return globalThis.exists(ns + ":" + key)
	    },
	    get: function(target, key, recv) {
		return globalThis.vim_eval(ns + ":" + key)
	    },
	    set: function(target, key, value, recv) {
		var cmd = "let " + ns + ":" + key + " = json_decode('" +
			JSON.stringify(value) + "')"
                //msg(cmd)
		do_cmdline_cmd(cmd)
                return true
            },
            deleteProperty: function (target, key) {
                var cmd = "unlet " + ns + ":" + key
                //msg(cmd)
                do_cmdline_cmd(cmd)
                return true
            }
        }
        return new Proxy({}, handler)
    }
    function OptionProxy() {
	var handler = {
	    has: function (target, key) {
		return globalThis.exists("&" + key)
	    },
	    get: function(target, key, recv) {
		return globalThis.vim_eval("eval(string(&" + key + "))")
	    },
	    set: function(target, key, value, recv) {
		var cmd = "set " + key + "=" + value
                // msg(cmd)
		do_cmdline_cmd(cmd)
                return true
            },
            deleteProperty: function (target, key) {
                return false
            }
        }
        return new Proxy({}, handler)
    }
    function DefaultDict(DefaultCls) {
	var handler = {
	    has: function (target, key) {
		return true;
	    },
	    get: function(target, key, recv) {
                if(!(key in target)) {
                    target[key] = new DefaultCls()
                }
		return target[key];
	    }        
        }
        return new Proxy({}, handler)
    }
    globalThis.$b = new NamespaceProxy("b")
    globalThis.$g = new NamespaceProxy("g")
    globalThis.$t = new NamespaceProxy("t")
    globalThis.$v = new NamespaceProxy("v")
    globalThis.$w = new NamespaceProxy("w")
    globalThis.$o = new OptionProxy()

    globalThis.scriptVariables = new DefaultDict(Object);

    function registerExports(exports) {
        for(name in exports) {
            globalThis[name] = exports[name];
            ex("function! " + name + "(...)\nreturn dukcall('" + name + "', a:000)\nendfunction")
        }
    }
    globalThis.registerExports = registerExports
    globalThis.source = function(module_id) {
        delete require.cache[module_id];
        var exports = require(module_id);
        registerExports(exports);
        return exports;
    }

    var callbacks = {};
    var callback_seq = -1;

    globalThis.registerCallback = function(fn) {
        callback_seq++;
        callbacks[callback_seq] = function () {
            var args = Array.prototype.slice.call(arguments, 1);
            return fn.apply(null, args);
        }
        return callback_seq;
    }

    globalThis.registerCallbackOnce = function(fn) {
        callback_seq++;
        callbacks[callback_seq] = function (cbid) {
            unregisterCallback(cbid);
            var args = Array.prototype.slice.call(arguments, 1);
            return fn.apply(null, args);
        }
        return callback_seq;
    }

    globalThis.unregisterCallback = function(id) {
        delete callbacks[id];
    }

    globalThis.vim_callback = function(id) {
        var fn = callbacks[id];
        return fn.apply(null, arguments);
    }

    do_cmdline_cmd("function! Duk_callback(...) \ncall dukcall('vim_callback', a:000)\nendfunction")
}

// filereadable(fname), mkdir(dirname, "p")
function initModules(globalThis) {
    var moduleCache = {}

    var bytecodeDir = call_internal_func("expand", ["~/.cache/vim"]);
    function loadBytecode(resolvedId) {
        call_internal_func("mkdir", [bytecodeDir, "p"]);
        var fname = bytecodeDir + "/" + encodeURIComponent(resolvedId)
        if(call_internal_func("filereadable", [fname])) {
            bytecode = read_blob(fname);
            msg("load bytecode " + fname);
            return duk_load_function(bytecode);
        }
        return null;
    }

    function saveBytecode(resolvedId, fun) {
        call_internal_func("mkdir", [bytecodeDir, "p"]);
        var fname = bytecodeDir + "/" + encodeURIComponent(resolvedId)
        msg("save bytecode " + fname + " " + resolvedId);
        bytecode = duk_dump_function(fun);
        write_blob(fname, bytecode);
    }

    function handleRequire(id) {
        var parentId = this.moduleId;
        var resolvedId = this.resolve(id, parentId);
        if(resolvedId in this.cache) {
            return this.cache[resolvedId].exports;
        }
        var module = {
            filename: id,
            id: id,
            exports: {},
            loaded: false,
            require: makeRequireFun(this)
        }
        module.require.moduleId = id;
        this.cache[resolvedId] = module;
        try {
            var fun = loadBytecode(resolvedId);
            if(!fun) {
                var src = this.load(resolvedId, module.exports, module);
                if(typeof src === "string") {
                    var module_src = "function(exports,require,module,__filename,__dirname){";
                    if(src[0] == '#' && src[1] == '!') {
                        module_src += "//";
                    }
                    module_src += src;
                    module_src += "\n}";
                    var fun = compile(module_src, module.filename, {function: true});
                    saveBytecode(resolvedId, fun);
                } else if(src !== undefined) {
                    throw new TypeError("invalid module load callback return value");
                }
            }
            fun(module.exports, module.require, module, module.filename);
            module.loaded = true;
        } catch (e) {
            delete this.cache[resolvedId];
            throw e;
        }
        return module.exports;
    }
    
    function makeRequireFun(parentRequire) {
        var parentId = parentRequire.moduleId;
        function require(id) { return handleRequire.call(require, id); }
        require.cache = parentRequire.cache;
        require.resolve = parentRequire.resolve;
        require.load = parentRequire.load;
        require.forget = parentRequire.forget;
        return require;
    }

    function resolve(requestedId, parentId) {
        if(parentId === undefined) {
            parentId = this.moduleId
        }
        var resolvedId = undefined;
        if(requestedId[0] == "/") {
            resolvedId = requestedId;
        } else if(requestedId.substring(0, 2) == "./"
                    || requestedId.substring(0, 3) == "../") {
            var m = parentId.match(/^(.*)\/[^/]*$/)
            var parentDir = m ? m[1] : call_internal_func("getcwd", []);
            resolvedId = call_internal_func("simplify", [parentDir + "/" + requestedId])
        } else {
            var path = call_internal_func("eval", ["&rtp"]);
            do_in_path(path, requestedId, 0, 
                function (fname) { resolvedId = call_internal_func("simplify", [fname]); });
        }
        if(resolvedId === undefined) {
            var error = new Error('File not found in runtimepath: '
                + requestedId);
            error.name = 'MODULE_NOT_FOUND';
            throw error;
        }
        return resolvedId;
    }

    function load(resolved_id, exports, module) {
        return (new TextDecoder()).decode(read_blob(resolved_id));
    }

    function forget(requestedId) {
        var resolvedId = this.resolve(requestedId)
        delete this.cache[resolvedId]
    }

    var rootRequire = {
        cache: moduleCache, 
        resolve: resolve, 
        load: load,
        forget: forget
    };
    globalThis.require = makeRequireFun(rootRequire);
    globalThis.require.moduleId = "";
}

initGlobal(this);
if(this.do_cmdline_cmd)
    initVim(this);
initModules(this);
