import Fs from 'fs'
import axios from 'axios'
import sizeOf from 'image-size'
import { Base64Encode } from 'base64-stream'
import PDFDocument from 'pdfkit'
import { PDFDocumentOptions } from './interfaces'
import { IBaseComponent, ICellOptions, IComponentImage, IComponentImageProperties, IComponentList, IComponentTable, IComponentTableBaseOptions, IComponentTableOptions, IComponentText, IComponentTextOptions, IPageNumberOptions } from './interfaces/components'

type TExportType = 'base64' | 'file'
// type TComponentType = 'text' | 'list' | 'table' | 'image' | 'page-number'
interface ICursor {
  x: number
  y: number
}

interface IDocDefinition {
  pageNumberOptions?: IPageNumberOptions
  content: Array<IComponentText> | Array<IComponentList> | Array<IComponentTable> | Array<IComponentImage>
}

export default class PDFCreator {
  private doc: typeof PDFDocument
  private _cursor: ICursor = { x: 0, y: 0 }
  private dd: IDocDefinition = { content: [] };
  private documentOptions: PDFDocumentOptions
  private imageUrls: Record<string, IComponentImageProperties | null> = {}
  private options = {
    FONT_SIZE: 11,
    TEXT_COLOR: '#000000',
    COLOR_PRIMARY: '#074ea2',
    COLOR_GRAY: '#BCBCBC',
    FONT_LIGHT: `${__dirname}/fonts/Roboto-Light.ttf`,
    FONT_NORMAL: `${__dirname}/fonts/Roboto-Medium.ttf`,
    FONT_REGULAR: `${__dirname}/fonts/Roboto-Regular.ttf`,
    FONT_ITALIC: `${__dirname}/fonts/Roboto-Italic.ttf`,
    FONT_BOLD: `${__dirname}/fonts/Roboto-Bold.ttf`,
    FONT_BOLD_ITALIC: `${__dirname}/fonts/Roboto-BoldItalic.ttf`
  };

  constructor (documentOptions: PDFDocumentOptions) {
    this.documentOptions = documentOptions
    this.options.FONT_SIZE = this.documentOptions.fontSize || this.options.FONT_SIZE

    this.doc = new PDFDocument({ ...documentOptions, bufferPages: true })
  }

  async load (dd: IDocDefinition) {
    this.dd = dd

    for (let i = 0; i < this.dd.content.length; i++) {
      const content = this.dd.content[i];
      const keys = Object.keys(content)

      if (keys.includes('image')) {
        this.imageUrls[(content as IComponentImage).image.url] = null
      }

      if (keys.includes('table')) {
        {
          (content as IComponentTable).table.header?.forEach(rows => {
            rows.forEach(cell => {
              if ((cell as ICellOptions).image) {
                this.imageUrls[(cell as ICellOptions).image.url] = null
              }
            })
          })
        }
        {

          (content as IComponentTable).table.body?.forEach(rows => {
            rows.forEach(cell => {
              if ((cell as ICellOptions).image) {
                this.imageUrls[(cell as ICellOptions).image.url] = null
              }
            })
          })
        }
        {

          (content as IComponentTable).table.footer?.forEach(rows => {
            rows.forEach(cell => {
              if ((cell as ICellOptions).image) {
                this.imageUrls[(cell as ICellOptions).image.url] = null
              }
            })
          })
        }
      }
    }

    const imageUrls = Object.keys(this.imageUrls)
    for (let i = 0; i < imageUrls.length; i++) {
      const url = imageUrls[i]
      this.imageUrls[url] =  await this._downloadImage(url)
    }

    for (let i = 0; i < this.dd.content.length; i++) {
      const content = this.dd.content[i];
      
      this._setMarginTop(content.margin)
      this._findComponent(content)
      this._setMarginBottom(content.margin)
    }

    const range = this.doc.bufferedPageRange() // => { start: 0, count: 2 }
    const end: number = range.start + range.count
    let i: number = range.start

    for (range.start <= end; i < end; i++) {
      this.doc.switchToPage(i)
      this.renderPageNumber(i + 1, end)
    }

    this.deleteFiles()
  }

  private deleteFiles (){
    Object.keys(this.imageUrls).forEach(url => {
        const data = this.imageUrls[url]

        if (data) {
          Fs.unlinkSync(data.path);
        }
    });
  }

  renderComponentText (content: IComponentText) {
    this._setContentOptions(content)
    const _cursor = this.getCursor(content.x, content.y)
    const _options: IComponentTextOptions = Object.assign({}, content.options)
    this.doc.text(content.text, _cursor.x, _cursor.y, _options)
  }

