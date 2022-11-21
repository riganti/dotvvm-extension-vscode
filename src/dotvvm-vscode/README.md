This extension adds support for **DotVVM** projects in **Visual Studio Code**: 

*   Syntax Highlighting and IntelliSense in DOTHTML markup files
*   Design-time error checking

We also have separate packages for **[Visual Studio 2022](https://marketplace.visualstudio.com/items?itemName=TomasHerceg.DotVVM-VSExtension2022)** and **[Visual Studio 2019](https://marketplace.visualstudio.com/items?itemName=TomasHerceg.DotVVM-VSExtension2019)**.

## What is DotVVM?

**[DotVVM](https://www.dotvvm.com)** is an **open source** ASP.NET framework that lets you build **line-of-business applications** and **SPAs** without writing tons of JavaScript code. You only have to write a viewmodel in C# and a view in HTML. DotVVM will do the rest for you.

**DotVVM** brings full **MVVM** experience and it uses **Knockout JS** on the client side. It handles the client-server communication, validation, localization, date & time formatting on the client side, SPAs and much more.

It is open source, it supports both **OWIN** and **ASP.NET Core**. It is multi-platform and it runs on **.NET Framework**, **.NET Core** and **Mono**. 

**Watch [DotVVM Coffee Tutorial Series on YouTube](https://www.youtube.com/watch?v=EkHJxkOzxnc&list=PLq1wAETqUjIY7WCpQYAYNZz_CxTrpEJbR&index=2)!** 

## How It Works

The Views in DotVVM use HTML syntax with controls and data-bindings.
```
public class ContactFormViewModel
{    
        public string Name { get; set; }    
        public string Email { get; set; }    

        public void Submit() 
        {        
                ContactService.Submit(Name, Email);    
        }
}
```
The ViewModels are plain C# objects. You can call public methods from the View.
```
    <div class="form-control">   
            <dot:TextBox Text="{value: Name}" /> 
    </div>
    <div class="form-control">   
             <dot:TextBox Text="{value: Email}" /> 
    </div> 
    <div class="button-bar">   
             <dot:Button Text="Submit"  Click="{command: Submit()}" /> 
    </div>  
```
You just need to know **C#, HTML and CSS**. For most scenarios, you don't have to write any JavaScript code.

## Features of DotVVM (Open Source & Free for Everyone)

*   Many built-in controls
    *   [GridView](https://www.dotvvm.com/docs/controls/builtin/GridView/latest), [Repeater](https://www.dotvvm.com/docs/controls/builtin/Repeater/latest)
    *   [FileUpload](https://www.dotvvm.com/docs/controls/builtin/FileUpload/latest)
    *   [TextBox](https://www.dotvvm.com/docs/controls/builtin/TextBox/latest), [ComboBox](https://www.dotvvm.com/docs/controls/builtin/ComboBox/latest), [CheckBox](https://www.dotvvm.com/docs/controls/builtin/CheckBox/latest), [RadioButton](https://www.dotvvm.com/docs/controls/builtin/RadioButton/latest)
    *   [Button](https://www.dotvvm.com/docs/controls/builtin/Button/latest), [LinkButton](https://www.dotvvm.com/docs/controls/builtin/LinkButton/latest), [RouteLink](https://www.dotvvm.com/docs/controls/builtin/RouteLink/latest)
    *   [Validator](https://www.dotvvm.com/docs/controls/builtin/Validator/latest), [ValidationSummary](https://www.dotvvm.com/docs/controls/builtin/ValidationSummary/latest)
    *   ...
*   [Advanced validation rules](https://www.dotvvm.com/docs/tutorials/basics-validation/latest) integrated with .NET data annotation attributes
*   Support for [.NET cultures](https://www.dotvvm.com/docs/tutorials/basics-globalization/latest), number & date formats and RESX localization
*   [SPA (Single Page App)](https://www.dotvvm.com/docs/tutorials/basics-single-page-applications-spa/latest) support
*   [User controls](https://www.dotvvm.com/docs/tutorials/control-development-introduction/latest)
*   MVVM with [testable ViewModels](https://www.dotvvm.com/docs/tutorials/advanced-testing-viewmodels/latest) and [IoC/DI support](https://www.dotvvm.com/docs/tutorials/advanced-ioc-di-container/latest)
*   [Visual Studio integration with IntelliSense](https://www.dotvvm.com/landing/dotvvm-for-visual-studio-extension)
*   [OWIN](https://www.dotvvm.com/docs/tutorials/how-to-start-dotnet-451/latest) and [ASP.NET Core](https://www.dotvvm.com/docs/tutorials/how-to-start-dnx/1-1) support
*   [DotVVM Dynamic Data](https://github.com/riganti/dotvvm-dynamic-data)

## How to Start

1.  Install this extension.
2.  Read the [documentation](http://www.dotvvm.com/docs).

## Commercial Products

### Component Packages
*   [Bootstrap for DotVVM](https://www.dotvvm.com/landing/bootstrap-for-dotvvm) - more than 40 controls that make using Bootstrap easier and your code much cleaner
*   [DotVVM Business Pack](https://www.dotvvm.com/products/dotvvm-business-pack) - Enterprise ready controls for Line of business web apps

### Advanced Extension for Visual Studio 2022 and 2019
*   [DotVVM for Visual Studio](https://www.dotvvm.com/landing/dotvvm-for-visual-studio-extension) - project templates, Intellisense for bindings, advanced design-time diagnostics, quick refactorings, navigation shortcuts and many more

## [More Info](https://github.com/riganti/dotvvm#more-info)

*   [DotVVM.com](https://www.dotvvm.com/)
*   [DotVVM Blog](https://www.dotvvm.com/blog)
*   [Documentation](https://www.dotvvm.com/docs)
*   [Twitter @dotvvm](https://twitter.com/dotvvm)
*   [Gitter Chat](https://gitter.im/riganti/dotvvm)
