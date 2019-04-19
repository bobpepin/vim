/* vi:set ts=8 sts=4 sw=4 noet:
 *
 * VIM - Vi IMproved    by Bram Moolenaar
 *
 * Do ":help uganda"  in Vim to read copying and usage conditions.
 * Do ":help credits" in Vim to see a list of people who contributed.
 * See README.txt for an overview of the Vim source code.
 */
/*
 * Duktape JavaScript extension by Bob Pepin.
 *
 */

#if defined(__unix__) || (defined(__APPLE__) && defined(__MACH__))

#define FEAT_DUKTAPE_THREADS
#include <unistd.h>
#include <sys/socket.h>
#include <sys/select.h>
#include <pthread.h>

#elif defined(_WIN32)

#define FEAT_DUKTAPE_THREADS
#include <winsock2.h>
#include <windows.h>
#include <process.h>
// Need to link with Ws2_32.lib
#pragma comment (lib, "Ws2_32.lib")

#endif

#include "vim.h"
#include "duktape.h"
#include <string.h>

duk_ret_t vduk_msg(duk_context *ctx) {
    msg((char*)duk_to_string(ctx, -1));
    duk_pop(ctx);
    return 0;
}

duk_ret_t vduk_emsg(duk_context *ctx) {
    emsg((char*)duk_to_string(ctx, -1));
    duk_pop(ctx);
    return 0;
}

static duk_ret_t vduk_do_cmdline_cmd(duk_context *ctx) {
    int r = do_cmdline_cmd((char_u*)duk_to_string(ctx, -1));
    duk_pop(ctx);
    duk_push_boolean(ctx, r == OK);
    return 1;
}

static typval_T vduk_get_typval(duk_context *ctx, duk_idx_t idx) {
    typval_T tv;
    tv.v_lock = VAR_FIXED;
    if(duk_is_string(ctx, idx)) {
	tv.v_type = VAR_STRING;
	tv.vval.v_string = vim_strsave((char_u*)duk_get_string(ctx, idx));
    } else if(duk_is_number(ctx, idx)) {
	tv.v_type = VAR_NUMBER;
	tv.vval.v_number = duk_get_int(ctx, idx);
    } else {
	tv.v_type = VAR_UNKNOWN;
    }
    return tv;
}

static int vduk_push_typval(duk_context *ctx, typval_T tv) {
    switch(tv.v_type) {
    case VAR_STRING:
	duk_push_string(ctx, (const char*)tv.vval.v_string);
	return 1;
    case VAR_NUMBER:
	duk_push_int(ctx, tv.vval.v_number);
	return 1;
    default:
	duk_push_undefined(ctx);
	return 0;
    }
}

static duk_ret_t vduk_call_internal_func(duk_context *ctx) {
    char_u *name = (char_u*)duk_to_string(ctx, -2);
    int argcount = duk_get_length(ctx, -1);
    typval_T *argvars = (typval_T*)alloc((argcount+1) * sizeof(typval_T));
    for(duk_uarridx_t i=0; i < argcount; i++) {
	duk_get_prop_index(ctx, -1, i);
	argvars[i] = vduk_get_typval(ctx, -1);
	duk_pop(ctx);
    }
    duk_pop_2(ctx);
    typval_T rettv;
    rettv.v_type = VAR_NUMBER;
    call_internal_func(name, argcount, argvars, &rettv);
    duk_ret_t retcount = 0;
    switch(rettv.v_type) {
    case VAR_STRING:
	duk_push_string(ctx, (const char*)rettv.vval.v_string);
	retcount = 1;
	break;
    case VAR_NUMBER:
	duk_push_int(ctx, rettv.vval.v_number);
	retcount = 1;
	break;
    default:
	break;
    }
    for(int i=0; i < argcount; i++) {
	clear_tv(&argvars[i]);
    }
    free(argvars);
    clear_tv(&rettv);
    return retcount;
}

