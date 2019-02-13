/* vi:set ts=8 sts=4 sw=4 noet:
 *
 * VIM - Vi IMproved    by Bram Moolenaar
 *
 * Do ":help uganda"  in Vim to read copying and usage conditions.
 * Do ":help credits" in Vim to see a list of people who contributed.
 * See README.txt for an overview of the Vim source code.
 */
/*
 * Duktape JavaScript extensions by Bob Pepin.
 *
 * This consists of four parts:
 * 1. Duktape interpreter main program
 * 2. Python output stream: writes output via [e]msg().
 * 3. Implementation of the Vim module for Python
 * 4. Utility functions for handling the interface between Vim and Python.
 */

#include "vim.h"

#include "duktape.h"
/*
 * ":duktape"
 */
void
ex_duktape(exarg_T *eap)
{
    char_u *script;

    script = script_get(eap, eap->arg);
    duk_context *ctx = duk_create_heap_default();
    if (ctx) {
        char *evalstr = script == NULL ? (char *) eap->arg : (char *) script;
        duk_eval_string(ctx, evalstr);
	printf("return value is: %lf\n", (double) duk_get_number(ctx, -1));
	duk_pop(ctx);
        duk_destroy_heap(ctx);
    }
#if 0
    if (!eap->skip)
    {
	DoPyCommand(script == NULL ? (char *) eap->arg : (char *) script,
		(rangeinitializer) init_range_cmd,
		(runner) run_cmd,
		(void *) eap);
    }
#endif
    vim_free(script);
}

#if 0
/******************************************************
 * Internal function prototypes.
 */

static PyObject *Py3Init_vim(void);

/******************************************************
 * 1. Python interpreter main program.
 */

    void
python3_end(void)
{
    static int recurse = 0;

    /* If a crash occurs while doing this, don't try again. */
    if (recurse != 0)
	return;

    python_end_called = TRUE;
    ++recurse;

#ifdef DYNAMIC_PYTHON3
    if (hinstPy3)
#endif
    if (Py_IsInitialized())
    {
	/* acquire lock before finalizing */
	PyGILState_Ensure();

	Py_Finalize();
    }

#ifdef DYNAMIC_PYTHON3
    end_dynamic_python3();
#endif

    --recurse;
}

#if (defined(DYNAMIC_PYTHON3) && defined(DYNAMIC_PYTHON) && defined(FEAT_PYTHON) && defined(UNIX)) || defined(PROTO)
    int
python3_loaded(void)
{
    return (hinstPy3 != 0);
}
#endif

static wchar_t *py_home_buf = NULL;

    static int
Python3_Init(void)
{
    if (!py3initialised)
    {
#ifdef DYNAMIC_PYTHON3
	if (!python3_enabled(TRUE))
	{
	    emsg(_("E263: Sorry, this command is disabled, the Python library could not be loaded."));
	    goto fail;
	}
#endif

	init_structs();

	if (*p_py3home != NUL)
	{
	    size_t len = mbstowcs(NULL, (char *)p_py3home, 0) + 1;

	    /* The string must not change later, make a copy in static memory. */
	    py_home_buf = (wchar_t *)alloc(len * sizeof(wchar_t));
	    if (py_home_buf != NULL && mbstowcs(
			    py_home_buf, (char *)p_py3home, len) != (size_t)-1)
		Py_SetPythonHome(py_home_buf);
	}
#ifdef PYTHON3_HOME
	else if (mch_getenv((char_u *)"PYTHONHOME") == NULL)
	    Py_SetPythonHome(PYTHON3_HOME);
#endif

	PyImport_AppendInittab("vim", Py3Init_vim);

	Py_Initialize();

	/* Initialise threads, and below save the state using
	 * PyEval_SaveThread.  Without the call to PyEval_SaveThread, thread
	 * specific state (such as the system trace hook), will be lost
	 * between invocations of Python code. */
	PyEval_InitThreads();
#ifdef DYNAMIC_PYTHON3
	get_py3_exceptions();
#endif

	if (PythonIO_Init_io())
	    goto fail;

	globals = PyModule_GetDict(PyImport_AddModule("__main__"));

	/* Remove the element from sys.path that was added because of our
	 * argv[0] value in Py3Init_vim().  Previously we used an empty
	 * string, but depending on the OS we then get an empty entry or
	 * the current directory in sys.path.
	 * Only after vim has been imported, the element does exist in
	 * sys.path.
	 */
	PyRun_SimpleString("import vim; import sys; sys.path = list(filter(lambda x: not x.endswith('must>not&exist'), sys.path))");

	/* lock is created and acquired in PyEval_InitThreads() and thread
	 * state is created in Py_Initialize()
	 * there _PyGILState_NoteThreadState() also sets gilcounter to 1
	 * (python must have threads enabled!)
	 * so the following does both: unlock GIL and save thread state in TLS
	 * without deleting thread state
	 */
	PyEval_SaveThread();

	py3initialised = 1;
    }

    return 0;

fail:
    /* We call PythonIO_Flush() here to print any Python errors.
     * This is OK, as it is possible to call this function even
     * if PythonIO_Init_io() has not completed successfully (it will
     * not do anything in this case).
     */
    PythonIO_Flush();
    return -1;
}

