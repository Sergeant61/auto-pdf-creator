export interface IBaseComponent {
  x?: number
  y?: number
  textColor?: string // hex color
  fontSize?: number
  fontType?: 'light' | 'normal' | 'regular' | 'italic' | 'bold' | 'bold-italic'
  width?: number
  height?: number
  margin?: Array<number> | number, // margin: [left, top, right, bottom]
}

export interface IComponentTextOptions {
  lineBreak?: boolean | undefined
  width?: number | undefined
  height?: number | undefined
  ellipsis?: boolean | string | undefined
  columns?: number | undefined
  columnGap?: number | undefined
  indent?: number | undefined
  paragraphGap?: number | undefined
  lineGap?: number | undefined
  wordSpacing?: number | undefined
  characterSpacing?: number | undefined
  fill?: boolean | undefined
  stroke?: boolean | undefined
  link?: string | undefined
  underline?: boolean | undefined
  strike?: boolean | undefined
  continued?: boolean | undefined
  oblique?: boolean | number | undefined
  align?: 'center' | 'justify' | 'left' | 'right' | string | undefined
  baseline?: number | 'svg-middle' | 'middle' | 'svg-central' | 'bottom' | 'ideographic' | 'alphabetic' | 'mathematical' | 'hanging' | 'top' | undefined
  features?: any[] | undefined
  listType?: 'bullet' | 'numbered' | 'lettered' | undefined
  bulletRadius?: number | undefined
  bulletIndent?: number | undefined
  textIndent?: number | undefined
}

export interface IComponentText extends IBaseComponent {
  text: string
  options?: IComponentTextOptions
}
export interface IPageNumberOptions extends IComponentText {
  location?: 'top' | 'bottom' // default is 'bottom'
  type?: 'basic' | 'seperator' // default is 'basic'
  seperator?: string // default is '-'
  align?: 'center' | 'left' | 'right' // default is 'right'
}

export interface IComponentImageProperties {
  height?: number
  width?: number
  orientation?: number
  type?: string
  path: string
}

export interface IComponentImageOptions {
  scale?: number | undefined
  fit?: [number, number] | undefined
  cover?: [number, number] | undefined
  align?: 'center' | 'right' | undefined
  valign?: 'center' | 'bottom' | undefined
  destination?: string | undefined
}

export interface IComponentImage extends IBaseComponent {
  image: {
    url: string
    options?: IComponentImageOptions
    _imageProperties?: IComponentImageProperties
  }
}

export interface IComponentList extends IBaseComponent {
  list: Array<string>
  options?: IComponentTextOptions
}

export interface IComponentTableBaseOptions {
  justify?: 'top' | 'bottom' | 'center'
  align?: 'center' | 'justify' | 'left' | 'right'
  lineJoin?: 'miter' | 'round' | 'bevel'
  lineCap?: 'butt' | 'round' | 'square'
  dash?: { length: number, space: number }
  lineWidth?: number
  strokeOpacity?: number
  strokeColor?: string | ''
  fillOpacity?: number
  fillColor?: string | ''
  cellMargin?: number
}

export interface IComponentTableOptions extends IComponentTableBaseOptions {
  maxWidth?: number
  margins?: { top: number; left: number; bottom: number, right: number },
  isEllipsis?: boolean
}

export interface ICellOptions extends IComponentTableBaseOptions, IComponentText, IComponentImage, IComponentList { }

export interface IComponentTable extends IBaseComponent {
  table: {
    options?: IComponentTableOptions
    widths: Array<number | '*'>
    height?: number
    header?: Array<Array<number | string | ICellOptions>>
    body?: Array<Array<number | string | ICellOptions>>
    footer?: Array<Array<number | string | ICellOptions>>
  }
}