static duk_ret_t vduk_read_blob(duk_context *ctx) {
    stat_T st;
    const char *fname = (const char*)duk_get_string(ctx, -1);
    if(mch_stat(fname, &st) != 0) {
#ifdef HAVE_STRERROR
	return duk_generic_error(ctx, "%s: stat: %s", fname, strerror(errno));
#else
	return duk_generic_error(ctx, "%s: stat failed", fname);
#endif
    }
    duk_size_t size = st.st_size;
    FILE *fp = mch_fopen(fname, READBIN);
    if(!fp) {
#ifdef HAVE_STRERROR
	return duk_generic_error(ctx, "%s: fopen: %s", fname, strerror(errno));
#else
	return duk_generic_error(ctx, "%s: fopen failed", fname);
#endif
    }
    duk_pop(ctx);
    void *buf = duk_push_fixed_buffer(ctx, size);
    fread(buf, 1, size, fp);
    fclose(fp);
    return 1;
}

static duk_ret_t vduk_compile(duk_context *ctx) {
    duk_uint_t flags = 0;
    duk_get_prop_string(ctx, 2, "eval");
    if(duk_to_boolean(ctx, -1)) {
	flags |= DUK_COMPILE_EVAL;
    }
    duk_pop(ctx);
    duk_get_prop_string(ctx, 2, "function");
    if(duk_to_boolean(ctx, -1)) {
	flags |= DUK_COMPILE_FUNCTION;
    }
    duk_pop(ctx);
    duk_get_prop_string(ctx, 2, "strict");
    if(duk_to_boolean(ctx, -1)) {
	flags |= DUK_COMPILE_STRICT;
    }
    duk_pop(ctx);
    duk_get_prop_string(ctx, 2, "shebang");
    if(duk_to_boolean(ctx, -1)) {
	flags |= DUK_COMPILE_SHEBANG;
    }
    duk_pop(ctx);
    duk_pop(ctx);
    duk_compile(ctx, flags);
    return 1;
}

static void vduk_do_in_path_cb(char_u *fname, void *udata) {
    duk_context *ctx = (duk_context*)udata;
    duk_push_string(ctx, (const char*)fname);
    duk_call(ctx, 1);
    duk_pop(ctx);
}

static duk_ret_t vduk_do_in_path(duk_context *ctx) {
    char_u *path = (char_u*)duk_get_string(ctx, 0);
    char_u *name = (char_u*)duk_get_string(ctx, 1);
    int flags = duk_get_int(ctx, 2);
    int r = do_in_path(path, name, flags, &vduk_do_in_path_cb, (void*)ctx);
    duk_push_boolean(ctx, r == OK);
    return 1;
}

static duk_ret_t vduk_screen_puts(duk_context *ctx) {
    duk_size_t textlen = -1;
    char_u *text = (char_u*)duk_get_lstring(ctx, 0, &textlen);
    int row = duk_get_int(ctx, 1);
    int col = duk_get_int(ctx, 2);
    int attr = duk_get_int(ctx, 3);
    screen_puts_len(text, textlen, row, col, attr);
    return 0;
}

static duk_ret_t vduk_vim_c_global(duk_context *ctx) {
    const char *name = duk_get_string(ctx, 0);
    if(!strcmp(name, "cmdline_row")) {
	duk_push_int(ctx, cmdline_row);
    } else if(!strcmp(name, "Rows")) {
	duk_push_int(ctx, Rows);
    } else if(!strcmp(name, "Columns")) {
	duk_push_int(ctx, Columns);
    } else {
	return duk_error(ctx, DUK_ERR_TYPE_ERROR, "Not implemented: %s", name);
    }	
    return 1;
}

static duk_ret_t vduk_print_error(duk_context *ctx, void *udata) {
    duk_eval_string(ctx,
	    "(function (e) {"
	    "	var lines = e.stack.split('\\n');"
	    "	for(var i=0; i < lines.length; i++) {"
	    "	    emsg(lines[i]);"
	    "	}"
	    "})");
    duk_dup(ctx, -2);
    duk_call(ctx, 1);
    duk_pop(ctx);
    return 1;
}

static void vduk_error_msg(duk_context *ctx) {
    if(duk_safe_call(ctx, vduk_print_error, NULL, 1, 1) != 0) {
	semsg("Duktape: Error in error handler: %s", duk_safe_to_string(ctx, -1));
    }
}
static duk_ret_t vduk_eval_file(duk_context *ctx, void *udata);
#ifdef FEAT_DUKTAPE_THREADS
static duk_ret_t vduk_create_thread(duk_context *parent_ctx);
#endif
static duk_ret_t vduk_init_runtime(duk_context *ctx);