/*
 * External interface
 */
    static void
DoPyCommand(const char *cmd, rangeinitializer init_range, runner run, void *arg)
{
#if defined(HAVE_LOCALE_H) || defined(X_LOCALE)
    char		*saved_locale;
#endif
    PyObject		*cmdstr;
    PyObject		*cmdbytes;
    PyGILState_STATE	pygilstate;

    if (python_end_called)
	goto theend;

    if (Python3_Init())
	goto theend;

    init_range(arg);

    Python_Release_Vim();	    /* leave vim */

#if defined(HAVE_LOCALE_H) || defined(X_LOCALE)
    /* Python only works properly when the LC_NUMERIC locale is "C". */
    saved_locale = setlocale(LC_NUMERIC, NULL);
    if (saved_locale == NULL || STRCMP(saved_locale, "C") == 0)
	saved_locale = NULL;
    else
    {
	/* Need to make a copy, value may change when setting new locale. */
	saved_locale = (char *)vim_strsave((char_u *)saved_locale);
	(void)setlocale(LC_NUMERIC, "C");
    }
#endif

    pygilstate = PyGILState_Ensure();

    /* PyRun_SimpleString expects a UTF-8 string. Wrong encoding may cause
     * SyntaxError (unicode error). */
    cmdstr = PyUnicode_Decode(cmd, strlen(cmd),
					(char *)ENC_OPT, CODEC_ERROR_HANDLER);
    cmdbytes = PyUnicode_AsEncodedString(cmdstr, "utf-8", CODEC_ERROR_HANDLER);
    Py_XDECREF(cmdstr);

    run(PyBytes_AsString(cmdbytes), arg, &pygilstate);
    Py_XDECREF(cmdbytes);

    PyGILState_Release(pygilstate);

#if defined(HAVE_LOCALE_H) || defined(X_LOCALE)
    if (saved_locale != NULL)
    {
	(void)setlocale(LC_NUMERIC, saved_locale);
	vim_free(saved_locale);
    }
#endif

    Python_Lock_Vim();		    /* enter vim */
    PythonIO_Flush();

theend:
    return;	    /* keeps lint happy */
}

/*
 * ":py3"
 */
    void
ex_py3(exarg_T *eap)
{
    char_u *script;

    if (p_pyx == 0)
	p_pyx = 3;

    script = script_get(eap, eap->arg);
    if (!eap->skip)
    {
	DoPyCommand(script == NULL ? (char *) eap->arg : (char *) script,
		(rangeinitializer) init_range_cmd,
		(runner) run_cmd,
		(void *) eap);
    }
    vim_free(script);
}

#define BUFFER_SIZE 2048

/*
 * ":py3file"
 */
    void
