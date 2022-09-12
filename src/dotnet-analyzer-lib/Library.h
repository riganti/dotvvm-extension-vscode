#include<stdint.h>

/** Smoke test method: adds numbers */
int32_t netanalyzerlib_test_add(int32_t a, int32_t b);

/** Returns a newly allocated buffer with error message describing why the last operation failed.
 * 	NULL is returned if no failure occurred.
 *  You are responsible for freeing the memory */
char* netanalyzerlib_error_get();

typedef int32_t netanalyzerlib_context_id_t;

/** Creates new context - initializes ILSpy's DecompilerTypeSystem
 * */
netanalyzerlib_context_id_t netanalyzerlib_context_new(char* mainAssembly, char** searchPaths, char pathCount);

/** Frees context and all associated data */
void netanalyzerlib_context_dispose(netanalyzerlib_context_id_t contextId);


typedef struct {
	char** type_names;
	int32_t count;
} netanalyzerlib_name_list;

/** Returns a list of all types implementing the specified interface */
netanalyzerlib_name_list* netanalyzerlib_find_implementations(
	netanalyzerlib_context_id_t contextId,
	char* interfaceName,
	uint32_t searchFlags,
	int32_t limit
);
