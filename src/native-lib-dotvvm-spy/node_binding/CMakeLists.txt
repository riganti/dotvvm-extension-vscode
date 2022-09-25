cmake_minimum_required(VERSION 3.9)
# set(CMAKE_VERBOSE_MAKEFILE ON CACHE BOOL "ON")

project(dotnet-analyzer-lib-node)

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

# link libDotvvmSpy.so
set_target_properties(${PROJECT_NAME} PROPERTIES
        BUILD_WITH_INSTALL_RPATH FALSE
        LINK_FLAGS "-Wl,-rpath,\\\$ORIGIN")
target_link_libraries(${PROJECT_NAME} ${CMAKE_SOURCE_DIR}/../bin/libDotvvmSpy.so)
configure_file(${CMAKE_SOURCE_DIR}/../bin/libDotvvmSpy.so ${CMAKE_BINARY_DIR}/Release/libDotvvmSpy.so COPYONLY)

# include node-api header files
add_definitions(-DNAPI_VERSION=3)
target_include_directories(${PROJECT_NAME} PRIVATE "node_modules/node-addon-api")

# target_compile_options(${PROJECT_NAME} PRIVATE -fsanitize=address)
# target_link_options(${PROJECT_NAME} PRIVATE -fsanitize=address -fno-omit-frame-pointer)

# magic from https://github.com/cmake-js/cmake-js#node-api-and-node-addon-api
if(MSVC AND CMAKE_JS_NODELIB_DEF AND CMAKE_JS_NODELIB_TARGET)
  # Generate node.lib
  execute_process(COMMAND ${CMAKE_AR} /def:${CMAKE_JS_NODELIB_DEF} /out:${CMAKE_JS_NODELIB_TARGET} ${CMAKE_STATIC_LINKER_FLAGS})
endif()

