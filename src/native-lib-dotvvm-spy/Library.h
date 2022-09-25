#include<stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/** Smoke test method: adds numbers */
int32_t dotvvmspy_test_add(int32_t a, int32_t b);

/** Returns a newly allocated buffer with error message describing why the last operation failed.
 * 	NULL is returned if no failure occurred.
 *  You are responsible for freeing the memory */
char* dotvvmspy_error_get();

typedef int32_t dotvvmspy_context_id_t;

/** Creates new context - initializes ILSpy's DecompilerTypeSystem
 * */
dotvvmspy_context_id_t dotvvmspy_context_new(const char* mainAssembly, const char** searchPaths, char pathCount);

/** Frees context and all associated data */
void dotvvmspy_context_dispose(dotvvmspy_context_id_t contextId);


typedef struct {
	char** type_names;
	int32_t count;
} dotvvmspy_name_list;

/** Returns a list of all types implementing the specified interface */
dotvvmspy_name_list* dotvvmspy_find_implementations(
	dotvvmspy_context_id_t contextId,
	const char* interfaceName,
	uint32_t searchFlags,
	int32_t limit
);

#ifdef __cplusplus
}
#endif
