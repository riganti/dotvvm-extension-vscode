# DotVVM for Visual Studio Code

This extension brings basic support for editing [DotVVM](https://www.dotvvm.com) markup files into Visual Studio Code.

Together with [DotVVM Command Line](https://www.dotvvm.com/docs/tutorials/how-to-start-command-line/latest), it allows to build [DotVVM](https://www.dotvvm.com) applications on all platforms.

> You may also be interested in [DotVVM for Visual Studio 2017](https://marketplace.visualstudio.com/items?itemName=TomasHerceg.DotVVMforVisualStudio-17892).

## What is DotVVM?

[DotVVM](https://www.dotvvm.com) is an [open source](https://github.com/riganti/dotvvm) ASP.NET framework that lets you build **line-of-business applications** and **SPAs** without writing tons of JavaScript code. You only have to write a viewmodel in C# and a view in HTML. DotVVM will do the rest for you.

**DotVVM** brings full **MVVM** experience and it uses **Knockout JS** on the client side. It handles the client-server communication, validation, localization, date & time formatting on the client side, SPAs and much more.

It is open source, it supports both **OWIN** and **ASP.NET Core** and it runs on **.NET Framework**, **.NET Core** and **Mono**. 

## Features

* Syntax highlighting in `.dothtml`, `.dotmaster` and `.dotcontrol` files
* IntelliSense for DotVVM controls and their properties (with auto-detection of DotVVM libraries: Bootstrap for DotVVM, DotVVM Business Pack)

## Tips & Tricks

If you want to change the color of binding braces, you can add the following code to your workspace settings:

```
    "editor.tokenColorCustomizations": {
        "textMateRules": [
            {
                "scope": "markup.bold.dotvvm.binding",
                "settings": {
                    "foreground": "#ffff00"
                }
            }
        ]
    }
```