static duk_ret_t vduk_init_context(duk_context *ctx, void *udata) {
    duk_push_global_object(ctx);
    duk_push_c_lightfunc(ctx, vduk_msg, 1, 1, 0);
    duk_put_prop_string(ctx, -2, "msg");
    duk_push_c_lightfunc(ctx, vduk_emsg, 1, 1, 0);
    duk_put_prop_string(ctx, -2, "emsg");
    duk_push_c_lightfunc(ctx, vduk_do_cmdline_cmd, 1, 1, 0);
    duk_put_prop_string(ctx, -2, "do_cmdline_cmd");
    duk_push_c_lightfunc(ctx, vduk_call_internal_func, 2, 2, 0);
    duk_put_prop_string(ctx, -2, "call_internal_func");
    duk_push_c_lightfunc(ctx, vduk_read_blob, 1, 1, 0);
    duk_put_prop_string(ctx, -2, "read_blob");
    duk_push_c_lightfunc(ctx, vduk_compile, 3, 3, 0);
    duk_put_prop_string(ctx, -2, "compile");
    duk_push_c_lightfunc(ctx, vduk_do_in_path, 4, 4, 0);
    duk_put_prop_string(ctx, -2, "do_in_path");
    duk_push_c_lightfunc(ctx, vduk_screen_puts, 4, 4, 0);
    duk_put_prop_string(ctx, -2, "screen_puts");
    duk_push_c_lightfunc(ctx, vduk_vim_c_global, 1, 1, 0);
    duk_put_prop_string(ctx, -2, "vim_c_global");
#ifdef FEAT_DUKTAPE_THREADS
    duk_push_c_lightfunc(ctx, vduk_create_thread, 1, 1, 0);
    duk_put_prop_string(ctx, -2, "create_thread");
#endif
    duk_pop(ctx);

    return vduk_init_runtime(ctx);
}

static duk_ret_t vduk_init_runtime(duk_context *ctx) {
    duk_ret_t r = duk_peval_string(ctx,
	    "(function () {"
	    "    var path = call_internal_func('eval', ['&rtp']);"
	    "    return do_in_path(path, 'if_duktape.js', 0, function (fname) {"
	    "        var src = (new TextDecoder()).decode(read_blob(fname));"
	    "        var fun = compile(src, fname, {});"
	    "        fun();"
	    "    });"
	    "})()");
    if(r != 0) {
	semsg("Duktape: Error while loading high-level API");
	vduk_error_msg(ctx);
    } else {
	int did_one = duk_get_boolean(ctx, -1);
	if(!did_one) {
	    semsg("Duktape: Warning: if_duktape.js not found in runtimepath, high-level API not loaded");
	}
    }
    duk_pop(ctx);
    return 0;
}

static duk_context *vduk_get_context() {
    static duk_context *ctx = NULL;
    if(ctx) {
	return ctx;
    }
    ctx = duk_create_heap_default();
    if (duk_safe_call(ctx, vduk_init_context, NULL, 0, 1) != 0) {
	semsg("Duktape init error: %s", duk_safe_to_string(ctx, -1));
	duk_destroy_heap(ctx);
	ctx = NULL;
	return NULL;
    }
    duk_pop(ctx);
    return ctx;
}

/*
 * ":duktape"
 */

void
ex_duktape(exarg_T *eap)
{
    char_u *script;

    script = script_get(eap, eap->arg);
    duk_context *ctx = vduk_get_context();
    if(!ctx) {
	return;
    }
    char *evalstr = script == NULL ? (char *) eap->arg : (char *) script;
    if (duk_peval_string(ctx, evalstr) != 0) {
	vduk_error_msg(ctx);
	// semsg("Duktape error: %s", duk_safe_to_string(ctx, -1));
    } else {
	smsg("%s", duk_safe_to_string(ctx, -1));
    }
    duk_pop(ctx);
    vim_free(script);
}
/*
 * ":dukfile"
 */