ex_py3file(exarg_T *eap)
{
    static char buffer[BUFFER_SIZE];
    const char *file;
    char *p;
    int i;

    if (p_pyx == 0)
	p_pyx = 3;

    /* Have to do it like this. PyRun_SimpleFile requires you to pass a
     * stdio file pointer, but Vim and the Python DLL are compiled with
     * different options under Windows, meaning that stdio pointers aren't
     * compatible between the two. Yuk.
     *
     * construct: exec(compile(open('a_filename', 'rb').read(), 'a_filename', 'exec'))
     *
     * Using bytes so that Python can detect the source encoding as it normally
     * does. The doc does not say "compile" accept bytes, though.
     *
     * We need to escape any backslashes or single quotes in the file name, so that
     * Python won't mangle the file name.
     */

    strcpy(buffer, "exec(compile(open('");
    p = buffer + 19; /* size of "exec(compile(open('" */

    for (i=0; i<2; ++i)
    {
	file = (char *)eap->arg;
	while (*file && p < buffer + (BUFFER_SIZE - 3))
	{
	    if (*file == '\\' || *file == '\'')
		*p++ = '\\';
	    *p++ = *file++;
	}
	/* If we didn't finish the file name, we hit a buffer overflow */
	if (*file != '\0')
	    return;
	if (i==0)
	{
	    strcpy(p,"','rb').read(),'");
	    p += 16;
	}
	else
	{
	    strcpy(p,"','exec'))");
	    p += 10;
	}
    }


    /* Execute the file */
    DoPyCommand(buffer,
	    (rangeinitializer) init_range_cmd,
	    (runner) run_cmd,
	    (void *) eap);
}

    void
ex_py3do(exarg_T *eap)
{
    if (p_pyx == 0)
	p_pyx = 3;

    DoPyCommand((char *)eap->arg,
	    (rangeinitializer)init_range_cmd,
	    (runner)run_do,
	    (void *)eap);
}

/******************************************************
 * 2. Python output stream: writes output via [e]msg().
 */

/* Implementation functions
 */

    static PyObject *
OutputGetattro(PyObject *self, PyObject *nameobj)
{
    GET_ATTR_STRING(name, nameobj);

    if (strcmp(name, "softspace") == 0)
	return PyLong_FromLong(((OutputObject *)(self))->softspace);
    else if (strcmp(name, "errors") == 0)
	return PyString_FromString("strict");
    else if (strcmp(name, "encoding") == 0)
	return PyString_FromString(ENC_OPT);

    return PyObject_GenericGetAttr(self, nameobj);
}

    static int
OutputSetattro(PyObject *self, PyObject *nameobj, PyObject *val)
{
    GET_ATTR_STRING(name, nameobj);

    return OutputSetattr((OutputObject *)(self), name, val);
}

/******************************************************
 * 3. Implementation of the Vim module for Python
 */

/* Window type - Implementation functions
 * --------------------------------------
 */

#define WindowType_Check(obj) ((obj)->ob_base.ob_type == &WindowType)

/* Buffer type - Implementation functions
 * --------------------------------------
 */

#define BufferType_Check(obj) ((obj)->ob_base.ob_type == &BufferType)

static PyObject* BufferSubscript(PyObject *self, PyObject *idx);
static Py_ssize_t BufferAsSubscript(PyObject *self, PyObject *idx, PyObject *val);

/* Line range type - Implementation functions
 * --------------------------------------
 */

#define RangeType_Check(obj) ((obj)->ob_base.ob_type == &RangeType)

static PyObject* RangeSubscript(PyObject *self, PyObject *idx);
static Py_ssize_t RangeAsItem(PyObject *, Py_ssize_t, PyObject *);
static Py_ssize_t RangeAsSubscript(PyObject *self, PyObject *idx, PyObject *val);

/* Current objects type - Implementation functions
 * -----------------------------------------------
 */

