export type Widget = {
    id: string;
    type: string;
    title: string;
    description?: string;
    query: string;
    width?: string; // "1/3" | "1/2" | "2/3" | "full"
    refreshInterval?: number; // seconds
    data?: any[];
    value?: number;
    timeFrom?: string;
    timeTo?: string;
};

export type ReportMeta = {
    id: string;
    title: string;
    widgets: Widget[];
};

export type ReportResponse = {
    id: string;
    title: string;
    widgets: Widget[];
};

export type Report = {
    id: string;
    title: string;
    widgets: string[];
};

export type Column = {
    name: string;
    type: string;
};

export type Table = {
    name: string;
    columns: Column[];
};

export type View = {
    id: string;
    name: string;
    engine: string;
};

export type SchemaResponse = {
    tables: Table[];
};

export type PixelSettings = {
    fileName: string;
    endpoint: string;
};

export interface User {
    username: string;
    role: string;
    password?: string;
}
