This Vim has the Duktape ECMAScript interpreter integrated.

Quickstart (Mac or Linux):
```
git clone https://github.com/bobpepin/vim.git && \
 cd vim && \
 curl https://duktape.org/duktape-2.3.0.tar.xz | tar xfvz - duktape-2.3.0/src && \
 curl -Lo runtime/babel.es5 https://unpkg.com/@babel/standalone/babel.js && \
 curl -Lo runtime/polyfill.es5 https://unpkg.com/@babel/polyfill/dist/polyfill.js && \
 cd src && make
```

Quickstart (Windows):
- Download the binaries from https://github.com/bobpepin/vim/releases/tag/duk-win64-20190419T182100
- Download https://unpkg.com/@babel/standalone/babel.js and save it in your `runtimepath` as `babel.es5`
- Download https://unpkg.com/@babel/polyfill/dist/polyfill.js and save it in your `runtimepath` as `polyfill.es5`


You can use the ES5 programming language to script Vim, with no external dependencies at runtime. It supports all Vim builtin functions and Node.js-type modules. The ES5 language (also known as Javascript) is a modern programming language that is widely used and has a huge library of open source code. Many other programming languages can be compiled into ES5.

To get started, download a source release of Duktape from http://duktape.org, clone this repository and edit src/Makefile so that `CONF_OPT_DUKTAPE_PREFIX` points to the Duktape sources. Then compile as usual.

There are two new ex commands, `:duktape` and `:dukfile` to execute ECMAScript code from the command line and from a file.

Some examples of the API (remember to include `../runtime` in `runtimepath` if running vim from the `src/` directory, for example by executing `set rtp+=../runtime` before running the first Duktape command):

Execute an ES5 expression:
```
	:duk var l = bufname(0); append(".", "Buffer name: "+l)
```
Load an ES5 file from the current directory:
```
        :dukfile delta.js
```
Load an ECMAScript module `foo.js` from runtimepath (Node.js/CommonJS-style):
```
        :duk var foo = require("foo.js")
```
Enable Babel support (needs `babel.es5` in runtimepath):
```
        :dukfile vimbabel.js
```
Load an ES2017 module:
```
        :duk var lsp = require("./lsp-jsonrpc.ts")
```

There is API documentation and examples under :help duktape, or in
runtime/doc/if_duk.txt.

An example of a complete script can be found in runtime/indent/python.js. 
This file was generated from indent/python.vim using a vimscript to ECMAScript compiler which can be found at
https://github.com/bobpepin/vim2js.

To load the script, in a new buffer do :duk source(‘indent/python.js’) and write
some python code, which should now use the ECMAScript code for indenting. It
is also instructive to do vim -O python.vim python.js to get a side-by-side
view of the two APIs.

The original Vim README follows.

