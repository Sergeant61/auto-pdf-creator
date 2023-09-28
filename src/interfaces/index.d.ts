export interface DocumentInfo {
  Producer?: string | undefined;
  Creator?: string | undefined;
  CreationDate?: Date | undefined;
  Title?: string | undefined;
  Author?: string | undefined;
  Keywords?: string | undefined;
  ModDate?: Date | undefined;
}

export interface DocumentPermissions {
  modifying?: boolean | undefined;
  copying?: boolean | undefined;
  annotating?: boolean | undefined;
  fillingForms?: boolean | undefined;
  contentAccessibility?: boolean | undefined;
  documentAssembly?: boolean | undefined;
  printing?: 'lowResolution' | 'highResolution' | undefined;
}

export interface PDFDocumentOptions {
  compress?: boolean | undefined;
  info?: DocumentInfo | undefined;
  userPassword?: string | undefined;
  ownerPassword?: string | undefined;
  permissions?: DocumentPermissions | undefined;
  pdfVersion?: '1.3' | '1.4' | '1.5' | '1.6' | '1.7' | '1.7ext3' | undefined;
  autoFirstPage?: boolean | undefined;
  size?: number[] | string | undefined;
  margin?: number | undefined;
  margins?: { top: number; left: number; bottom: number; right: number } | undefined;
  layout?: 'portrait' | 'landscape' | undefined;

  bufferPages?: boolean | undefined;

  fontFamily?: 'Roboto',
  fontSize?: 11,
}
