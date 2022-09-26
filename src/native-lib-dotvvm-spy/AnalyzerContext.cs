using System;
using System.Reflection.Metadata;
using System.Reflection.PortableExecutable;
using System.Runtime.InteropServices;
using System.Threading;
using ICSharpCode.Decompiler.Metadata;
using ICSharpCode.Decompiler.TypeSystem;
using ICSharpCode.Decompiler.TypeSystem.Implementation;

namespace LibDotvvmSpy;

public class AnalyzerContext
{
    static readonly AnalyzerContext[] states = new AnalyzerContext[4];
    public static void Register(AnalyzerContext s)
    {
        var freeindex = Array.IndexOf(states, null);
        if (freeindex < 0)
        {
            throw new Exception($"Too many contexts, you have {states.Length} contexts active. Forgot to call dispose?");
        }
        s.Id = freeindex;

        if (Interlocked.CompareExchange(ref states[freeindex], s, null) != null)
        {
            s.Id = -1;
            Register(s);
        }
    }
    public static AnalyzerContext Get(int id)
    {
        if (id < 0 || id >= states.Length)
        {
            throw new Exception($"Invalid context id {id}");
        }
        return states[id] ?? throw new Exception($"Context {id} has already been disposed");
    }

    public int Id { get; private set; } = -1;

    public AnalyzerContext(string mainAssembly, string[] searchDirectories)
    {
        var main = new PEFile(mainAssembly, StreamOptions);
        var frameworkVersion = main.DetectTargetFrameworkId();
        var resolver = new UniversalAssemblyResolver(main.FileName, false, frameworkVersion, streamOptions: StreamOptions);
        foreach (var sd in searchDirectories)
            resolver.AddSearchDirectory(sd);

        TypeSystem = new DecompilerTypeSystem(main, resolver);
    }

    public void FindType(string name)
    {
        var t = this.TypeSystem.FindType(new FullTypeName(name));
        var handle = GCHandle.Alloc(t, GCHandleType.Pinned);
        handle.AddrOfPinnedObject();
        var d = t.GetDefinition();
    }

    public readonly DecompilerTypeSystem TypeSystem;

    public void Dispose()
    {
        if (TypeSystem == null)
            return;
        TypeSystem.MainModule?.PEFile?.Dispose();
        foreach (var m in TypeSystem.Modules)
            m.PEFile?.Dispose();
        if (Id >= 0)
        {
            states[Id] = null;
        }
    }

    static AnalyzerContext()
    {
        // disable locking on Linux/Darwin to avoid blocking MSBuild
        AppContext.SetSwitch("System.IO.DisableFileLocking", true);
    }
    // prefetch entire files on Windows to avoid locking
    // on Linux/Darwin, we disable locking, so we can leave it on disk and avoid spending memory
    private PEStreamOptions StreamOptions =>
        System.Runtime.InteropServices.RuntimeInformation.IsOSPlatform(OSPlatform.Windows)
            ? PEStreamOptions.PrefetchEntireImage
            : PEStreamOptions.Default;

}