static duk_ret_t vduk_eval_file(duk_context *ctx, void *udata)
{
    const char *fname = (const char*)udata;
    duk_push_string(ctx, fname);
    vduk_read_blob(ctx);
    duk_eval_string(ctx, "new TextDecoder()");
    duk_get_prop_string(ctx, -1, "decode");
    duk_swap_top(ctx, -3); /* s: [func] [this] [arg] */
    duk_call_method(ctx, 1);
    duk_push_string(ctx, fname);
    duk_compile(ctx, 0);
    duk_call(ctx, 0);
    return 1;
}

void ex_dukfile(exarg_T *eap)
{
    duk_context *ctx = vduk_get_context();
    if(!ctx) {
	return;
    }
    const char *fname = (const char *) eap->arg;
    if (duk_safe_call(ctx, vduk_eval_file, (void*)fname, 0, 1) != 0) {
	vduk_error_msg(ctx);
	// semsg("Duktape error: %s: %s", fname, duk_safe_to_string(ctx, -1));
    } else {
	smsg("%s", duk_safe_to_string(ctx, -1));
    }
    duk_pop(ctx);
}

typedef struct {
  const char_u *func;
  list_T *args;
  typval_T *rettv;
} dukcall_args;

static duk_ret_t vduk_dukcall(duk_context *ctx, void *udata)
{
    dukcall_args *dc_args = (dukcall_args*)udata;
    const char *func = (const char*)dc_args->func;
    list_T *args = dc_args->args;
    typval_T *rettv = dc_args->rettv;
    duk_push_global_object(ctx);
    duk_get_prop_string(ctx, -1, func);
    for(listitem_T *li = args->lv_first; li != NULL; li = li->li_next) {
	vduk_push_typval(ctx, li->li_tv);
    }
    duk_call(ctx, args->lv_len);
    *rettv = vduk_get_typval(ctx, -1);
    return 1;
}

void evalfunc_dukcall(const char_u *func, typval_T arglist, typval_T *rettv) {
    duk_context *ctx = vduk_get_context();
    if(!ctx) {
	return;
    }
    if (arglist.v_type != VAR_LIST) {
	emsg(_(e_listreq));
	return;
    }
    dukcall_args dc_args = { func, arglist.vval.v_list, rettv };
    if (duk_safe_call(ctx, vduk_dukcall, (void*)&dc_args, 0, 1) != 0) {
	semsg("Duktape error in dukcall(%s):", func);
	vduk_error_msg(ctx);
    }
    duk_pop(ctx);
}

#ifdef FEAT_DUKTAPE_THREADS
/* Duktape threads */

#if defined(_POSIX_VERSION)
#define INVALID_SOCKET -1
static duk_ret_t vduk_socket_error(duk_context *ctx, const unsigned char* msg) {
    return duk_generic_error(ctx, "%s: %s", msg, strerror(errno));
}

#elif defined(_WIN32)
static duk_ret_t vduk_socket_error(duk_context *ctx, const unsigned char* msg) {
    return duk_generic_error(ctx, "%s: %d", msg, WSAGetLastError());
}
#endif

static duk_ret_t vduk_listen(duk_context *ctx) {
    int sock = socket(AF_INET, SOCK_STREAM, 0);
    if(sock == INVALID_SOCKET)
	return vduk_socket_error(ctx, "socket()");
    struct sockaddr_in sin;
    sin.sin_family = AF_INET;
    sin.sin_addr.s_addr = htonl(duk_get_int(ctx, 0));
    sin.sin_port = htons(duk_get_int(ctx, 1));
    if(bind(sock, (struct sockaddr*)&sin, sizeof(sin)) == -1)
	return vduk_socket_error(ctx, "bind()");
    if(listen(sock, 0) == -1)
	return vduk_socket_error(ctx, "listen()");
    duk_push_int(ctx, sock);
    return 1;
}

static duk_ret_t vduk_accept(duk_context *ctx) {
    unsigned int sock = duk_require_uint(ctx, 0);
    struct sockaddr_in sin;
    size_t sin_len = sizeof(sin);
    int fd = accept(sock, (struct sockaddr*)&sin, &sin_len);
    if(fd == INVALID_SOCKET)
	return vduk_socket_error(ctx, "accept()");
    duk_push_int(ctx, fd);
    return 1;
}