![Vim Logo](https://github.com/vim/vim/blob/master/runtime/vimlogo.gif)

[![Build Status](https://travis-ci.org/vim/vim.svg?branch=master)](https://travis-ci.org/vim/vim)
[![Appveyor Build status](https://ci.appveyor.com/api/projects/status/o2qht2kjm02sgghk?svg=true)](https://ci.appveyor.com/project/chrisbra/vim)
[![Coverage Status](https://codecov.io/gh/vim/vim/coverage.svg?branch=master)](https://codecov.io/gh/vim/vim?branch=master)
[![Coverity Scan](https://scan.coverity.com/projects/241/badge.svg)](https://scan.coverity.com/projects/vim)
[![Language Grade: C/C++](https://img.shields.io/lgtm/grade/cpp/g/vim/vim.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/vim/vim/context:cpp)
[![Debian CI](https://badges.debian.net/badges/debian/testing/vim/version.svg)](https://buildd.debian.org/vim)
[![Packages](https://repology.org/badge/tiny-repos/vim.svg)](https://repology.org/metapackage/vim)


## What is Vim? ##

Vim is a greatly improved version of the good old UNIX editor Vi.  Many new
features have been added: multi-level undo, syntax highlighting, command line
history, on-line help, spell checking, filename completion, block operations,
script language, etc.  There is also a Graphical User Interface (GUI)
available.  Still, Vi compatibility is maintained, those who have Vi "in the
fingers" will feel at home.  See `runtime/doc/vi_diff.txt` for differences with
Vi.

This editor is very useful for editing programs and other plain text files.
All commands are given with normal keyboard characters, so those who can type
with ten fingers can work very fast.  Additionally, function keys can be
mapped to commands by the user, and the mouse can be used.

Vim runs under MS-Windows (NT, 2000, XP, Vista, 7, 8, 10), Macintosh, VMS and
almost all flavours of UNIX.  Porting to other systems should not be very
difficult.  Older versions of Vim run on MS-DOS, MS-Windows 95/98/Me, Amiga
DOS, Atari MiNT, BeOS, RISC OS and OS/2.  These are no longer maintained.


## Distribution ##

You can often use your favorite package manager to install Vim.  On Mac and
Linux a small version of Vim is pre-installed, you still need to install Vim
if you want more features.

There are separate distributions for Unix, PC, Amiga and some other systems.
This `README.md` file comes with the runtime archive.  It includes the
documentation, syntax files and other files that are used at runtime.  To run
Vim you must get either one of the binary archives or a source archive.
Which one you need depends on the system you want to run it on and whether you
want or must compile it yourself.  Check http://www.vim.org/download.php for
an overview of currently available distributions.

Some popular places to get the latest Vim:
* Check out the git repository from [github](https://github.com/vim/vim).
* Get the source code as an [archive](https://github.com/vim/vim/releases).
* Get a Windows executable from the
[vim-win32-installer](https://github.com/vim/vim-win32-installer/releases) repository.



## Compiling ##

If you obtained a binary distribution you don't need to compile Vim.  If you
obtained a source distribution, all the stuff for compiling Vim is in the
`src` directory.  See `src/INSTALL` for instructions.


## Installation ##

See one of these files for system-specific instructions.  Either in the
READMEdir directory (in the repository) or the top directory (if you unpack an
archive):

	README_ami.txt		Amiga
	README_unix.txt		Unix
	README_dos.txt		MS-DOS and MS-Windows
	README_mac.txt		Macintosh
	README_vms.txt		VMS

There are other `README_*.txt` files, depending on the distribution you used.


## Documentation ##

The Vim tutor is a one hour training course for beginners.  Often it can be
started as `vimtutor`.  See `:help tutor` for more information.

The best is to use `:help` in Vim.  If you don't have an executable yet, read
`runtime/doc/help.txt`.  It contains pointers to the other documentation
files.  The User Manual reads like a book and is recommended to learn to use
Vim.  See `:help user-manual`.


## Copying ##

Vim is Charityware.  You can use and copy it as much as you like, but you are
encouraged to make a donation to help orphans in Uganda.  Please read the file
`runtime/doc/uganda.txt` for details (do `:help uganda` inside Vim).

Summary of the license: There are no restrictions on using or distributing an
unmodified copy of Vim.  Parts of Vim may also be distributed, but the license
text must always be included.  For modified versions a few restrictions apply.
The license is GPL compatible, you may compile Vim with GPL libraries and
distribute it.


## Sponsoring ##

Fixing bugs and adding new features takes a lot of time and effort.  To show
your appreciation for the work and motivate Bram and others to continue
working on Vim please send a donation.

Since Bram is back to a paid job the money will now be used to help children
in Uganda.  See `runtime/doc/uganda.txt`.  But at the same time donations
increase Bram's motivation to keep working on Vim!

For the most recent information about sponsoring look on the Vim web site:
	http://www.vim.org/sponsor/


## Contributing ##

If you would like to help making Vim better, see the [CONTRIBUTING.md](https://github.com/vim/vim/blob/master/CONTRIBUTING.md) file.


## Information ##

The latest news about Vim can be found on the Vim home page:
	http://www.vim.org/

If you have problems, have a look at the Vim documentation or tips:
	http://www.vim.org/docs.php
	http://vim.wikia.com/wiki/Vim_Tips_Wiki

If you still have problems or any other questions, use one of the mailing
lists to discuss them with Vim users and developers:
	http://www.vim.org/maillist.php

If nothing else works, report bugs directly:
	Bram Moolenaar <Bram@vim.org>


## Main author ##

Send any other comments, patches, flowers and suggestions to:
	Bram Moolenaar <Bram@vim.org>


This is `README.md` for version 8.1 of Vim: Vi IMproved.
