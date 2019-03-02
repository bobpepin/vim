var $s = scriptVariables[module.id];
// Vim indent file
// Language:		Python
// Maintainer:		Bram Moolenaar <Bram@vim.org>
// Original Author:	David Bustos <bustos@caltech.edu>
// Last Change:		2013 Jul 9

// Only load this indent file when no other was loaded.
if (exists("b:did_indent")) {
    return;
}
$b.did_indent = 1;

// Some preliminary settings
ex("setlocal nolisp")
// Make sure lisp indenting doesn't supersede us
ex("setlocal autoindent")
// indentexpr isn't much help otherwise

ex("setlocal indentexpr=GetPythonIndent(v:lnum)")
ex("setlocal indentkeys+=<:>,=elif,=except")

// Only define the function once.
if (exists("*GetPythonIndent")) {
    return;
}
$s.keepcpo = $o.cpo;
ex("set cpo&vim")

// Come here when loading the script the first time.

$s.maxoff = 50;
// maximum number of lines to look backwards for ()

function GetPythonIndent (lnum) {
    var $a = {lnum: lnum};

    // If this line is explicitly joined: If the previous line was also joined,
    // line it up with that one, otherwise add two 'shiftwidth'
    if (matchstr(getline($a.lnum - 1), "\\\\$")) {
        if ($a.lnum > 1 && matchstr(getline($a.lnum - 2), "\\\\$")) {
            return indent($a.lnum - 1);
        }
        return indent($a.lnum - 1) + (exists("g:pyindent_continue") ? eval($g.pyindent_continue) : shiftwidth() * 2);
    }

    // If the start of the line is in a string don't change the indent.
    if (has("syntax_items") && matchstr(synIDattr(synID($a.lnum, 1, 1), "name"), "String$")) {
        return -1;
    }

    // Search backwards for the previous non-empty line.
    var plnum = prevnonblank($v.lnum - 1);

    if (plnum == 0) {
        // This is the first non-empty line, use zero indent.
        return 0;
    }

    // searchpair() can be slow sometimes, limit the time to 100 msec or what is
    // put in g:pyindent_searchpair_timeout
    var searchpair_stopline = 0;
    var searchpair_timeout = get($g, "pyindent_searchpair_timeout", 150);

    // If the previous line is inside parenthesis, use the indent of the starting
    // line.
    // Trick: use the non-existing "dummy" variable to break out of the loop when
    // going too far back.
    cursor(plnum, 1);
    var parlnum = searchpair("(\\|{\\|\\[", "", ")\\|}\\|\\]", "nbW", "line('.') < " + plnum - $s.maxoff + " ? dummy :" + " synIDattr(synID(line('.'), col('.'), 1), 'name')" + " =~ '\\(Comment\\|Todo\\|String\\)$'", searchpair_stopline, searchpair_timeout);
    if (parlnum > 0) {
        var plindent = indent(parlnum);
        var plnumstart = parlnum;
    }
    else {
        var plindent = indent(plnum);
        var plnumstart = plnum;
    }


    // When inside parenthesis: If at the first line below the parenthesis add
    // two 'shiftwidth', otherwise same as previous line.
    // i = (a
    //       + b
    //       + c)
    cursor($a.lnum, 1);
    var p = searchpair("(\\|{\\|\\[", "", ")\\|}\\|\\]", "bW", "line('.') < " + $a.lnum - $s.maxoff + " ? dummy :" + " synIDattr(synID(line('.'), col('.'), 1), 'name')" + " =~ '\\(Comment\\|Todo\\|String\\)$'", searchpair_stopline, searchpair_timeout);
    if (p > 0) {
        if (p == plnum) {
            // When the start is inside parenthesis, only indent one 'shiftwidth'.
            var pp = searchpair("(\\|{\\|\\[", "", ")\\|}\\|\\]", "bW", "line('.') < " + $a.lnum - $s.maxoff + " ? dummy :" + " synIDattr(synID(line('.'), col('.'), 1), 'name')" + " =~ '\\(Comment\\|Todo\\|String\\)$'", searchpair_stopline, searchpair_timeout);
            if (pp > 0) {
                return indent(plnum) + (exists("g:pyindent_nested_paren") ? eval($g.pyindent_nested_paren) : shiftwidth());
            }
            return indent(plnum) + (exists("g:pyindent_open_paren") ? eval($g.pyindent_open_paren) : shiftwidth() * 2);
        }
        if (plnumstart == p) {
            return indent(plnum);
        }
        return plindent;
    }


    // Get the line and remove a trailing comment.
    // Use syntax highlighting attributes when possible.
    var pline = getline(plnum);
    var pline_len = strlen(pline);
    if (has("syntax_items")) {
        // If the last character in the line is a comment, do a binary search for
        // the start of the comment.  synID() is slow, a linear search would take
        // too long on a long line.
        if (matchstr(synIDattr(synID(plnum, pline_len, 1), "name"), "\\(Comment\\|Todo\\)$")) {
            var min = 1;
            var max = pline_len;
            while (min < max) {
                var col = (min + max) / 2;
                if (matchstr(synIDattr(synID(plnum, col, 1), "name"), "\\(Comment\\|Todo\\)$")) {
                    var max = col;
                }
                else {
                    var min = col + 1;
                }
            }
            var pline = strpart(pline, 0, min - 1);
        }
    }
    else {
        var col = 0;
        while (col < pline_len) {
            if (pline[col] == "#") {
                var pline = strpart(pline, 0, col);
                break;
            }
            var col = col + 1;
        }
    }

    // If the previous line ended with a colon, indent this line
    if (matchstr(pline, ":\\s*$")) {
        return plindent + shiftwidth();
    }

    // If the previous line was a stop-execution statement...
    if (matchstr(getline(plnum), "^\\s*\\(break\\|continue\\|raise\\|return\\|pass\\)\\>")) {
        // See if the user has already dedented
        if (indent($a.lnum) > indent(plnum) - shiftwidth()) {
            // If not, recommend one dedent
            return indent(plnum) - shiftwidth();
        }
        // Otherwise, trust the user
        return -1;
    }

    // If the current line begins with a keyword that lines up with "try"
    if (matchstr(getline($a.lnum), "^\\s*\\(except\\|finally\\)\\>")) {
        var lnum = $a.lnum - 1;
        while (lnum >= 1) {
            if (matchstr(getline(lnum), "^\\s*\\(try\\|except\\)\\>")) {
                var ind = indent(lnum);
                if (ind >= indent($a.lnum)) {
                    return -1;
                    // indent is already less than this
                }
                return ind;
                // line up with previous try or except
            }
            var lnum = lnum - 1;
        }
        return -1;
        // no matching "try"!
    }

    // If the current line begins with a header keyword, dedent
    if (matchstr(getline($a.lnum), "^\\s*\\(elif\\|else\\)\\>")) {

        // Unless the previous line was a one-liner
        if (matchstr(getline(plnumstart), "^\\s*\\(for\\|if\\|try\\)\\>")) {
            return plindent;
        }

        // Or the user has already dedented
        if (indent($a.lnum) <= plindent - shiftwidth()) {
            return -1;
        }

        return plindent - shiftwidth();
    }

    // When after a () construct we probably want to go back to the start line.
    // a = (b
    //       + c)
    // here
    if (parlnum > 0) {
        return plindent;
    }

    return -1;

}
exports.GetPythonIndent = GetPythonIndent;


$o.cpo = $s.keepcpo;
delete $s.keepcpo;

// vim:sw=2
