using System;
using System.Buffers;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
using System.Text;

namespace AnalyzerLib;

static class NativeHelpers
{
    public static U[] Select<T, U>(this Span<T> s, Func<T, U> f)
    {
        var r = new U[s.Length];
        for (int i = 0; i < s.Length; i++)
        {
            r[i] = f(s[i]);
        }
        return r;
    }

    public static T[] ToArray<T>(this Span<T> s)
    {
        var r = new T[s.Length];
        for (int i = 0; i < s.Length; i++)
        {
            r[i] = s[i];
        }
        return r;
    }

    public static unsafe NativeSpan<T> Alloc<T>(nuint count)
        where T: unmanaged
    {
        T* ptr = (T*)NativeMemory.Alloc(count * (nuint)Marshal.SizeOf<T>(), (nuint)Marshal.SizeOf<T>());
        return new NativeSpan<T>(ptr, count);
    }

    public static unsafe NativeSpan<T> Alloc<T>(ReadOnlySpan<T> data)
        where T: unmanaged
    {
        T* ptr = (T*)NativeMemory.Alloc((nuint)data.Length * (nuint)Marshal.SizeOf<T>(), (nuint)Marshal.SizeOf<T>());
        for (int i = 0; i < data.Length; i++)
        {
            ptr[i] = data[i];
        }
        return new NativeSpan<T>(ptr, (nuint)data.Length);
    }
}
unsafe delegate T* PtrFunc<T>() where T: unmanaged;

[StructLayout(LayoutKind.Sequential)]
public unsafe struct NativeSpan<T> where T: unmanaged
{
    public T* ptr;
    public nuint length;
    public NativeSpan(T* ptr, nuint length)
    {
        this.ptr = ptr;
        this.length = length;
    }

    public Span<T> Span => new Span<T>(ptr, (int)length);
    public Memory<T> Memory => new UnmanagedMemoryManager<T>(ptr, (int)length).Memory;

    public static implicit operator Span<T>(NativeSpan<T> s) => s.Span;
    public static implicit operator ReadOnlySpan<T>(NativeSpan<T> s) => s.Span;

    public void Dispose()
    {
        if (ptr != null)
            NativeMemory.Free(ptr);
        ptr = null;
    }
}

[StructLayout(LayoutKind.Sequential)]


unsafe ref struct Utf8String
{
    public ReadOnlySpan<byte> Span;

    public Utf8String(ReadOnlySpan<byte> span)
    {
        Span = span;
    }

    public static implicit operator Utf8String(ReadOnlySpan<byte> span) => new Utf8String(span);
    public static Utf8String FromCPtr(byte* p)
    {
        var len = 0;
        while (p[len] != 0)
            len++;
        return new Utf8String(new ReadOnlySpan<byte>(p, len));
    }

    public override string ToString()
    {
        return Encoding.UTF8.GetString(Span);
    }
}

// from https://github.com/mgravell/Pipelines.Sockets.Unofficial/blob/master/src/Pipelines.Sockets.Unofficial/UnsafeMemory.cs
// The MIT License (MIT)
// Copyright (c) 2018 Marc Gravell

/// <summary>
/// A MemoryManager over a raw pointer
/// </summary>
/// <remarks>The pointer is assumed to be fully unmanaged, or externally pinned - no attempt will be made to pin this data</remarks>
public sealed unsafe class UnmanagedMemoryManager<T> : MemoryManager<T>
	where T : unmanaged
{
    private readonly T* _pointer;
    private readonly int _length;

    /// <summary>
    /// Create a new UnmanagedMemoryManager instance at the given pointer and size
    /// </summary>
    public UnmanagedMemoryManager(T* pointer, int length)
    {
        if (length < 0) throw new ArgumentOutOfRangeException(nameof(length));
        _pointer = pointer;
        _length = length;
    }

    /// <summary>
    /// Obtains a span that represents the region
    /// </summary>
    public override Span<T> GetSpan() => new Span<T>(_pointer, _length);

    /// <summary>
    /// Provides access to a pointer that represents the data (note: no actual pin occurs)
    /// </summary>
    public override MemoryHandle Pin(int elementIndex = 0)
    {
        if (elementIndex < 0 || elementIndex >= _length)
            throw new ArgumentOutOfRangeException(nameof(elementIndex));
        return new MemoryHandle(_pointer + elementIndex);
    }
    /// <summary>
    /// Has no effect
    /// </summary>
    public override void Unpin() { }

    /// <summary>
    /// Releases all resources associated with this object
    /// </summary>
    protected override void Dispose(bool disposing) { }
}
