Steps to compile:
1. Download a source release of Duktape from http://duktape.org and unpack
2. Clone the repository above, checkout the duktape branch
   $ git clone -b duktape https://github.com/bobpepin/vim.git
3. Edit vim/src/Makefile, point CONF_OPT_DUKTAPE_PREFIX to the right directory
   in the duktape sources 
4. Compile Vim as usual

There is API documentation and examples under :help duktape, or in
runtime/doc/if_duk.txt.

The API is probably best explained by example, have a look at
runtime/indent/python.js. This file was generated from indent/python.vim using
a vimscript to ECMAScript compiler which can be found at
https://github.com/bobpepin/vim2js.

To try it out, in a new buffer do :duk source(‘indent/python.js’) and write
some python code, which should now use the ECMAScript code for indenting. It
is also instructive to do vim -O python.vim python.js to get a side-by-side
view of the two APIs.

