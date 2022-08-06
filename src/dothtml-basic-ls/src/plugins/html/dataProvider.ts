import { IAttributeData, ITagData, newHTMLDataProvider } from 'vscode-html-languageservice';
import { htmlData } from 'vscode-html-languageservice/lib/umd/languageFacts/data/webCustomData';

const globalEvents: IAttributeData[] = [
    {
        name: 'Events.Click',
        description: '',
        values: [ { name: "{staticCommand: s.Something()}" } ]
    },
    {
        name: 'Events.DoubleClick',
        description: '',
        values: [ { name: "{staticCommand: s.Something()}" } ]
    },
];
const globalAttributes: IAttributeData[] = [
];

const globalTags: ITagData[] = [
    {
        name: "dot:Repeater",
        attributes: [
            { name: "DataSource" }
        ]
    }
];

const addAttributes: Record<string, IAttributeData[]> = {
};

const html5Tags = htmlData.tags!.map((tag) => {
    let attributes = tag.attributes;
    if (addAttributes[tag.name]) {
        attributes = [...attributes, ...addAttributes[tag.name]];
    }
    return {
        ...tag,
        attributes
    };
});

export const dothtmlDataProvider = newHTMLDataProvider('dotvvm-builtin', {
    version: 1,
    globalAttributes: [...htmlData.globalAttributes!, ...globalEvents, ...globalAttributes],
    tags: [...html5Tags, ...globalTags],
    valueSets: htmlData.valueSets
});
