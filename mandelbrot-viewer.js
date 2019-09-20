'use strict';


class Mandelbrot {
  
  
  // sleep every so often during scan
  static WAIT_MS = 100;
  
  // used to color
  static LOG2_LOG2_2 = Math.log2(Math.log2(2.0));
  static LOG_BIG_NUM = Math.log(1000000);
  
  
  // color function ids
  static COLOR_CHECKERED = 0;
  static COLOR_CHECKERED_BW = 1;
  
  
  
  constructor(canvas, {
        colorFuncId = Mandelbrot.COLOR_CHECKERED
      } = {}) {
      
    this.canvas = canvas;
    this.imgWidth = this.canvas.width();
    this.imgHeight = this.canvas.height();
    
    this.context = this.canvas[0].getContext('2d');
    this.image = this.context.createImageData(this.imgWidth, this.imgHeight);
    
    this.imgSize = this.imgWidth * this.imgHeight;
    let ratio = this.imgWidth / this.imgHeight;
    
    // fit initial area in canvas
    let side = 4.0;
    this.center = [ 0.0, 0.0 ];
    if (ratio >= 1.0) {
      this.height = side;
      this.width = side * ratio;
    } else {
      this.width = side;
      this.height = side / ratio;
    }
    this.inc = this.width / this.imgWidth;
    
    this.colorFuncId = colorFuncId;   
    this.colorFunc = this._getColorFunc();
    this.maxN = this._getMaxN();
    
    this.scanning = false;
    this.scanLoop = false;
    this.scanDone = true;
    
    this.ns = new Uint32Array(this.imgSize);
    this.finalang = new Float64Array(this.imgSize);
    this.dist = new Float64Array(this.imgSize);
    this.dwell = new Float64Array(this.imgSize);
    this.pix = new Uint8Array(this.imgSize);
    this._resetDataStructs();
  }
  
  
  // prepare for a new scan
  _resetDataStructs() {
    for (let k = 0; k < this.imgSize; ++k) {
      this.ns[k] = 0;
      this.finalang[k] = 0.0;
      this.dist[k] = 0.0;
      this.dwell[k] = 0.0;
      this.pix[k] = 1;
    }
  }
  
  // colorFuncId determines the function to color pixels
  _getColorFunc() {
    switch (this.colorFuncId) {
      case Mandelbrot.COLOR_CHECKERED: return this._colorCheckered;
      case Mandelbrot.COLOR_CHECKERED_BW: return this._colorCheckeredBlackAndWhite;
    }
    return this._colorCheckered;
  }
  
  // pick a maxN depending on the scanned area's size
  _getMaxN() {
    let minDim = Math.min(this.width, this.height);
    if (minDim > 4.0 / 10.0) return 250;
    if (minDim > 4.0 / 100.0) return 1000;
    if (minDim > 4.0 / 1000.0) return 2500;
    if (minDim > 4.0 / 10000.0) return 5000;
    if (minDim > 4.0 / 100000.0) return 10000;
    if (minDim > 4.0 / 1000000.0) return 25000;
    return 50000;
  }
  
