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
 */

#include "vim.h"

#include "duktape.h"
#include "duk_module_node.h"

#include <string.h>

duk_ret_t vduk_msg(duk_context *ctx) {
    msg((char*)duk_to_string(ctx, -1));
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
    duk_push_int(ctx, r);
    return 1;
}

static duk_ret_t vduk_eval_file(duk_context *ctx, void *udata);

static duk_ret_t vduk_init_context(duk_context *ctx, void *udata) {
    duk_push_global_object(ctx);
    duk_push_c_lightfunc(ctx, vduk_msg, 1, 1, 0);
    duk_put_prop_string(ctx, -2, "msg");
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
    duk_pop(ctx);
    /* Initialize module system */
    duk_eval_string(ctx,
	"(function () {"
	"    function resolve(requested_id, parent_id) {"
	"	 var path = call_internal_func('eval', ['&rtp']);"
	"        var resolved_id = undefined;"
	"        do_in_path(path, requested_id, 0, "
	"             function (fname) { resolved_id = fname; });"
	"        if(resolved_id === undefined) {"
	"            var error = new Error('File not found in runtimepath: ' + requested_id);"
	"	     error.name = 'MODULE_NOT_FOUND';"
	"            throw error;"
	"        }"
	"        return resolved_id;"
	"    }"
	"    function load(resolved_id, exports, module) {"
	"        return (new TextDecoder()).decode(read_blob(resolved_id));"
	"    }" 
	"    return { resolve: resolve, load: load };"
	"})");
    duk_call(ctx, 0);
    duk_module_node_init(ctx);
    if(duk_peval_string(ctx, "require('if_duktape.js')") != 0) {
	semsg("Duktape: Failed to load high-level API: %s", duk_safe_to_string(ctx, -1));
    };
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
	semsg("Duktape error: %s", duk_safe_to_string(ctx, -1));
    } else {
	if(!duk_is_undefined(ctx, -1)) {
	    smsg("Duktape result: %s", duk_safe_to_string(ctx, -1));
	}
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
	semsg("Duktape error: %s: %s", fname, duk_safe_to_string(ctx, -1));
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
	semsg("Duktape error: dukcall(%s): %s", func, duk_safe_to_string(ctx, -1));
    }
    duk_pop(ctx);
}
