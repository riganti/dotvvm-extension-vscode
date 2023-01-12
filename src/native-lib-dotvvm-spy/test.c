#include<stdio.h>
#include <stdlib.h>
#include "./Library.h"

int printErrorAndExit() {
    char* error = dotvvmspy_error_get();
    if (error == NULL) {
        printf("No error message?");
    } else {
        printf(".NET Error: %s", error);
        free(error);
    }
    exit(1);
}


int main(int argc, char** argv) {

    int32_t a = 100, b = 10;
    printf("Add result: %d\n", dotvvmspy_test_add(a, b));

    if (argc <= 1)
    {
        printf("No arguments passed\n");
        return 0;
    }

    const char* assembly = argv[1];
    printf("Loading assembly: %s\n", assembly);

    const char* searchPaths[] = {};
    dotvvmspy_context_id_t cx = dotvvmspy_context_new(assembly, searchPaths, 0);
    if (cx < 0)
        printErrorAndExit();

    printf("Context id=%d created\n", cx);

    dotvvmspy_name_list* list = dotvvmspy_find_implementations(cx, "DotVVM.Framework.ViewModel.IDotvvmViewModel", 0, 1000000);
    if (list == NULL)
        printErrorAndExit();

    printf("Found %d implementations of DotVVM.Framework.ViewModels.IDotvvmViewModel", list->count);
    for (int i = 0; i < list->count; i++)
    {
        printf("%s\n", list->type_names[i]);
    }

    free(list);
    dotvvmspy_context_dispose(cx);


    return 0;
}
