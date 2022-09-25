cmake_minimum_required(VERSION 3.9)
set(CMAKE_VERBOSE_MAKEFILE ON CACHE BOOL "ON")

project(dotnet-analyzer-lib-node)

# set (CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -fsanitize=address -fno-omit-frame-pointer")
# set (CMAKE_STATIC_LINKER_FLAGS "${CMAKE_STATIC_LINKER_FLAGS} -fsanitize=address")
# set (CMAKE_SHARED_LINKER_FLAGS "${CMAKE_SHARED_LINKER_FLAGS} -fsanitize=address")
# set (CMAKE_MODULE_LINKER_FLAGS "${CMAKE_MODULE_LINKER_FLAGS} -fsanitize=address")
# set (CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} -fsanitize=address")

# Build a shared library named after the project from the .cc files
file(GLOB SOURCE_FILES "*.cc" "*.h")
add_library(${PROJECT_NAME} SHARED ${SOURCE_FILES} ${CMAKE_JS_SRC})

set(CMAKE_CXX_STANDARD 17)

# Gives our library file a .node extension without any "lib" prefix
set_target_properties(${PROJECT_NAME} PROPERTIES PREFIX "" SUFFIX ".node")

# Essential include files to build a node addon,
# You should add this line in every CMake.js based project
target_include_directories(${PROJECT_NAME} PRIVATE ${CMAKE_JS_INC})

target_compile_options(${PROJECT_NAME} PRIVATE -Wall) # -Wextra -Wpedantic -Werror)

# static linking attempt
# set_target_properties(${PROJECT_NAME} PROPERTIES LINK_SEARCH_START_STATIC 1)
# set_target_properties(${PROJECT_NAME} PROPERTIES LINK_SEARCH_END_STATIC 1)
# set(CMAKE_FIND_LIBRARY_SUFFIXES ".a")

set(ILCOMPILER $ENV{HOME}/.nuget/packages/runtime.linux-x64.microsoft.dotnet.ilcompiler/7.0.0-preview.7.22375.6)

# add_library(hello_library STATIC src/Hello.cpp)
# add_library(testlib STATIC IMPORTED)
# set_target_properties(testlib PROPERTIES IMPORTED_LOCATION ${CMAKE_SOURCE_DIR}/../bin/AnalyzerLib.a )

  # PRIVATE ${CMAKE_SOURCE_DIR}/../bin/AnalyzerLib.a
# target_link_libraries(${PROJECT_NAME} ${CMAKE_JS_LIB}
#   ${CMAKE_SOURCE_DIR}/../bin/AnalyzerLib.a
#   ${ILCOMPILER}/sdk/libbootstrapperdll.a
#   ${ILCOMPILER}/sdk/libRuntime.WorkstationGC.a
#   ${ILCOMPILER}/framework/libSystem.Native.a
#   ${ILCOMPILER}/framework/libSystem.Globalization.Native.a
#   ${ILCOMPILER}/framework/libSystem.IO.Compression.Native.a
#   ${ILCOMPILER}/framework/libSystem.Net.Security.Native.a
#   ${ILCOMPILER}/framework/libSystem.Security.Cryptography.Native.OpenSsl.a)

# set(CMAKE_EXE_LINKER_FLAGS "--require-defined NativeAOT_StaticInitialization")

# dynamic linking attempt

# set(CMAKE_EXE_LINKER_FLAGS "-rpath hovno\\\$ORIGIN")
# add_library(analyzerlib SHARED IMPORTED)
# set_property(TARGET analyzerlib PROPERTY IMPORTED_LOCATION ${CMAKE_SOURCE_DIR}/../bin/AnalyzerLib.so)
set_target_properties(${PROJECT_NAME} PROPERTIES
        BUILD_WITH_INSTALL_RPATH FALSE
        LINK_FLAGS "-Wl,-rpath,\\\$ORIGIN")
# set_target_properties(${PROJECT_NAME} PROPERTIES LINK_FLAGS "-Wl,-rpath,hovno")

target_link_libraries(${PROJECT_NAME} ${CMAKE_SOURCE_DIR}/../bin/libAnalyzerLib.so)

add_definitions(-DNAPI_VERSION=3)

target_include_directories(${PROJECT_NAME} PRIVATE "node_modules/node-addon-api")
# target_compile_options(${PROJECT_NAME} PRIVATE -fsanitize=address)
# target_link_options(${PROJECT_NAME} PRIVATE -fsanitize=address -fno-omit-frame-pointer)

configure_file(${CMAKE_SOURCE_DIR}/../bin/libAnalyzerLib.so ${CMAKE_BINARY_DIR}/Release/libAnalyzerLib.so COPYONLY)

# magic from https://github.com/cmake-js/cmake-js#node-api-and-node-addon-api
if(MSVC AND CMAKE_JS_NODELIB_DEF AND CMAKE_JS_NODELIB_TARGET)
  # Generate node.lib
  execute_process(COMMAND ${CMAKE_AR} /def:${CMAKE_JS_NODELIB_DEF} /out:${CMAKE_JS_NODELIB_TARGET} ${CMAKE_STATIC_LINKER_FLAGS})
endif()