  // internal scan function -returns a promise
  async _scan() {
    this.scanning = true;
    this.scanLoop = true;
    this.scanDone = false;
    
    this._resetDataStructs();
    this.colorFunc = this._getColorFunc();
    this.maxN = this._getMaxN();
    
    
    this.inc = this.width / this.imgWidth;
    let halfWidth = this.width / 2.0;
    let halfHeight = this.height / 2.0;
    let cr = this.center[0] - halfHeight + (this.inc / 2.0);
    let ciIni = this.center[1] - halfWidth + (this.inc / 2.0);
    
    let k = 0;
    let t = Date.now();
    for (let i = 0; this.scanLoop && i < this.imgHeight; ++i, cr += this.inc) {
      let ci = ciIni;
      for (let j = 0; j < this.imgWidth; ++j, ci += this.inc) {
        let zr = 0.0;
        let zi = 0.0;
        let tr = 0.0;
        let ti = 0.0;
        let dzr = 0.0;
        let dzi = 0.0;
        let dtr, dti;
        let n = 0;
        while (n < this.maxN && tr + ti <= 4.0) {
          // z  =  z^2  +  c
          zi = 2.0 * zr * zi + ci;
          zr = tr - ti + cr;
          
          tr = zr * zr;
          ti = zi * zi;
          
          // dz  =  2  *  z  *  dz  +  1
          dtr = 2.0 * (zr * dzr - zi * dzi) + 1.0;
          dti = 2.0 * (zr * dzi + zi * dzr);
          
          dzr = dtr;
          dzi = dti;
          
          ++n;
        }
        
        let z = Math.sqrt(tr + ti);                   // magnitude of Z
        let dz = Math.sqrt(dzr * dzr + dzi * dzi);    // magnitude of DZ
        let dist = Math.log(z * z) * z / dz;          // approximate distance between C 
                                                      // and the nearest point in M
        this.ns[k] = n;
        this.dist[k] = dist;
        this.finalang[k] = Math.atan(zr / zi);
        this.dwell[k] = n + Math.log2(Math.log2(z)) - Mandelbrot.LOG2_LOG2_2;
        ++k;
      }
      
      // wait every so often
      if (Date.now() - t > Mandelbrot.WAIT_MS) {
        await this._sleep();
        t = Date.now();
      }
    }
    
    this.scanning = false;
    return this.scanLoop;
  }
  
  
  // cancels the scan if it's running
  async cancel() {
    if (!this.scanning && !this.scanLoop) return;
    
    this.scanLoop = false;
    return this.scanPromise;
  }
  
  
  // scan the currently defined area
  scan(callback) {
    
    this.scanPromise = this._scan();
    this.scanPromise.then(callback);
    
  }
  
  
  // http://axonflux.com/handy-rgb-to-hsl-and-rgb-to-hsv-color-model-c
  _hsvToRgb(h, s, v) {
    let r, g, b;
    let i = Math.floor(h * 6);
    let f = h * 6 - i;
    let p = v * (1 - s);
    let q = v * (1 - f * s);
    let t = v * (1 - (1 - f) * s);
    switch (i % 6) {
      case 0: r = v, g = t, b = p; break;
      case 1: r = q, g = v, b = p; break;
      case 2: r = p, g = v, b = t; break;
      case 3: r = p, g = q, b = v; break;
      case 4: r = t, g = p, b = v; break;
      case 5: r = v, g = p, b = q; break;
    }
    return [ r * 255, g * 255, b * 255 ];
  }
  
  
  // https://mrob.com/pub/muency/color.html
  _colorCheckered(k) {
    if (this.ns[k] >= this.maxN) return [ 255, 255, 255 ];
    
    let dwell = Math.floor(this.dwell[k]);
    let finalrad = this.dwell[k] - Math.floor(this.dwell[k]);
    let dscale = Math.log2(this.dist[k] / this.inc);
    
    let value = 0.0;
    if (dscale > 0.0) value = 1.0;
    else if (dscale > -10.0) value = (10.0 + dscale) / 10.0;
    
    let p = Math.log(dwell) / Mandelbrot.LOG_BIG_NUM;
    let angle = 0.0;
    let radius = 0.0;
    if (p < 0.5) {
      p = 1.0 - 1.5 * p;
      angle = 1.0 - p;
      radius = Math.sqrt(p);
    } else {
      p = 1.5 * p - 0.5;
      angle = p;
      radius = Math.sqrt(p);
    }
    
    if (dwell % 2) {
      value *= 0.85;
      radius *= 0.667;
    }
    
    if (this.finalang[k] > 0.0) {
      angle += 0.02;
    }
    angle += 0.0001 * finalrad;
    
    let hue = angle * 10.0;
    hue -= Math.floor(hue);
    let saturation = radius - Math.floor(radius);
    
    return this._hsvToRgb(hue, saturation, value);
  }
  