  renderComponentList (content: IComponentList) {
    this._setContentOptions(content)
    const _cursor = this.getCursor(content.x, content.y)
    const _options: IComponentTextOptions = Object.assign({}, content.options)
    this.doc.list(content.list, _cursor.x, _cursor.y, _options)
  }

  renderComponentTable (content: IComponentTable) {
    this._setContentOptions(content)
    this._cursor = this.getCursor(content.x, content.y)

    // Table Options
    const pageWidth = content.table.options?.maxWidth || this.doc.page.width
    const pageMargins = content.table.options?.margins || this.doc.page.margins
    const cellMargin = content.table.options?.cellMargin || 5
    const isEllipsis = content.table.options?.isEllipsis || false
    const height = content.table.height || 25

    // Sayfanın sağ ve sol boşlukları hesaplanır.
    const totalLeftRightMargin = pageMargins.left + pageMargins.right

    // Tablonun sayfa üzerinde kaplayacağı genişlik hesaplanır.
    const tableMaxWidth = pageWidth - totalLeftRightMargin - (this._cursor.x - pageMargins.left)

    let totalCalcWidth = 0 // Kullanıcı tarafından sabit girilmiş toplam genişlik
    let tableAutoWidthCount = 0 // Kullanıcının otomatik hesaplanması istenen sütun sayısı
    content.table.widths?.forEach(width => {
      if (width === '*') {
        tableAutoWidthCount++
      } else {
        totalCalcWidth += width
      }
    })

    if (totalCalcWidth === 0) {
      throw new Error('Widths is must')
    }

    let reTableWidth = 0 // Otomatik hesaplama sonucu geriye kalan genişlik
    if (tableMaxWidth > totalCalcWidth) {
      reTableWidth = tableMaxWidth - totalCalcWidth
    } else {
      // TODO: Eğer max table genişliğinden büyük bir toplam genişlik mevcut ise toplam hesaplanmalı.
    }

    // TODO: İleriye dönük kalan genişliği (reTableWidth) eşit bölmek yerine sütun içerisinde ki verileri kontrol ederek yap
    const sizedWidth = reTableWidth / tableAutoWidthCount
    const widths = content.table.widths.join().split('*').join(`${sizedWidth || 25}`).split(',').map((n: string) => parseFloat(n))
    const tableBaseOptions = this._getTableBaseOptions(content.table.options)

    if (content.table.header) {
      for (let i = 0; i < content.table.header.length; i++) {
        const row = content.table.header[i];
        this._drawTableRow(height, widths, row, cellMargin, tableBaseOptions, isEllipsis)
      }
    }
    this.doc.y += cellMargin

    if (content.table.body) {
      for (let i = 0; i < content.table.body.length; i++) {
        const row = content.table.body[i];
        this._drawTableRow(height, widths, row, cellMargin, tableBaseOptions, isEllipsis)
      }
    }
    this.doc.y += cellMargin

    if (content.table.body) {
      for (let i = 0; i < content.table.body.length; i++) {
        const row = content.table.body[i];
        this._drawTableRow(height, widths, row, cellMargin, tableBaseOptions, isEllipsis)
      }
    }

    this.doc.y += cellMargin
    this.doc.x = this._cursor.x
  }

  renderComponentImage (content: IComponentImage) {
    this._setContentOptions(content)
    const _cursor = this.getCursor(content.x, content.y)
    const startX: number | undefined = _cursor.x
    const startY: number | undefined = _cursor.y

    const { image, width, height } = content

    const imageOptions: any = Object.assign({}, image.options)
    if (width || height) {
      if (width) {
        imageOptions.width = width
      }

      if (height) {
        imageOptions.height = height
      }
    } else {
      const pageWidth = this.doc.page.width
      const pageMargins = this.doc.page.margins

      const totalLeftRightMargin = pageMargins.left + pageMargins.right
      imageOptions.width = pageWidth - totalLeftRightMargin - (_cursor.x - pageMargins.left)
    }

    const imageProperties: IComponentImageProperties | null = image._imageProperties || this.imageUrls[image.url]
    
    if (imageProperties?.path) {
      this.doc.image(imageProperties.path, _cursor.x, _cursor.y, imageOptions)
    }
  }

