declare module 'react-markdown' {
    import { ReactNode } from 'react';

    export interface Components {
        [key: string]: React.ComponentType<any>;
    }

    export interface Options {
        children?: string;
        components?: Components;
        remarkPlugins?: any[];
        rehypePlugins?: any[];
    }

    export default function ReactMarkdown(props: Options): JSX.Element;
}
