function search(regex, start, dir) {
    var lastline = line("$");
    if(start > lastline)
        start = lastline;
    if(start < 0)
        start = 0;
    for(var i=start; i > 0 && i < lastline; i += dir) {
        if(regex.test(getline(i)))
            break;
    }
    return i;
}

function getlines(start, end) {
    var r = [];
    for(var i=start; i <= end; i++) {
        r.push(getline(i));
    }
    return r;
}

function appendlines(lnum, lines) {
    for(var i=0; i < lines.length; i++) {
        append(lnum+i, lines[i]);
    }
}

function runCell() {
    var separator = /^\/\/\/\/$/;
    var curline = line(".");
    var lastline = line("$");
    var cellStart = search(separator, curline, -1);
    var cellEnd = search(separator, curline+1, 1);
    if(cellEnd != lastline)
        cellEnd--;
    var code = getlines(cellStart, cellEnd).join("\n");
    var fun = compile(code, "", {});
    var r = fun();
    var rstr = JSON.stringify(r);
    var outlines = rstr.split("\n");
    outlines.unshift("/* output:");
    outlines.push("*/");
    appendlines(cellEnd, outlines);
}