  // b&w version of checkerboard
  _colorCheckeredBlackAndWhite(k) {
    let color = this._colorCheckered(k);
    let gray = Math.round(color[0] * 0.299 + color[1] * 0.587 + color[2] * 0.114);
    return [ gray, gray, gray ];
  }
  
  
  // color pixel k
  _color(k) {
    if (this.ns[k] == 0) return [ 0, 0, 0 ];  // C not yet processed: color black
    this.pix[k] = 0;                          // mark pixel as colored
    return this.colorFunc(k);                 // return color for pixel
  }
  
  
  // paint what we have on the canvas
  render() {
    if (!this.scanDone) {
      let offset = 0;
      for (let k = 0; k < this.imgSize; ++k, offset += 4) {
        if (this.pix[k]) {
          let color = this._color(k);
          this.image.data[offset] = color[0];
          this.image.data[offset + 1] = color[1];
          this.image.data[offset + 2] = color[2];
          this.image.data[offset + 3] = 255;
        }
      }
      if (!this.scanning) this.scanDone = true;
    }
    this.context.clearRect(0, 0, this.imgWidth, this.imgHeight);
    this.context.putImageData(this.image, 0, 0);
  }
  
  
  // sleep function. use 'await this.sleep()' in async functions
  _sleep() { return new Promise(resolve => setTimeout(resolve, 0)); }
  
}



class MandelbrotControls {
  
  
  // events
  static SCAN_START = 'scan-start';
  static SCAN_END = 'scan-end';
  
  
  constructor(mandelbrot, {
        colorSelect = $("<select><option value='0' selected>Checkered</option><option value='1'>Checkered B&amp;W</option></select>"), 
        repaintButton = $("<button type='button'>Repaint</button>"),
        cancelButton = $("<button type='button'>Cancel</button>"),
        zoomInButton = $("<button type='button'>Zoom in</button>"),
        zoomOutButton = $("<button type='button'>Zoom out</button>"),
        resetButton = $("<button type='button'>Reset</button>"),
        paramsText = $("<div></div>")
      } = {}) {
        
    this.mandelbrot = mandelbrot;
    this.canvas = mandelbrot.canvas;
    this.canvas.css('cursor', 'pointer');
    this.context = mandelbrot.context;
    
    this.defaultParams = {
      center: [ this.mandelbrot.center[0], this.mandelbrot.center[1] ],
      width: this.mandelbrot.width,
      height: this.mandelbrot.height,
      colorFuncId: this.mandelbrot.colorFuncId
    };
    this.params = Object.assign({}, this.defaultParams);
    this.params.center = [ this.params.center[0], this.params.center[1] ];
    this.ratio = this.canvas.width() / this.canvas.height();
    
    this.zoomChain = [];
    this.zoomChain.push({
      center: [ this.mandelbrot.center[0], this.mandelbrot.center[1] ],
      width: this.mandelbrot.width,
      height: this.mandelbrot.height
    });
    
    // HTML elements
    this.colorSelect = colorSelect;
    if (this.colorSelect) this.colorSelect.val(this.mandelbrot.colorFuncId);
    this.repaintButton = repaintButton;
    this.cancelButton = cancelButton;
    this.zoomInButton = zoomInButton;
    this.zoomOutButton = zoomOutButton;
    this.resetButton = resetButton;
    this.paramsText = paramsText;
    
    // prepare event handling
    this.mouseDown = false;
    this.handlers = new Map();
    this.handlers.set(MandelbrotControls.SCAN_START, []);
    this.handlers.set(MandelbrotControls.SCAN_END, []);
    this._addUIEventHandlers();
  }
  
  
  _addUIEventHandlers() {
    if (this.repaintButton) {
      this.repaintButton.click(() => { this._repaint() });
    }
    if (this.resetButton) {
      this.resetButton.click(() => { this._reset() });
    }
    if (this.cancelButton) {
      this.cancelButton.click(() => { this._cancel() });
    }
    if (this.zoomInButton) {
      this.zoomInButton.click(() => { this._zoomIn() });
    }
    if (this.zoomOutButton) {
      this.zoomOutButton.click(() => { this._zoomOut() });
    }
    
    this.canvas.mousedown((event) => { this._mouseDownHandler(event) });
    $(document).mousemove((event) => { this._mouseMoveHandler(event) });
    $(document).mouseup((event) => { this._mouseUpHandler(event) });
  }
  
  
  //-----------------------------------------------------------
  // 
  // mouse event handlers
  // 
  //-----------------------------------------------------------
  
  _mouseDownHandler(event) {
    if (this.mandelbrot.scanning) return;
    
    if (event.which == 1) {
      this.mouseDown = true;
      this.mouseX = this.mouseXIni = event.pageX - this.canvas.position().left;
      this.mouseY = this.mouseYIni = event.pageY - this.canvas.position().top;
    }
  }
  
