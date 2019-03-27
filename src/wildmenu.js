function Wildmenu(items) {
    this.items = items;
    this.selectedIndex = -1;
    this.itemPages = new Array(items.length);
    this.itemOffsets = new Array(items.length);
    this.itemPages[0] = 0;
    this.itemOffsets[0] = 0;
    this.computePage(0)
}

Wildmenu.prototype.selectItem = function(index) {
    this.selectedIndex = index % this.items.length;
}

Wildmenu.prototype.selectNext = function() {
    if(this.selectedIndex < this.items.length-1) {
        this.selectedIndex++;
    }
}

Wildmenu.prototype.selectPrev = function() {
    if(this.selectedIndex > -1) {
        this.selectedIndex--;
    }
}

Wildmenu.prototype.computePage = function(index) {
    var padding = 1;
    var pageWidth = vim_c_global("Columns") - 2; // < and > on either side
    var currentPage = this.itemPages[index];
    var nItems = this.items.length;

    var ofs = this.itemOffsets[index];
    if(ofs == 0 && this.items[index].length > pageWidth) {
        if(index + 1 < nItems) {
            this.itemPages[index+1] = currentPage + 1;
            this.itemOffsets[index+1] = 0;
        }
        return;
    }

    while(index < nItems) {
        var cumlen = ofs + this.items[index].length + 2*padding;
        if(cumlen <= pageWidth) {
            this.itemPages[index] = currentPage;
            this.itemOffsets[index] = ofs;
            index++;
            ofs = cumlen;
        } else {
            this.itemPages[index] = currentPage+1;
            this.itemOffsets[index] = 0;
            break;
        }
    }
    return index;
}

Wildmenu.prototype.pageEnd = function(index) {
    var itemPages = this.itemPages;
    var nItems = this.items.length;
    var currentPage = itemPages[index];
    while(index < nItems && itemPages[index] == currentPage)
        index++;
    return index;
}

Wildmenu.prototype.pageStart = function(index) {
    var currentPage = this.itemPages[index];
    var itemPages = this.itemPages;
    while(index > 0 && itemPages[index-1] == currentPage)
        index--
    return index;
}

Wildmenu.prototype.redraw = function() {
    var index = this.selectedIndex;
    if(index == -1)
        index = 0;
    var page = this.itemPages[index];
    var start = this.pageStart(index);
    var end = this.pageEnd(index);
    var Columns = vim_c_global("Columns");
    var str = page > 0 ? "< " : "  ";
    str += this.items.slice(start, end).join("  ");
    str += " ".repeat(Columns - str.length - 2);
    str += end < this.items.length ? " >" : "  ";
    var cmdline_row = vim_c_global("cmdline_row");
    screen_puts(str, cmdline_row, 0, 0);
    if(this.selectedIndex >= 0) {
        var itemstr = " " + this.items[index] + " ";
        var ofs = this.itemOffsets[index] + 1;
        screen_puts(itemstr, cmdline_row, ofs, 4);
    }
}

var wm;
function blu() {
    var items = [
        "Foo", "Bar", "Baz", "Bla",
        "Foo", "Bar", "Baz", "Bla",
        "Foo", "Bar", "Baz", "Bla",
        "Foo", "Bar", "Baz", "Bla",
    ];
    wm = new Wildmenu(items);
}

function blublu() {
    wm.selectNext();
    wm.redraw();
}

function ulbulb() {
    wm.selectPrev();
    wm.redraw();
}

function wildmenu(items, selected) {
    var floor = Math.floor;
    var cmdline_row = vim_c_global("cmdline_row");
//    screen_puts("Blaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", cmdline_row, 0, 0);
//    return
    var Columns = vim_c_global("Columns");
    var pageWidth = Columns - 2; // < and > on either side
    var cumlen = 0;
    var nitems = items.length;
    var itempages = new Array(nitems);
    var selCol = -1;
    for(var i=0; i < nitems; i++) {
        cumlen += items[i].length + 2; // padding of 1 on each side
        itempages[i] = floor(cumlen / pageWidth);
    }
    var start = selected;
    var end = selected;
    var selectedPage = itempages[selected];
    while(start >= 0 && itempages[start] == selectedPage) {
        start--;
    }
    start++;
    while(end < nitems && itempages[end] == selectedPage) {
        end++;
    }
    var str = selectedPage > 0 ? "< " : "  ";
    str += items.slice(start, end).join("  ");
    str += " ".repeat(Columns - str.length - 2);
    str += " >";
    screen_puts(str, cmdline_row, 0, 0);
    //do_cmdline_cmd("redraw")
}

var selectedBla = 0;
function bla() {
    var items = [
        "Foo", "Bar", "Baz", "Bla",
        "Foo", "Bar", "Baz", "Bla",
        "Foo", "Bar", "Baz", "Bla",
        "Foo", "Bar", "Baz", "Bla",
    ];
    wildmenu(items, selectedBla);
    // selectedBla++;
}
// -g
// N = 100 000
// puts: 0.23
// puts + cmdline_row: 0.41
// bla + puts: 4.47
// bla + wildmenu / 4 items: 9.74
// bla + wildmenu / 16 items: 24.74
// N = 1
// bla + wildmenu / 16 items: 0.001
// bla + wildmenu / 4 items: 0.0004
// -g -O2
// N = 1 000 000, time ./vim
// bla + wildmenu + concat / 16 items: 22.40
// bla + wildmenu + noconcat / 16 items: 16.72
// bla + wildmenu + noconcat +nopush / 16 items: 13.09
// bla + wildmenu + noconcat +nopush +nitems / 16 items: 12.20
// bla + wildmenu + noconcat +nopush +nitems +floor / 16 items: 11.02
//  +noslice: 17.98
//  +nostrcat: 11.90
//  +pageItems: 11.05
//  +noredraw: 10.21

function blubb(n) {
    for(var i=0; i < n; i++) {
        //do_cmdline_cmd("echo 'Blaaaaaaaaaaaaaa'")
        // var cmdline_row = vim_c_global("cmdline_row");
        //screen_puts("Bla", 23, 0, 0);
        bla();
    }
}

function foo() {
    var cmdline_row = vim_c_global("cmdline_row");
    screen_puts("BLA!!!!", cmdline_row, 0, 0);
}