static PySequenceMethods BufferAsSeq = {
    (lenfunc)		BufferLength,	    /* sq_length,    len(x)   */
    (binaryfunc)	0,		    /* sq_concat,    x+y      */
    (ssizeargfunc)	0,		    /* sq_repeat,    x*n      */
    (ssizeargfunc)	BufferItem,	    /* sq_item,      x[i]     */
    0,					    /* was_sq_slice,	 x[i:j]   */
    0,					    /* sq_ass_item,  x[i]=v   */
    0,					    /* sq_ass_slice, x[i:j]=v */
    0,					    /* sq_contains */
    0,					    /* sq_inplace_concat */
    0,					    /* sq_inplace_repeat */
};

static PyMappingMethods BufferAsMapping = {
    /* mp_length	*/ (lenfunc)BufferLength,
    /* mp_subscript     */ (binaryfunc)BufferSubscript,
    /* mp_ass_subscript */ (objobjargproc)BufferAsSubscript,
};


/* Buffer object
 */

    static PyObject *
BufferGetattro(PyObject *self, PyObject *nameobj)
{
    PyObject *r;

    GET_ATTR_STRING(name, nameobj);

    if ((r = BufferAttrValid((BufferObject *)(self), name)))
	return r;

    if (CheckBuffer((BufferObject *)(self)))
	return NULL;

    r = BufferAttr((BufferObject *)(self), name);
    if (r || PyErr_Occurred())
	return r;
    else
	return PyObject_GenericGetAttr(self, nameobj);
}

    static int
BufferSetattro(PyObject *self, PyObject *nameobj, PyObject *val)
{
    GET_ATTR_STRING(name, nameobj);

    return BufferSetattr((BufferObject *)(self), name, val);
}

/******************/

    static PyObject *
BufferSubscript(PyObject *self, PyObject* idx)
{
    if (PyLong_Check(idx))
    {
	long _idx = PyLong_AsLong(idx);
	return BufferItem((BufferObject *)(self), _idx);
    } else if (PySlice_Check(idx))
    {
	Py_ssize_t start, stop, step, slicelen;

	if (CheckBuffer((BufferObject *) self))
	    return NULL;

	if (PySlice_GetIndicesEx((PySliceObject_T *)idx,
	      (Py_ssize_t)((BufferObject *)(self))->buf->b_ml.ml_line_count,
	      &start, &stop,
	      &step, &slicelen) < 0)
	{
	    return NULL;
	}
	return BufferSlice((BufferObject *)(self), start, stop);
    }
    else
    {
	RAISE_INVALID_INDEX_TYPE(idx);
	return NULL;
    }
}

    static Py_ssize_t
BufferAsSubscript(PyObject *self, PyObject* idx, PyObject* val)
{
    if (PyLong_Check(idx))
    {
	long n = PyLong_AsLong(idx);
	return RBAsItem((BufferObject *)(self), n, val, 1,
		    (Py_ssize_t)((BufferObject *)(self))->buf->b_ml.ml_line_count,
		    NULL);
    } else if (PySlice_Check(idx))
    {
	Py_ssize_t start, stop, step, slicelen;

	if (CheckBuffer((BufferObject *) self))
	    return -1;

	if (PySlice_GetIndicesEx((PySliceObject_T *)idx,
	      (Py_ssize_t)((BufferObject *)(self))->buf->b_ml.ml_line_count,
	      &start, &stop,
	      &step, &slicelen) < 0)
	{
	    return -1;
	}
	return RBAsSlice((BufferObject *)(self), start, stop, val, 1,
			  (PyInt)((BufferObject *)(self))->buf->b_ml.ml_line_count,
			  NULL);
    }
    else
    {
	RAISE_INVALID_INDEX_TYPE(idx);
	return -1;
    }
}

static PySequenceMethods RangeAsSeq = {
    (lenfunc)		RangeLength,	 /* sq_length,	  len(x)   */
    (binaryfunc)	0,		 /* RangeConcat, sq_concat,  x+y   */
    (ssizeargfunc)	0,		 /* RangeRepeat, sq_repeat,  x*n   */
    (ssizeargfunc)	RangeItem,	 /* sq_item,	  x[i]	   */
    0,					 /* was_sq_slice,     x[i:j]   */
    (ssizeobjargproc)	RangeAsItem,	 /* sq_as_item,  x[i]=v   */
    0,					 /* sq_ass_slice, x[i:j]=v */
    0,					 /* sq_contains */
    0,					 /* sq_inplace_concat */
    0,					 /* sq_inplace_repeat */
};

