using System;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
using System.Text;

namespace LibDotvvmSpy;

// entry point for native code
public static unsafe class Library
{
    static readonly UTF8Encoding utf8 = new UTF8Encoding(false);
    [ThreadStatic]
    static string errorMessage;

    [UnmanagedCallersOnly(EntryPoint = "dotvvmspy_test_add")]
    public static int Add(int a, int b)
    {
        Console.WriteLine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile));
        return a + b;
    }

    [UnmanagedCallersOnly(EntryPoint = "dotvvmspy_error_get")]
    public static byte* GetError()
    {
        var bytes = utf8.GetByteCount(errorMessage);
        var buffer = NativeHelpers.Alloc<byte>((nuint)bytes + 1);
        buffer.Span[^1] = 0;
        utf8.GetBytes(errorMessage.AsSpan(), buffer.Span);
        return buffer.ptr;
    }

    [UnmanagedCallersOnly(EntryPoint = "dotvvmspy_context_new")]
    public static int NewContext(
        byte* assembly, byte** paths, int pathCount
    ) => CatchErrors(() => {
        Console.WriteLine("Creating new context");
        var cx = new AnalyzerContext(UnmarshallString(assembly), UnmarshallStrings(paths, pathCount));
        AnalyzerContext.Register(cx);
        Console.WriteLine("New context created: " + cx.Id);
        return cx.Id;
    });


    [UnmanagedCallersOnly(EntryPoint = "dotvvmspy_context_dispose")]
    public static void DisposeContext(int contextId)
    {
        AnalyzerContext.Get(contextId).Dispose();
    }

    [UnmanagedCallersOnly(EntryPoint = "dotvvmspy_find_implementations")]
    public static NameList* FindImplementations(int contextId, byte* interfaceName, uint searchFlags, int limit)
    {
        return CatchErrors<NameList>(() => {
            var cx = AnalyzerContext.Get(contextId);
            var t = DotvvmUtils.GetInterfaceImplementations(cx.TypeSystem, UnmarshallString(interfaceName), (DotvvmUtils.SymbolSearchFlags)searchFlags, limit);
            return NameList.MarshallList(t);
        });
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct NameList
    {
        public byte** TypeNames;
        public int Count;

        static public NameList* MarshallList(string[] names)
        {
            MarshallStrings(
                names,
                out var typeNames, out var buffer,
                bufferPaddingStart: sizeof(NameList)
            );

            NameList* result = (NameList*)buffer.ptr;
            result->TypeNames = (byte**)typeNames.ptr;
            result->Count = names.Length;

            return result;
        }
    }


    static string UnmarshallString(byte* ptr) => Utf8String.FromCPtr(ptr).ToString();
    static string[] UnmarshallStrings(byte** ptrs, int count)
    {
        var r = new string[count];
        for (int i = 0; i < count; i++)
            r[i] = UnmarshallString(ptrs[i]);
        return r;
    }

    /// Allocates one buffer for all strings and one array of pointers to the strings.
    /// Layout:
    //// prefix[bufferPaddingStart bytes] | string addresses[strings.Length * 8] bytes | sequence of strings[⅀ (s.Length + 1 for s ∈ strings) bytes] | suffix[bufferPaddingEnd bytes]
    static void MarshallStrings(string[] strings, out NativeSpan<UIntPtr> stringAddrs, out NativeSpan<byte> buffer, int bufferPaddingStart = 0, int bufferPaddingEnd = 0)
    {
        var size = strings.Sum(s => utf8.GetByteCount(s) + 1);
        buffer = NativeHelpers.Alloc<byte>((nuint)(size + sizeof(UIntPtr) * strings.Length + bufferPaddingStart + bufferPaddingEnd));
        var offset = bufferPaddingStart + sizeof(UIntPtr) * strings.Length;
        stringAddrs = new NativeSpan<UIntPtr>((UIntPtr*)(buffer.ptr + bufferPaddingStart), (nuint)strings.Length);
        for (int i = 0; i < strings.Length; i++)
        {
            var s = strings[i];
            var byteCount = utf8.GetBytes(s, buffer.Span.Slice(offset));
            buffer.Span[offset + byteCount] = 0;
            offset += byteCount + 1;
            stringAddrs.Span[i] = new UIntPtr(buffer.ptr + offset);
        }
    }

    static int CatchErrors(Func<int> f)
    {
        try
        {
            return f();
        }
        catch (Exception e)
        {
            errorMessage = e.ToString();
            return -1;
        }
    }

    static T* CatchErrors<T>(PtrFunc<T> f) where T: unmanaged
    {
        try
        {
            return f();
        }
        catch (Exception e)
        {
            errorMessage = e.ToString();
            return null;
        }
    }
}