  renderPageNumber (currentPage: number, totalPage: number): void {
    const pageNumberOptions = this.dd.pageNumberOptions

    if (!pageNumberOptions) {
      return
    }

    const { type = 'basic', seperator = '-', align = 'right', location = 'bottom' } = pageNumberOptions
    const { page } = this.doc
    const { margin, margins } = this.documentOptions

    let totalVerticalMargin = 0
    if (margin) {
      totalVerticalMargin = margin
    } else if (margins) {
      totalVerticalMargin = location === 'top' ? (margins?.top || 0) : (margins?.bottom || 0)
    }

    let pageNumberString = `${currentPage}`
    if (type === 'seperator') {
      pageNumberString = `${currentPage}${seperator}${totalPage}`
    }

    const textOptions: IComponentTextOptions = { width: 30 }
    const heightOfString = this.doc.heightOfString(pageNumberString, textOptions)
    let X = 0
    let Y = 0

    switch (location) {
      case 'bottom':
        Y = (page.height) - totalVerticalMargin - heightOfString
        break
      case 'top':
        Y = totalVerticalMargin - heightOfString
        break
    }

    switch (align) {
      case 'center':
        X = (page.width / 2) - ((textOptions?.width || 0) / 2)
        break
      case 'left':
        X = margin ? margin : (margins?.left || 0)
        break
      case 'right':
        textOptions.align = 'right'
        X = page.width - (margin ? margin : (margins?.right || 0)) - (textOptions?.width || 0)
        break
    }

    this.renderComponentText({ x: X, y: Y, text: pageNumberString, options: textOptions })
  }

  getCursor (x: number | undefined, y: number | undefined): ICursor {
    return {
      x: x || this.doc.x,
      y: y || this.doc.y
    }
  }

  export (type: TExportType): Promise<string> {
    return new Promise((resolve, reject) => {
      const stream = this.doc.pipe(new Base64Encode())
      this.doc.end()

      let finalString: string = '' // contains the base64 string
      stream.on('data', function (chunk: string) {
        finalString += chunk
      })

      stream.on('end', function () {
        resolve(finalString)
      })
    })
  }

  private _findComponent (content: IBaseComponent) {
    const keys = Object.keys(content)

    if (keys.includes('text')) {
      this.renderComponentText(content as IComponentText)
    }

    if (keys.includes('list')) {
      this.renderComponentList(content as IComponentList)
    }

    if (keys.includes('table')) {
      this.renderComponentTable(content as IComponentTable)
    }

    if (keys.includes('image')) {
      this.renderComponentImage(content as IComponentImage)
    }
  }

  /**
   * @param text yazılacak text
   * @param width yazılacak text'in kapsadığı alan
   * @param cellMargin textin yazılacağı hücrenin margini
   * (sadece yatayda uygulanır dikeyde ki (height) değer yazının dikeyde kapladığı alanı değiştirmez.)
   * @returns number
   */
  private _heightOfString (text: string, _width: number): number {
    return this.doc.heightOfString(text, { width: _width })
  }

  private _calcMaxCellHeight (cell: number | string | ICellOptions, _width: number): number {
    let _cellMaxHeight = 0

    if (typeof cell === 'string' || typeof cell === 'number') {
      _cellMaxHeight = this._heightOfString(`${cell}`, _width)
    } else if (cell.text) {
      _cellMaxHeight = this._heightOfString(cell.text, _width)
    } else if (cell.list && cell.list.length > 0) {
      _cellMaxHeight = this._heightOfString(`${cell.list[0]}`, _width) * cell.list.length
    } else if (cell.image) {
      const imageProperties: IComponentImageProperties | null = this.imageUrls[cell.image.url]
      if (imageProperties) {
        cell.image._imageProperties = imageProperties
        _cellMaxHeight = this._getImageCaclHeight(imageProperties, _width)
      }
    }

    return _cellMaxHeight
  }

  private _getImageCaclHeight (imageProperties: IComponentImageProperties, _width: number): number {
    return (((imageProperties?.height || 0) * _width) / (imageProperties?.width || 1)) || 0 // width zorla değiştirdiğimiz image in height sini hesaplıyoruz.
  }

  private _getImageCaclWidth (imageProperties: IComponentImageProperties, _height: number): number {
    return (((imageProperties?.width || 0) * _height) / (imageProperties?.height || 1)) || 0 // height zorla değiştirdiğimiz image in width sini hesaplıyoruz.
  }

  private _calcMaxRowHeight (row: Array<number | string | ICellOptions>, widths: number[], cellMargin: number): number {
    let rowMaxHeight = 0
    for (let i = 0; i < row.length; i++) {
      const cell = row[i]
      const _rowMaxHeight = this._calcMaxCellHeight(cell, widths[i] - (cellMargin * 2))

      if (_rowMaxHeight > rowMaxHeight) {
        rowMaxHeight = _rowMaxHeight
      }
    }

    return rowMaxHeight
  }

