using ICSharpCode.Decompiler.TypeSystem;
using System;
using System.Linq;

static class DotvvmUtils
{
    public static string[] GetInterfaceImplementations(this DecompilerTypeSystem ts, string interfaceName, SymbolSearchFlags flags, int limit)
    {
        var ifc = ts.FindType(new FullTypeName(interfaceName))?.GetDefinition();
        if (ifc == null)
            throw new Exception($"Interface {interfaceName} was not found");

        var types = ts.Modules
            .Where(m => m.PEFile?.AssemblyReferences.Any(r => r.Name == ifc.ParentModule.Name) == true)
            .SelectMany(m =>
                m.TypeDefinitions
                    .Where(t => t.MatchesFlags(flags: flags) && t.GetAllBaseTypeDefinitions().Any(i => i.Equals(ifc)))
            )
            .Take(limit)
            .Select(t => t.ReflectionName)
            .ToArray();

        return types;
    }

    public static (string[] namespaces, string[] types) GetNamespaceMembers(this DecompilerTypeSystem ts, string @namespace, string prefix, int limit)
    {
        var ns = ts.RootNamespace;
        foreach (var part in @namespace.Split('.'))
        {
            ns = ns.GetChildNamespace(part);
        }

        var childNamespaces = ns.ChildNamespaces.Where(n => n.Name.StartsWith(prefix)).Take(limit).Select(n => n.Name).ToArray();

        var types = ns.Types
            .Where(t => t.Name.StartsWith(prefix))
            .Take(limit - childNamespaces.Length)
            .Select(t => t.Name + (t.TypeParameterCount > 0 ? "`" + t.TypeParameterCount : ""))
            .ToArray();

        return (childNamespaces, types);
    }

    public static (string name, SymbolKind, SymbolSearchFlags)[] GetTypeMembers(this DecompilerTypeSystem ts, string @name, string prefix, int limit, uint symbolKinds, SymbolSearchFlags flags)
    {
        var type = ts.FindType(new FullTypeName(@name));
        if (type == null)
            return Array.Empty<(string name, SymbolKind, SymbolSearchFlags)>();

        var members =
            type
            .GetMembers(m => m.Name.StartsWith(prefix) && m.MatchesFlags(symbolKinds, flags))
            .Take(limit)
            .Select(m => (m.Name, m.SymbolKind, m.ToSearchFlags()))
            .ToArray();

        return members;
    }

    static bool MatchesFlags(this IEntity m, uint symbolKinds = uint.MaxValue, SymbolSearchFlags flags = (SymbolSearchFlags)uint.MaxValue)
    {
        var isCorrectKind = ((1 << (int)m.SymbolKind) & symbolKinds) > 0;
        if (!isCorrectKind)
            return false;

        if (~flags == SymbolSearchFlags.None)
            return true;

        var accessibilityCheck = m.EffectiveAccessibility() switch {
            Accessibility.Private => !flags.HasFlag(SymbolSearchFlags.Public) && !flags.HasFlag(SymbolSearchFlags.Protected) && !flags.HasFlag(SymbolSearchFlags.Internal),
            Accessibility.ProtectedAndInternal => flags.HasFlag(SymbolSearchFlags.Protected) && flags.HasFlag(SymbolSearchFlags.Internal),
            Accessibility.Protected => flags.HasFlag(SymbolSearchFlags.Protected),
            Accessibility.Internal => flags.HasFlag(SymbolSearchFlags.Internal),
            Accessibility.ProtectedOrInternal => flags.HasFlag(SymbolSearchFlags.Protected) || flags.HasFlag(SymbolSearchFlags.Internal),
            _ => true
        };
        if (!accessibilityCheck)
            return false;

        if (flags.HasFlag(SymbolSearchFlags.Static) && !m.IsStatic)
            return false;
        if (flags.HasFlag(SymbolSearchFlags.Instance) && m.IsStatic)
            return false;
        if (flags.HasFlag(SymbolSearchFlags.NonAbstract) && m.IsAbstract)
            return false;
        return true;
    }

    static SymbolSearchFlags ToSearchFlags(this IMember m)
    {
        var accessibility = m.Accessibility switch {
            Accessibility.Private => SymbolSearchFlags.None,
            Accessibility.ProtectedAndInternal => SymbolSearchFlags.Protected | SymbolSearchFlags.Internal,
            Accessibility.Protected => SymbolSearchFlags.Protected,
            Accessibility.Internal => SymbolSearchFlags.Internal,
            Accessibility.ProtectedOrInternal => SymbolSearchFlags.Protected | SymbolSearchFlags.Internal,
            _ => SymbolSearchFlags.Public
        };

        return accessibility |
            (m.IsStatic ? SymbolSearchFlags.Static : SymbolSearchFlags.Instance) |
            (m.IsAbstract ? SymbolSearchFlags.None : SymbolSearchFlags.NonAbstract);
    }

    public enum SymbolSearchFlags: uint
    {
        None = 0,

        Public = 1,
        Protected = 2,
        Internal = 4,

        Static = 8,
        Instance = 0x10,
        NonAbstract = 0x20,
        // HasStaticCommandAttribute = 0x40
    }
}