  _mouseMoveHandler(event) {
    if (this.mandelbrot.scanning) return;
    
    if (this.mouseDown) {
      this._setMouseCoords(event);
      this.render();
    }
  }
  
  _mouseUpHandler(event) {
    if (this.mandelbrot.scanning) return;
    
    if (this.mouseDown) {
      this.mouseDown = false;
      
      if (event.which == 1 && 
          this.mouseX != this.mouseXIni &&
          this.mouseY != this.mouseYIni) {
        this._setMouseCoords(event);
        this._setSelectionCenterAndWidth();
        this._setMandelbrotParams();
        
        this.zoomChain.push({
          center: [ this.mandelbrot.center[0], this.mandelbrot.center[1] ],
          width: this.mandelbrot.width,
          height: this.mandelbrot.height
        });
        this._scan();
      } else {
        // clicking another button cancels the zoom
        this.render();
      }
    }
  }
  
  _setMouseCoords(event) {
    this.mouseX = event.pageX - this.canvas.position().left;
    this.mouseY = event.pageY - this.canvas.position().top;
    
    this.mouseX = Math.max(0, Math.min(this.canvas.width(), this.mouseX));
    this.mouseY = Math.max(0, Math.min(this.canvas.height(), this.mouseY));
    
    let disX = Math.abs(this.mouseX - this.mouseXIni);
    let disY = Math.abs(this.mouseY - this.mouseYIni);
    let sratio = disX / disY;
    if (sratio > this.ratio) disX = disY * this.ratio;
    else disY = disX / this.ratio;
    
    this.mouseX = this.mouseX < this.mouseXIni ? this.mouseXIni - disX : this.mouseXIni + disX;
    this.mouseY = this.mouseY < this.mouseYIni ? this.mouseYIni - disY : this.mouseYIni + disY;
  }
  
  _setSelectionCenterAndWidth() {
    let hwidth = this.params.width / 2.0;
    let hheight = this.params.height / 2.0;
    let top = this.params.center[1] - hwidth;
    let left = this.params.center[0] - hheight;
    
    let x0 = Math.max(0, Math.min(this.mouseXIni, this.mouseX));
    let y0 = Math.max(0, Math.min(this.mouseYIni, this.mouseY));
    let x1 = Math.min(this.canvas.width(), Math.max(this.mouseXIni, this.mouseX));
    let y1 = Math.min(this.canvas.height(), Math.max(this.mouseYIni, this.mouseY));
    
    this.params.center[1] = top + ((x0 + x1) / 2) * this.params.width / this.canvas.width();
    this.params.center[0] = left + ((y0 + y1) / 2) * this.params.height / this.canvas.height();
    this.params.width = (x1 - x0) * this.params.width / this.canvas.width();
    this.params.height = this.params.width / this.ratio;
  }
  
  
  //-----------------------------------------------------------
  // 
  // 'public' functions:
  // 
  // - start
  // - render
  // - on
  // - off
  // 
  //-----------------------------------------------------------
  
  // set off the initial scan
  start() {
    this._scan();
  }
  
  // draw zoom square if necessary
  render() {
    this.mandelbrot.render();
    if (this.mouseDown) this._drawSelection();
  }
  
  _drawSelection() {
    let x0 = Math.max(0, Math.min(this.mouseXIni, this.mouseX));
    let y0 = Math.max(0, Math.min(this.mouseYIni, this.mouseY)) + 0.5;
    let x1 = Math.min(this.canvas.width(), Math.max(this.mouseXIni, this.mouseX));
    let y1 = Math.min(this.canvas.height(), Math.max(this.mouseYIni, this.mouseY)) + 0.5;
    
    this.context.lineWidth = 3;
    this.context.strokeStyle = '#fff';
    this.context.strokeRect(x0, y0, x1 - x0, y1 - y0);
    this.context.lineWidth = 1;
    this.context.strokeStyle = '#000';
    this.context.strokeRect(x0, y0, x1 - x0, y1 - y0);
  } 
  
  
  //-----------------------------------------------------------
  // 
  // control functions:
  // 
  // - reset
  // - repaint
  // - cancel
  // - zoom in
  // - zoom out
  // 
  //-----------------------------------------------------------
  
