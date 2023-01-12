using System.Diagnostics;
using System.Linq;
using System.Numerics;
using System.Runtime.CompilerServices;
using System.Threading;

namespace LibDotvvmSpy;

static class ObjHandle
{
    static object[] objects = new object[128];
    static ulong[] freeList = Enumerable.Repeat(~0UL, 128 / 64).ToArray();
    static int lastUsed = 0;

    static object locker = new object();

    [MethodImpl(MethodImplOptions.AggressiveInlining)]
    static int FindFree()
    {
        Debug.Assert(Monitor.IsEntered(locker));
        var startIndex = lastUsed;

        if (freeList[startIndex] != 0)
        {
            return BitOperations.LeadingZeroCount(freeList[startIndex]) + (startIndex * 64);
        }
        return FindFreeSlowPath(startIndex);
    }

    [MethodImpl(MethodImplOptions.NoInlining)]
    private static int FindFreeSlowPath(int startIndex)

    {
        var list = freeList;
        Debug.Assert((list.Length & list.Length - 1) == 0); // is power of 2
        int i = startIndex;
        do {
            i = (i + 1) & (list.Length - 1);
            var free = list[i];
            if (free != 0)
            {
                lastUsed = i;
                return BitOperations.LeadingZeroCount(free) + (i * 64);
            }
        } while (i != startIndex);

        IncreaseSize();
        return FindFreeSlowPath(list.Length);
    }

    static void IncreaseSize()
    {
        Debug.Assert(Monitor.IsEntered(locker));
        var newObjects = new object[objects.Length * 2];
        objects.CopyTo(newObjects, 0);
        var newFreeList = new ulong[newObjects.Length / 64];
        freeList.CopyTo(newFreeList, 0);
        objects = newObjects;
        freeList = newFreeList;
    }

    [MethodImpl(MethodImplOptions.AggressiveInlining)]
    static void MarkUsed(int index, bool used)
    {
        Debug.Assert(Monitor.IsEntered(locker));
        ref ulong free = ref freeList[index / 64];
        var mask = 1UL << (index % 64);
        if (used)
        {
            free &= ~mask;
        }
        else
        {
            free |= mask;
        }
    }

    public static int Register(object obj)
    {
        lock (locker)
        {
            var index = FindFree();
            MarkUsed(index, true);
            objects[index] = obj;
            return index;
        }
    }
    public static void Unregister(int index)
    {
        lock (locker)
        {
            MarkUsed(index, false);
            objects[index] = null;
        }
    }
    static int BoolToInt(bool b)
    {
        return Unsafe.As<bool, byte>(ref b);
    }
}
