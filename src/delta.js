function bufDelta(from, to) {
    var tree = undotree();
    var seq_cur = tree.seq_cur;
    ex("silent undo " + to);
    var undos = undoEntries(tree, from, to);
    ex("silent undo " + from);
    tree = undotree();
    var redos = undoEntries(tree, from, to);
    ex("silent undo " + seq_cur);
    var deltas = new Array(undos.length);
    for(var i=0; i < undos.length; i++) {
        deltas[i] = {undo: undos[i], redo: redos[i]};
    }
    return deltas;
}

function bufLSPDelta(from, to) {
    return bufDelta(from, to).map(vimDeltaToLSP);
}

function vimDeltaToLSP(delta) {
    function computeRangeLength(array) {
    // Add +1 for LF, on Windows probably need +2 for CRLF
    // Also need to count 2 for characters in some higher unicode plane 
    // (UTF-16 codepoints)
        return array.reduce(function (a, b) { 
            return a+b.length+1; 
        }, 0);
    }
    // LSP lines are 0-based, Vim lines are 1-based
    var range = {
        start: { line: (delta.redo.top+1)-1, character: 0 },
        end: { line: (delta.redo.bot)-1, character: 0 }
    };
    var rangeLength = computeRangeLength(delta.undo.array);
    var text = delta.redo.array.map(function (s) { return s+"\n" }).join("");
    return { range: range, rangeLength: rangeLength, text: text };
}

function undotree() {
    var undotree_json = vim_eval("json_encode(undotree())");
    var undotree_data = JSON.parse(undotree_json);
    return undotree_data;
}

// Returns a list of steps to go from the undo state after "from" to state "to".
// If "from" is 0, since the beginning of the undo history. 
function undoEntries(tree, from, to) {
    var steps = tree.entries;
    var nsteps = steps.length;
    var deltas = [];
    var fromIndex, toIndex;
    if(from == 0) {
        fromIndex = -1;
    } else for(fromIndex = 0; fromIndex < nsteps; fromIndex++) {
        if(steps[fromIndex].seq == from)
            break;
    }
    for(toIndex = fromIndex+1; toIndex < nsteps; toIndex++) {
        var stepEntries = steps[toIndex].entries;
        var N = stepEntries.length;
        for(var i=0; i < N; i++) {
            deltas.push(stepEntries[i]);
        }
        if(steps[toIndex].seq == to)
            break;
    }
    return deltas;
}