static PyMappingMethods RangeAsMapping = {
    /* mp_length	*/ (lenfunc)RangeLength,
    /* mp_subscript     */ (binaryfunc)RangeSubscript,
    /* mp_ass_subscript */ (objobjargproc)RangeAsSubscript,
};

/* Line range object - Implementation
 */

    static PyObject *
RangeGetattro(PyObject *self, PyObject *nameobj)
{
    GET_ATTR_STRING(name, nameobj);

    if (strcmp(name, "start") == 0)
	return Py_BuildValue("n", ((RangeObject *)(self))->start - 1);
    else if (strcmp(name, "end") == 0)
	return Py_BuildValue("n", ((RangeObject *)(self))->end - 1);
    else
	return PyObject_GenericGetAttr(self, nameobj);
}

/****************/

    static Py_ssize_t
RangeAsItem(PyObject *self, Py_ssize_t n, PyObject *val)
{
    return RBAsItem(((RangeObject *)(self))->buf, n, val,
		    ((RangeObject *)(self))->start,
		    ((RangeObject *)(self))->end,
		    &((RangeObject *)(self))->end);
}

    static Py_ssize_t
RangeAsSlice(PyObject *self, Py_ssize_t lo, Py_ssize_t hi, PyObject *val)
{
    return RBAsSlice(((RangeObject *)(self))->buf, lo, hi, val,
		    ((RangeObject *)(self))->start,
		    ((RangeObject *)(self))->end,
		    &((RangeObject *)(self))->end);
}

    static PyObject *
RangeSubscript(PyObject *self, PyObject* idx)
{
    if (PyLong_Check(idx))
    {
	long _idx = PyLong_AsLong(idx);
	return RangeItem((RangeObject *)(self), _idx);
    } else if (PySlice_Check(idx))
    {
	Py_ssize_t start, stop, step, slicelen;

	if (PySlice_GetIndicesEx((PySliceObject_T *)idx,
		((RangeObject *)(self))->end-((RangeObject *)(self))->start+1,
		&start, &stop,
		&step, &slicelen) < 0)
	{
	    return NULL;
	}
	return RangeSlice((RangeObject *)(self), start, stop);
    }
    else
    {
	RAISE_INVALID_INDEX_TYPE(idx);
	return NULL;
    }
}

    static Py_ssize_t
RangeAsSubscript(PyObject *self, PyObject *idx, PyObject *val)
{
    if (PyLong_Check(idx))
    {
	long n = PyLong_AsLong(idx);
	return RangeAsItem(self, n, val);
    } else if (PySlice_Check(idx))
    {
	Py_ssize_t start, stop, step, slicelen;

	if (PySlice_GetIndicesEx((PySliceObject_T *)idx,
		((RangeObject *)(self))->end-((RangeObject *)(self))->start+1,
		&start, &stop,
		&step, &slicelen) < 0)
	{
	    return -1;
	}
	return RangeAsSlice(self, start, stop, val);
    }
    else
    {
	RAISE_INVALID_INDEX_TYPE(idx);
	return -1;
    }
}

/* TabPage object - Implementation
 */

    static PyObject *
TabPageGetattro(PyObject *self, PyObject *nameobj)
{
    PyObject *r;

    GET_ATTR_STRING(name, nameobj);

    if ((r = TabPageAttrValid((TabPageObject *)(self), name)))
	return r;

    if (CheckTabPage((TabPageObject *)(self)))
	return NULL;

    r = TabPageAttr((TabPageObject *)(self), name);
    if (r || PyErr_Occurred())
	return r;
    else
	return PyObject_GenericGetAttr(self, nameobj);
}

/* Window object - Implementation
 */

    static PyObject *