  // reset
  async _reset() {
    await this.mandelbrot.cancel();
    
    this.zoomChain.splice(1, this.zoomChain.length - 1);
    
    this.params = Object.assign({}, this.defaultParams);
    this.params.center = [ this.params.center[0], this.params.center[1] ];
    
    if (this.colorSelect) this.colorSelect.val(this.params.colorFuncId);
    
    this._setMandelbrotParams();
    this._scan();
  }
  
  // repaint
  async _repaint() {
    await this.mandelbrot.cancel();
    this._setMandelbrotParams();
    this._scan();
  }
  
  // cancel
  async _cancel() {
    await this.mandelbrot.cancel();
  }
  
  // zoom in
  async _zoomIn() {
    await this.mandelbrot.cancel();
    this.params.width /= 2;
    this.params.height /= 2;
    this._setMandelbrotParams();
    
    this.zoomChain.push({
      center: [ this.mandelbrot.center[0], this.mandelbrot.center[1] ],
      width: this.mandelbrot.width,
      height: this.mandelbrot.height
    });
    this._scan();
  }
  
  // zoom out
  async _zoomOut() {
    if (this.zoomChain.length == 1) return;
    await this.mandelbrot.cancel();
    
    if (this.zoomChain.length > 1) this.zoomChain.pop();
    let zoomParams = this.zoomChain[this.zoomChain.length - 1];
    this.params.width = zoomParams.width;
    this.params.height = zoomParams.height;
    this.params.center = [ zoomParams.center[0], zoomParams.center[1] ];
    
    this._setMandelbrotParams();
    this._scan();
  }
  
  
  // set scan parameters
  _setMandelbrotParams() {
    if (this.colorSelect) this.params.colorFuncId = Number(this.colorSelect.val());
    
    this.mandelbrot.center = [ this.params.center[0], this.params.center[1] ];
    this.mandelbrot.width = this.params.width;
    this.mandelbrot.height = this.params.height;
    this.mandelbrot.colorFuncId = this.params.colorFuncId;
  }
  
  // scan
  _scan() {
    this.canvas.css('cursor', 'wait');  // wait cursor
    this._updateParamsText();           // parameters text box
    
    // fire scan start event
    let eventData = this._getEventData(MandelbrotControls.SCAN_START, true);
    this._dispatch(MandelbrotControls.SCAN_START, eventData);
    
    this.mandelbrot.scan((success) => {
      this.canvas.css('cursor', 'pointer');   // pointer cursor
      
      // fire scan end event
      let eventData = this._getEventData(MandelbrotControls.SCAN_END, success);
      this._dispatch(MandelbrotControls.SCAN_END, eventData);
    });
  }
  
  _updateParamsText() {
    if (this.paramsText) {
      let str = 'Center @ (' + this.mandelbrot.center[0] + ', ' + this.mandelbrot.center[1] + 'i); &nbsp; ' + 
        'Width: ' + this.mandelbrot.width + '; &nbsp; Height: ' + this.mandelbrot.height;
      this.paramsText.html(str);
    }
  }
  
  //-----------------------------------------------------------
  // 
  // observer pattern
  // 
  //-----------------------------------------------------------
  
  // add an event handler
  on(event, handler) {
    let handlers = this.handlers.get(event);
    if (handlers) {
      handlers.push(handler);
    }
  }
  
  // remove an event handler
  off(event, handler) {
    let handlers = this.handlers.get(event);
    if (handlers) {
      let index = handlers.indexOf(handler);
      if (index != -1) handlers.splice(index, 1);
    }
  }
  
  // fire events
  _dispatch(event, data) {
    let handlers = this.handlers.get(event);
    if (handlers) {
      for (let handler of handlers) {
        handler(data);
      }
    }
  }
  
  _getEventData(type, success) {
    return {
      type: type,
      center: [ this.mandelbrot.center[0], this.mandelbrot.center[1] ],
      width: this.mandelbrot.width,
      height: this.mandelbrot.height,
      colorFuncId: this.mandelbrot.colorFuncId,
      success: success
    };
  }
  
}