static duk_ret_t vduk_close(duk_context *ctx) {
    unsigned int sock = duk_require_uint(ctx, 0);
#ifdef _WIN32
    int r = closesocket(sock);
#else
    int r = close(sock);
#endif
    if(r == -1)
	return duk_generic_error(ctx, "close(): %s", strerror(errno));
    return 0;
}

static duk_ret_t vduk_read(duk_context *ctx) {
    unsigned int sock = duk_require_uint(ctx, 0);
    duk_size_t buf_size;
    void *buf = duk_require_buffer_data(ctx, 1, &buf_size);
    int n = recv(sock, buf, buf_size, 0);
    if(n == -1)
	return duk_generic_error(ctx, "read(): %s", strerror(errno));
    duk_push_int(ctx, n);
    return 1;
}

static duk_ret_t vduk_write(duk_context *ctx) {
    unsigned int sock = duk_require_uint(ctx, 0);
    duk_size_t buf_size;
    void *buf = duk_require_buffer_data(ctx, 1, &buf_size);
    int n = send(sock, buf, buf_size, 0);
    if(n == -1)
	return duk_generic_error(ctx, "write(): %s", strerror(errno));
    duk_push_int(ctx, n);
    return 1;
}

static int vduk_get_fdset(duk_context *ctx, duk_idx_t idx, fd_set *fds) {
    FD_ZERO(fds);
    int maxfd = -1;
    duk_size_t N = duk_get_length(ctx, idx);
    for(duk_uarridx_t i=0; i < N; i++) {
	duk_get_prop_index(ctx, idx, i);
	int fd = duk_require_uint(ctx, -1);
	duk_pop(ctx);
	FD_SET(fd, fds);
	if(fd > maxfd)
	    maxfd = fd;
    }
    return maxfd;
}

static duk_idx_t vduk_push_fdset(duk_context *ctx, fd_set *fds, int maxfd) {
    duk_idx_t arr_idx = duk_push_array(ctx);
    int i = 0;
    for(int fd=0; fd <= maxfd; fd++) {
	if(FD_ISSET(fd, fds)) {
	    duk_push_int(ctx, fd);
	    duk_put_prop_index(ctx, arr_idx, i++);
	}
    }
    return arr_idx;
}

static duk_ret_t vduk_select(duk_context *ctx) {
    fd_set readfds, writefds, exceptfds;
    int readmax = vduk_get_fdset(ctx, 0, &readfds);
    int writemax = vduk_get_fdset(ctx, 1, &writefds);
    int exceptmax = vduk_get_fdset(ctx, 2, &exceptfds);
    int maxfd = readmax;
    if(writemax > maxfd)
	maxfd = writemax;
    if(exceptmax > maxfd)
	maxfd = exceptmax;
    int nfds = maxfd + 1;
    struct timeval tv;
    struct timeval *tv_ptr = NULL;
    if(duk_is_object(ctx, 3)) {
	duk_get_prop_string(ctx, 3, "sec");
	tv.tv_sec = duk_opt_int(ctx, -1, 0);
	duk_pop(ctx);
	duk_get_prop_string(ctx, 3, "usec");
	tv.tv_usec = duk_opt_int(ctx, -1, 0);
	duk_pop(ctx);
	tv_ptr = &tv;
    }
    int r = select(nfds, &readfds, &writefds, &exceptfds, tv_ptr);
    if(r == -1)
	return duk_generic_error(ctx, "select(): %s", strerror(errno));
    duk_uarridx_t i = 0;
    duk_idx_t ret_arr = duk_push_array(ctx);
    duk_push_int(ctx, r);
    duk_put_prop_index(ctx, ret_arr, i++);
    vduk_push_fdset(ctx, &readfds, readmax);
    duk_put_prop_index(ctx, ret_arr, i++);
    vduk_push_fdset(ctx, &writefds, writemax);
    duk_put_prop_index(ctx, ret_arr, i++);
    vduk_push_fdset(ctx, &exceptfds, exceptmax);
    duk_put_prop_index(ctx, ret_arr, i++);
    return 1;
}


