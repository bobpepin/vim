function initGlobal(globalThis) { 
    var vim_builtin_functions = ['abs', 'acos', 'add', 'and', 'append',
	'append', 'argc', 'argidx', 'argv', 'argv', 'asin', 'atan', 'atan2',
	'browse', 'browsedir', 'bufexists', 'buflisted', 'bufloaded',
	'bufname', 'bufnr', 'bufwinnr', 'byte2line', 'byteidx', 'call', 'ceil',
	'changenr', 'char2nr', 'cindent', 'clearmatches', 'col', 'complete',
	'complete_add', 'complete_check', 'confirm', 'copy', 'cos', 'cosh',
	'count', 'cscope_connection', 'cursor', 'cursor', 'deepcopy', 'delete',
	'did_filetype', 'diff_filler', 'diff_hlID', 'empty', 'escape', 'eval',
	'eventhandler', 'executable', 'exists', 'extend', 'exp', 'expand',
	'feedkeys', 'filereadable', 'filewritable', 'filter', 'finddir',
	'findfile', 'float2nr', 'floor', 'fmod', 'fnameescape', 'fnamemodify',
	'foldclosed', 'foldclosedend', 'foldlevel', 'foldtext',
	'foldtextresult', 'foreground', 'function', 'garbagecollect', 'get',
	'get', 'getbufline', 'getbufvar', 'getchar', 'getcharmod',
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

    globalThis.ex = do_cmdline_cmd

    function NamespaceProxy(ns) {
	var handler = {
	    has: function (target, key) {
		return globalThis.exists(ns + ":" + key)
	    },
	    get: function(target, key, recv) {
		return globalThis.eval(ns + ":" + key)
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
		return globalThis.eval("eval(string(&" + key + "))")
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
            ex("function " + name + "(...)\nreturn dukcall('" + name + "', a:000)\nendfunction")
        }
    }
    globalThis.registerExports = registerExports
    globalThis.source = function(module_id) {
        delete require.cache[module_id];
        registerExports(require(module_id));
    }
}

initGlobal(this)