  private _drawTableCell (height: number, width: number, cell: number | string | ICellOptions, isEllipsis: boolean) {
    const {
      justify = 'center',
      align = 'center',
      lineJoin = 'miter',
      lineCap = 'square',
      dash,
      lineWidth = 0.5,
      strokeOpacity = 1,
      strokeColor = 'black',
      fillOpacity = 0,
      fillColor = 'white',
      cellMargin = 5
    } = Object.assign({}, typeof cell === 'object' ? cell : {} as ICellOptions)

    let textX = this._cursor.x + cellMargin
    let textY = this._cursor.y + cellMargin
    const _width = width - (cellMargin * 2)
    const _height = height - (cellMargin * 2)

    const textOptions: IComponentTextOptions = { width: _width, height: _height, align: align, ellipsis: true }
    const constHeightOfString = this._calcMaxCellHeight('CONST', 100) // normal yazı yüksekliği
    const heightOfString = this._calcMaxCellHeight(cell, _width)
    const count = Math.floor(_height / constHeightOfString)
    const isCellBiggerString = (_height > heightOfString)
    const downHeight = _height / 2
    let upHeight = 0

    switch (justify) {
      case 'bottom':
        if (isEllipsis) {
          textY += _height - (constHeightOfString * count)
        } else {
          if (isCellBiggerString) {
            textY += _height - heightOfString
          }
        }
        break
      case 'center':

        if (isEllipsis) {
          upHeight = (constHeightOfString * count) / 2
        } else {
          upHeight = heightOfString / 2
        }

        if (upHeight > downHeight) {
          upHeight = downHeight
        }

        textY += downHeight - upHeight
        break
    }

    this.doc
      .lineJoin(lineJoin)
      .lineCap(lineCap)

    if (dash) {
      this.doc
        .dash(dash.length, { space: dash.space })
    } else {
      this.doc.undash()
    }

    this.doc
      .rect(this._cursor.x, this._cursor.y, width, height)
      .lineWidth(lineWidth)
      .strokeOpacity(strokeOpacity)
      .fillOpacity(fillOpacity)
      .fillAndStroke(fillColor, strokeColor)
      .strokeOpacity(1)
      .fillOpacity(1)

    if (typeof cell === 'string' || typeof cell === 'number') {
      this.renderComponentText({ x: textX, y: textY, text: `${cell}`, options: textOptions })
    } else if (cell.text) {
      // bu değerleri siliyoruz çünkü tablo çizimi sırasında bu değerler sabittir.
      delete cell.options?.height
      delete cell.options?.width

      this.renderComponentText({ x: textX, y: textY, ...cell, options: Object.assign(textOptions, cell.options) })
    } else if (cell.list) {
      // bu değerleri siliyoruz çünkü tablo çizimi sırasında bu değerler sabittir.
      delete cell.options?.height
      delete cell.options?.width

      this.renderComponentList({ x: textX, y: textY, ...cell, options: Object.assign(textOptions, cell.options) })
    } else if (cell.image) {
      const imageProperties = cell.image._imageProperties

      let _imageHeight = (imageProperties?.height || 0)
      let _imageWidth = (imageProperties?.width || 0)

      const isBiggerImageThenHeight = _height < _imageHeight
      const isBiggerImageThenWidth = _width < _imageWidth

      if (isBiggerImageThenHeight) {
        _imageHeight = _height
      }

      if (isBiggerImageThenWidth) {
        _imageWidth = _width
      }

      switch (align) {
        case 'center':
          textX += (_width / 2) - (this._getImageCaclWidth(imageProperties as IComponentImageProperties, _imageHeight) / 2)
          break
        case 'right':
          textX += _width - this._getImageCaclWidth(imageProperties as IComponentImageProperties, _imageHeight)
          break
      }

      if (isEllipsis) {
        cell.height = _imageHeight
      } else {
        cell.width = _imageWidth
      }

      this.renderComponentImage({ x: textX, y: textY, ...cell })
    }
  }

