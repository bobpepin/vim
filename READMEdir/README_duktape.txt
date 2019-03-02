Steps to compile:
1. Download a source release of Duktape from http://duktape.org and unpack
2. Clone the repository above, checkout the duktape branch
   $ git clone -b duktape https://github.com/bobpepin/vim.git
3. Edit vim/src/Makefile, point CONF_OPT_DUKTAPE_PREFIX to the right directory in the duktape 
   sources
4. Compile Vim as usual

The API is probably best explained by example:
https://github.com/bobpepin/vim/blob/duktape/runtime/indent/python.js.

The python.js file was generated from indent/python.vim using a cross-compiler which can be found at https://github.com/bobpepin/vim2js.

To try it out, in a new buffer do :duk source(‘indent/python.js’) and write some python code. It is also instructive to do vim -O python.vim python.js to get a side-by-side view of the two APIs.

There is also extensive documentation and further examples under :help duktape, or in runtime/doc/if_duk.txt (https://github.com/bobpepin/vim/blob/duktape/runtime/doc/if_duk.txt).