static duk_ret_t vduk_init_thread_context(duk_context *ctx, void *udata) {
    duk_push_global_object(ctx);
    duk_push_c_lightfunc(ctx, vduk_emsg, 1, 1, 0);
    duk_put_prop_string(ctx, -2, "emsg");
    duk_push_c_lightfunc(ctx, vduk_read_blob, 1, 1, 0);
    duk_put_prop_string(ctx, -2, "read_blob");
    duk_push_c_lightfunc(ctx, vduk_compile, 3, 3, 0);
    duk_put_prop_string(ctx, -2, "compile");
    duk_push_c_lightfunc(ctx, vduk_listen, 2, 2, 1);
    duk_put_prop_string(ctx, -2, "listen");
    duk_push_c_lightfunc(ctx, vduk_accept, 1, 1, 1);
    duk_put_prop_string(ctx, -2, "accept");
    duk_push_c_lightfunc(ctx, vduk_select, 4, 4, 1);
    duk_put_prop_string(ctx, -2, "select");
    duk_push_c_lightfunc(ctx, vduk_read, 2, 2, 1);
    duk_put_prop_string(ctx, -2, "read");
    duk_push_c_lightfunc(ctx, vduk_write, 2, 2, 1);
    duk_put_prop_string(ctx, -2, "write");
    duk_push_c_lightfunc(ctx, vduk_close, 1, 1, 0);
    duk_put_prop_string(ctx, -2, "close");

    duk_push_c_lightfunc(ctx, vduk_call_internal_func, 2, 2, 0);
    duk_put_prop_string(ctx, -2, "call_internal_func");
    duk_push_c_lightfunc(ctx, vduk_do_in_path, 4, 4, 0);
    duk_put_prop_string(ctx, -2, "do_in_path");
    vduk_init_runtime(ctx);
    vduk_eval_file(ctx, (void *)"vimts.js");
    duk_del_prop_string(ctx, -1, "do_in_path"); /* Not thread-safe */
    duk_del_prop_string(ctx, -1, "call_internal_func"); /* Not thread-safe */

    duk_pop(ctx);
    return 0;
}

#ifdef _WIN32
unsigned __stdcall vduk_thread_main(void *udata) {
#else
static void *vduk_thread_main(void *udata) {
#endif
    duk_context *ctx = (duk_context*)udata;
    if(duk_pcall(ctx, 0) != 0) {
	vduk_error_msg(ctx);
    };
    duk_destroy_heap(ctx);
    return NULL;
}

static duk_ret_t vduk_create_thread(duk_context *parent_ctx) {
    duk_size_t src_len;
    const char *src = duk_get_lstring(parent_ctx, -1, &src_len);
    duk_context *ctx = duk_create_heap_default();
    if (duk_safe_call(ctx, vduk_init_thread_context, NULL, 0, 1) != 0) {
	/* duk_destroy_heap(ctx); */ /* TODO: Do the sprintf before destroying the heap */
	return duk_generic_error(parent_ctx, "init thread context: %s", duk_safe_to_string(ctx, -1));
    }
    if(duk_pcompile_lstring(ctx, 0, src, src_len) != 0) {
	/* duk_destroy_heap(ctx); */ /* TODO: Do the sprintf before destroying the heap */
	return duk_generic_error(parent_ctx, "compile thread program: %s", duk_safe_to_string(ctx, -1));
    }
#ifdef _POSIX_VERSION
    pthread_t thread;
    int r = pthread_create(&thread, NULL, &vduk_thread_main, (void*)ctx);
    if(r != 0) {
	duk_destroy_heap(ctx);
	return duk_generic_error(parent_ctx, "pthread_create failed: %d", r);
    }
#elif defined(_WIN32)
    HANDLE thread;
    thread = (HANDLE)_beginthreadex(NULL, 0, &vduk_thread_main, (void*)ctx, 0, NULL);
    if(thread == 0) {
	duk_destroy_heap(ctx);
	return duk_generic_error(parent_ctx, "_beginthreadex failed: %s", strerror(errno));
    }
#endif
    return 0;
}
#endif