  private _drawTableRow (height: number, widths: number[], row: Array<number | string | ICellOptions>, cellMargin: number, tableBaseOptions: IComponentTableBaseOptions, isEllipsis: boolean) {
    let startX: number | undefined = this._cursor.x // Table başlangıcı sabiti
    let startY: number | undefined = this._cursor.y // Table başlangıcı sabiti
    let rowHeight = height

    const rowMaxHeight = this._calcMaxRowHeight(row, widths, cellMargin)

    if (!isEllipsis) {
      if (height < (rowMaxHeight + (cellMargin * 2))) {
        rowHeight = rowMaxHeight + (cellMargin * 2)
      }
    }

    const isNewPage: boolean = this._checkNewPageAdd(rowHeight)

    if (isNewPage) {
      this._cursor = this.getCursor(startX, undefined)
      startX = this._cursor.x
      // eslint-disable-next-line no-unused-vars
      startY = this._cursor.y
    }

    row.forEach((cell: number | string | ICellOptions, i) => {
      let _cell: ICellOptions

      if (typeof cell === 'object') {
        _cell = { ...tableBaseOptions, ...cell }
      } else {
        _cell = { ...tableBaseOptions, ...{ text: `${cell}` } } as ICellOptions
      }

      this._drawTableCell(rowHeight, widths[i], _cell, isEllipsis)

      this._cursor.x += widths[i]
    })

    this._cursor.x = startX as number
    this._cursor.y += rowHeight
  }

  private _checkNewPageAdd (willBeAddedHeight: number): boolean {
    const { y, page } = this.doc
    const { margin, margins } = this.documentOptions

    let totalTopBottomMargin = 0
    if (margin) {
      totalTopBottomMargin = margin * 2
    } else if (margins) {
      totalTopBottomMargin = (margins.top || 0) + (margins.bottom || 0)
    }

    if ((y + willBeAddedHeight) > (page.height - totalTopBottomMargin)) {
      this.doc.addPage()
      return true
    };

    return false
  }

  private _getTableBaseOptions (options: IComponentTableOptions | undefined) {
    const _options: Record<string, any> = {}

    if (options) {
      Object.keys(options).forEach(key => {
        if ((options as Record<string, any>)[key]) {
          _options[key] = (options as Record<string, any>)[key]
        }
      })
    }

    return _options
  }

  private _setMarginBottom (margin: Array<number> | number = 0) {
    if (Array.isArray(margin)) {
      if (margin.length === 4) {
        this.doc.x -= margin[0]
        this.doc.y += margin[3]
        // this.doc.x += margin[]; // TODO right margin
      }
    }

    if (typeof margin === 'number') {
      this.doc.x += margin
      this.doc.y += margin
    }
  }

  private _setMarginTop (margin: Array<number> | number = 0) {
    if (Array.isArray(margin)) {
      if (margin.length === 4) {
        this.doc.x += margin[0]
        this.doc.y += margin[1]
      }
    }

    if (typeof margin === 'number') {
      this.doc.x += margin
      this.doc.y += margin
    }
  }

  private _setContentOptions (content: IBaseComponent) {
    this.doc.fillColor(content.textColor || this.options.TEXT_COLOR)
    this.doc.fontSize(content.fontSize || this.options.FONT_SIZE)

    switch (content.fontType) {
      case 'light':
        this.doc.font(this.options.FONT_LIGHT)
        break
      case 'normal':
        this.doc.font(this.options.FONT_NORMAL)
        break
      case 'regular':
        this.doc.font(this.options.FONT_REGULAR)
        break
      case 'italic':
        this.doc.font(this.options.FONT_ITALIC)
        break
      case 'bold':
        this.doc.font(this.options.FONT_BOLD)
        break
      case 'bold-italic':
        this.doc.font(this.options.FONT_BOLD_ITALIC)
        break
      default:
        this.doc.font(this.options.FONT_LIGHT)
        break
    }
  }

  /**
   * @param url indirilecek resim
   * @returns indirilen image'in özellikleri
   */
  private _downloadImage (url: string): Promise<IComponentImageProperties> {
    return new Promise(function (resolve, reject) {
      if (!url) {
        reject(new Error('Url not empty'))
      }

      if (!url.includes('.')) {
        reject(new Error('An extension was not found at the url you entered.'))
      }

      const splits = url.split('.')
      const extension = splits[splits.length - 1]
      const folder = './temp'
      const path = `./temp/image-${Date.now()}.${extension}`

      axios({
        url,
        method: 'GET',
        responseType: 'stream'
      }).then(response => {
        
        if (!Fs.existsSync(folder)) {
          Fs.mkdirSync(folder)
        }
        const writer = Fs.createWriteStream(path)
        response.data.pipe(writer)
        writer.on('finish', function () {
          const isExist = Fs.existsSync(path)
          if (isExist) {
            const dimensions = sizeOf(path)
            const imageProperties: IComponentImageProperties = { path, ...dimensions }
            resolve(imageProperties)
          } else {
            reject(new Error('File not saved'))
          }
        })
      }).catch(error => reject(error))
    })
  }
}