WindowGetattro(PyObject *self, PyObject *nameobj)
{
    PyObject *r;

    GET_ATTR_STRING(name, nameobj);

    if ((r = WindowAttrValid((WindowObject *)(self), name)))
	return r;

    if (CheckWindow((WindowObject *)(self)))
	return NULL;

    r = WindowAttr((WindowObject *)(self), name);
    if (r || PyErr_Occurred())
	return r;
    else
	return PyObject_GenericGetAttr(self, nameobj);
}

    static int
WindowSetattro(PyObject *self, PyObject *nameobj, PyObject *val)
{
    GET_ATTR_STRING(name, nameobj);

    return WindowSetattr((WindowObject *)(self), name, val);
}

/* Tab page list object - Definitions
 */

static PySequenceMethods TabListAsSeq = {
    (lenfunc)	     TabListLength,	    /* sq_length,    len(x)   */
    (binaryfunc)     0,			    /* sq_concat,    x+y      */
    (ssizeargfunc)   0,			    /* sq_repeat,    x*n      */
    (ssizeargfunc)   TabListItem,	    /* sq_item,      x[i]     */
    0,					    /* sq_slice,     x[i:j]   */
    (ssizeobjargproc)0,			    /* sq_as_item,  x[i]=v   */
    0,					    /* sq_ass_slice, x[i:j]=v */
    0,					    /* sq_contains */
    0,					    /* sq_inplace_concat */
    0,					    /* sq_inplace_repeat */
};

/* Window list object - Definitions
 */

static PySequenceMethods WinListAsSeq = {
    (lenfunc)	     WinListLength,	    /* sq_length,    len(x)   */
    (binaryfunc)     0,			    /* sq_concat,    x+y      */
    (ssizeargfunc)   0,			    /* sq_repeat,    x*n      */
    (ssizeargfunc)   WinListItem,	    /* sq_item,      x[i]     */
    0,					    /* sq_slice,     x[i:j]   */
    (ssizeobjargproc)0,			    /* sq_as_item,  x[i]=v   */
    0,					    /* sq_ass_slice, x[i:j]=v */
    0,					    /* sq_contains */
    0,					    /* sq_inplace_concat */
    0,					    /* sq_inplace_repeat */
};

/* Current items object - Implementation
 */
    static PyObject *
CurrentGetattro(PyObject *self, PyObject *nameobj)
{
    PyObject	*r;
    GET_ATTR_STRING(name, nameobj);
    if (!(r = CurrentGetattr(self, name)))
	return PyObject_GenericGetAttr(self, nameobj);
    return r;
}

    static int
CurrentSetattro(PyObject *self, PyObject *nameobj, PyObject *value)
{
    GET_ATTR_STRING(name, nameobj);
    return CurrentSetattr(self, name, value);
}

/* Dictionary object - Definitions
 */

    static PyObject *
DictionaryGetattro(PyObject *self, PyObject *nameobj)
{
    DictionaryObject	*this = ((DictionaryObject *) (self));

    GET_ATTR_STRING(name, nameobj);

    if (strcmp(name, "locked") == 0)
	return PyLong_FromLong(this->dict->dv_lock);
    else if (strcmp(name, "scope") == 0)
	return PyLong_FromLong(this->dict->dv_scope);

    return PyObject_GenericGetAttr(self, nameobj);
}

    static int
DictionarySetattro(PyObject *self, PyObject *nameobj, PyObject *val)
{
    GET_ATTR_STRING(name, nameobj);
    return DictionarySetattr((DictionaryObject *)(self), name, val);
}

/* List object - Definitions
 */

    static PyObject *
ListGetattro(PyObject *self, PyObject *nameobj)
{
    GET_ATTR_STRING(name, nameobj);

    if (strcmp(name, "locked") == 0)
	return PyLong_FromLong(((ListObject *) (self))->list->lv_lock);

    return PyObject_GenericGetAttr(self, nameobj);
}

    static int
ListSetattro(PyObject *self, PyObject *nameobj, PyObject *val)
{
    GET_ATTR_STRING(name, nameobj);
    return ListSetattr((ListObject *)(self), name, val);
}

