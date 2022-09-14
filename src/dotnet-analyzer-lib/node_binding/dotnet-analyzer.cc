#include <napi.h>
#include "../Library.h"

using namespace std;

static void ThrowAnalyzerError(Napi::Env env) {
  char* error = netanalyzerlib_error_get();
  printf("Error: %s\n", error);
  string errorStr = error;
  free(error);
  throw Napi::Error::New(env, errorStr);
}

static void NewAnalyzerContext(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (!info.IsConstructCall())
    throw Napi::Error::New(env, "Must be constructor call");

  if (info.Length() != 2)
    throw Napi::Error::New(env, "Must have 2 arguments");


  printf("preparing netanalyzerlib_analyzer_new\n");

  
  string mainFile = info[0].As<Napi::String>();
  Napi::Array searchPathJs = info[1].As<Napi::Array>();
  vector<string> searchPath;
  vector<const char*> searchPathCStrs;
  for (int i = 0; i < searchPathJs.Length(); i++) {
    string path = searchPathJs.Get(i).As<Napi::String>();
    searchPath.push_back(path);
    searchPathCStrs.push_back(searchPath[searchPath.size() - 1].c_str());
  }

  printf("calling netanalyzerlib_analyzer_new('%s', ...)\n", mainFile.c_str());
  for (int i = 0; i < searchPathCStrs.size(); i++) {
    printf("  '%s'\n", searchPathCStrs[i]);
  }

  auto cx = netanalyzerlib_context_new(mainFile.c_str(), searchPathCStrs.data(), searchPathCStrs.size());
  if (cx < 0) {
    ThrowAnalyzerError(env);
  }

  auto self = info.This().As<Napi::Object>();
  self.Set("contextId", Napi::Number::New(env, cx));
}

static void DisposeAnalyzerContext(const Napi::CallbackInfo& info) {
  auto self = info.This().As<Napi::Object>();
  auto cx = self.Get("contextId").As<Napi::Number>().Int32Value();
  netanalyzerlib_context_dispose(cx);
}

static Napi::Value FindImplementations(const Napi::CallbackInfo& info) {
  auto self = info.This().As<Napi::Object>();
  auto env = info.Env();
  netanalyzerlib_context_id_t cx = self.Get("contextId").As<Napi::Number>().Int32Value();

  string interface = info[0].As<Napi::String>();
  uint32_t flags = info[1].As<Napi::Number>().Uint32Value();
  int32_t limit = info[2].As<Napi::Number>().Int32Value();



  auto result = netanalyzerlib_find_implementations(cx, interface.c_str(), flags, limit);
  if (result == NULL)
    ThrowAnalyzerError(info.Env());

  auto list = Napi::Array::New(env);
  for (int i = 0; i < result->count; i++) {
    list.Set(i, Napi::String::New(env, result->type_names[i]));
  }

  free(result);
  return list;
}

static Napi::Object Init(Napi::Env env, Napi::Object exports) {
  auto fn = Napi::Function::New(env, NewAnalyzerContext);
  auto prototype = fn.Get("prototype").As<Napi::Object>();
  prototype.Set("dispose", Napi::Function::New(env, DisposeAnalyzerContext));
  prototype.Set("findImplementations", Napi::Function::New(env, FindImplementations));
  exports.Set("AnalyzerContext", fn);
  return exports;
}

NODE_API_MODULE(hello, Init)