/* Function object - Definitions
 */

    static PyObject *
FunctionGetattro(PyObject *self, PyObject *nameobj)
{
    PyObject		*r;
    FunctionObject	*this = (FunctionObject *)(self);

    GET_ATTR_STRING(name, nameobj);

    r = FunctionAttr(this, name);
    if (r || PyErr_Occurred())
	return r;
    else
	return PyObject_GenericGetAttr(self, nameobj);
}

/* External interface
 */

    void
python3_buffer_free(buf_T *buf)
{
    if (BUF_PYTHON_REF(buf) != NULL)
    {
	BufferObject *bp = BUF_PYTHON_REF(buf);
	bp->buf = INVALID_BUFFER_VALUE;
	BUF_PYTHON_REF(buf) = NULL;
    }
}

    void
python3_window_free(win_T *win)
{
    if (WIN_PYTHON_REF(win) != NULL)
    {
	WindowObject *wp = WIN_PYTHON_REF(win);
	wp->win = INVALID_WINDOW_VALUE;
	WIN_PYTHON_REF(win) = NULL;
    }
}

    void
python3_tabpage_free(tabpage_T *tab)
{
    if (TAB_PYTHON_REF(tab) != NULL)
    {
	TabPageObject *tp = TAB_PYTHON_REF(tab);
	tp->tab = INVALID_TABPAGE_VALUE;
	TAB_PYTHON_REF(tab) = NULL;
    }
}

    static PyObject *
Py3Init_vim(void)
{
    /* The special value is removed from sys.path in Python3_Init(). */
    static wchar_t *(argv[2]) = {L"/must>not&exist/foo", NULL};

    if (init_types())
	return NULL;

    /* Set sys.argv[] to avoid a crash in warn(). */
    PySys_SetArgv(1, argv);

    if ((vim_module = PyModule_Create(&vimmodule)) == NULL)
	return NULL;

    if (populate_module(vim_module))
	return NULL;

    if (init_sys_path())
	return NULL;

    return vim_module;
}

/*************************************************************************
 * 4. Utility functions for handling the interface between Vim and Python.
 */

/* Convert a Vim line into a Python string.
 * All internal newlines are replaced by null characters.
 *
 * On errors, the Python exception data is set, and NULL is returned.
 */
    static PyObject *
LineToString(const char *str)
{
    PyObject *result;
    Py_ssize_t len = strlen(str);
    char *tmp,*p;

    tmp = (char *)alloc((unsigned)(len+1));
    p = tmp;
    if (p == NULL)
    {
	PyErr_NoMemory();
	return NULL;
    }

    while (*str)
    {
	if (*str == '\n')
	    *p = '\0';
	else
	    *p = *str;

	++p;
	++str;
    }
    *p = '\0';

    result = PyUnicode_Decode(tmp, len, (char *)ENC_OPT, CODEC_ERROR_HANDLER);

    vim_free(tmp);
    return result;
}

    void
do_py3eval (char_u *str, typval_T *rettv)
{
    DoPyCommand((char *) str,
	    (rangeinitializer) init_range_eval,
	    (runner) run_eval,
	    (void *) rettv);
    switch(rettv->v_type)
    {
	case VAR_DICT: ++rettv->vval.v_dict->dv_refcount; break;
	case VAR_LIST: ++rettv->vval.v_list->lv_refcount; break;
	case VAR_FUNC: func_ref(rettv->vval.v_string);    break;
	case VAR_PARTIAL: ++rettv->vval.v_partial->pt_refcount; break;
	case VAR_UNKNOWN:
	    rettv->v_type = VAR_NUMBER;
	    rettv->vval.v_number = 0;
	    break;
	case VAR_NUMBER:
	case VAR_STRING:
	case VAR_FLOAT:
	case VAR_SPECIAL:
	case VAR_JOB:
	case VAR_CHANNEL:
	case VAR_BLOB:
	    break;
    }
}

    int
set_ref_in_python3 (int copyID)
{
    return set_ref_in_py(copyID);
}
#endif
