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
    this.imgWidth = this.canvas.width;
    this.imgHeight = this.canvas.height;
    
    this.context = this.canvas.getContext('2d');
    this.image = this.context.createImageData(this.imgWidth, this.imgHeight);
    
    this.imgSize = this.imgWidth * this.imgHeight;
    const ratio = this.imgWidth / this.imgHeight;
    
    // fit initial area in canvas
    const side = 4.0;
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
    const minDim = Math.min(this.width, this.height);
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
    const halfWidth = this.width / 2.0;
    const halfHeight = this.height / 2.0;
    let cr = this.center[0] - halfHeight + (this.inc / 2.0);
    let ciIni = this.center[1] - halfWidth + (this.inc / 2.0);
    
    let k = 0;
    let t = performance.now();
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
        
        const z = Math.sqrt(tr + ti);                   // magnitude of Z
        const dz = Math.sqrt(dzr * dzr + dzi * dzi);    // magnitude of DZ
        const dist = Math.log(z * z) * z / dz;          // approximate distance between C 
                                                        // and the nearest point in M
        this.ns[k] = n;
        this.dist[k] = dist;
        this.finalang[k] = Math.atan(zr / zi);
        this.dwell[k] = n + Math.log2(Math.log2(z)) - Mandelbrot.LOG2_LOG2_2;
        ++k;
      }
      
      // wait every so often
      if (performance.now() - t > Mandelbrot.WAIT_MS) {
        t = await this._sleep();
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
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);
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
    
    const dwell = Math.floor(this.dwell[k]);
    const finalrad = this.dwell[k] - Math.floor(this.dwell[k]);
    const dscale = Math.log2(this.dist[k] / this.inc);
    
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
    const color = this._colorCheckered(k);
    const gray = Math.round(color[0] * 0.299 + color[1] * 0.587 + color[2] * 0.114);
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
          const color = this._color(k);
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
  _sleep() { return new Promise(requestAnimationFrame); }
  
}



class MandelbrotControls {
  
  
  
  static CREATE_ELEMENT(htmlString) {
    const div = document.createElement('div');
    div.innerHTML = htmlString.trim();
    return div.firstChild; 
  }
  
  // events
  static SCAN_START = 'scan-start';
  static SCAN_END = 'scan-end';
  
  
  constructor(mandelbrot, {
        colorSelect = MandelbrotControls.CREATE_ELEMENT("<select><option value='0' selected>Checkered</option><option value='1'>Checkered B&amp;W</option></select>"), 
        repaintButton = MandelbrotControls.CREATE_ELEMENT("<button>Repaint</button>"),
        cancelButton = MandelbrotControls.CREATE_ELEMENT("<button>Cancel</button>"),
        zoomInButton = MandelbrotControls.CREATE_ELEMENT("<button>Zoom in</button>"),
        zoomOutButton = MandelbrotControls.CREATE_ELEMENT("<button>Zoom out</button>"),
        resetButton = MandelbrotControls.CREATE_ELEMENT("<button>Reset</button>"),
        paramsText = MandelbrotControls.CREATE_ELEMENT("<div>Center @ (, i); &nbsp; Width: ; &nbsp; Height:</div>")
      } = {}) {
        
    this.mandelbrot = mandelbrot;
    this.canvas = mandelbrot.canvas;
    this.canvas.style.cursor = 'pointer';
    this.context = mandelbrot.context;
    
    this.defaultParams = {
      center: [ this.mandelbrot.center[0], this.mandelbrot.center[1] ],
      width: this.mandelbrot.width,
      height: this.mandelbrot.height,
      colorFuncId: this.mandelbrot.colorFuncId
    };
    this.params = Object.assign({}, this.defaultParams);
    this.params.center = [ this.params.center[0], this.params.center[1] ];
    this.ratio = this.canvas.width / this.canvas.height;
    
    this.zoomChain = [];
    this.zoomChain.push({
      center: [ this.mandelbrot.center[0], this.mandelbrot.center[1] ],
      width: this.mandelbrot.width,
      height: this.mandelbrot.height
    });
    
    // HTML elements
    this.colorSelect = colorSelect;
    this.colorSelect.value = this.mandelbrot.colorFuncId;
    this.repaintButton = repaintButton;
    this.cancelButton = cancelButton;
    this.zoomInButton = zoomInButton;
    this.zoomOutButton = zoomOutButton;
    this.resetButton = resetButton;
    this.paramsText = paramsText;
    
    this.pointerDown = false;
    this.pointerId = undefined;
    
    // prepare event handling
    this.handlers = new Map();
    this.handlers.set(MandelbrotControls.SCAN_START, []);
    this.handlers.set(MandelbrotControls.SCAN_END, []);
    this._addUIEventHandlers();
  }
  
  
  _addUIEventHandlers() {
    this.repaintButton.addEventListener('click', event => { this._repaint() });
    this.resetButton.addEventListener('click', event => { this._reset() });
    this.cancelButton.addEventListener('click', event => { this._cancel() });
    this.zoomInButton.addEventListener('click', event => { this._zoomIn() });
    this.zoomOutButton.addEventListener('click', event => { this._zoomOut() });
    
    this.canvas.style.touchAction = 'none';
    this.canvas.addEventListener('pointerdown', this._handlePointerDown, true);
  }
  
  
  //-----------------------------------------------------------
  // 
  // mouse event handlers
  // 
  //-----------------------------------------------------------
  
  _handlePointerDown = event => {
    event.preventDefault();
    if (this.mandelbrot.scanning || this.pointerDown) return;
    
    this.pointerDown = true;
    this.pointerId = event.pointerId;
    
    event.target.setPointerCapture(event.pointerId);
    document.addEventListener('pointermove', this._handlePointerMove, true);
    document.addEventListener('pointerup', this._handlePointerUp, true);
    document.addEventListener('pointercancel', this._handlePointerCancel, true);
    
    const rect = this.canvas.getBoundingClientRect();
    this.mouseX = this.mouseXIni = event.clientX - rect.left;
    this.mouseY = this.mouseYIni = event.clientY - rect.top;
  }
  
  _handlePointerMove = event => {
    event.preventDefault();
    if (!this.pointerDown || this.pointerId != event.pointerId) return;
    this._setMouseCoords(event);
  }
  
  _handlePointerUp = event => {
     event.preventDefault();
    if (!this.pointerDown || this.pointerId != event.pointerId) return;
    
    this._removePointerEventListeners(event);
    this.pointerDown = false;
    this.pointerId = undefined;
    
    if (this.mouseX != this.mouseXIni && this.mouseY != this.mouseYIni) {
      this._setMouseCoords(event);
      this._setSelectionCenterAndWidth();
      this._setMandelbrotParams();
      
      this.zoomChain.push({
        center: [ this.mandelbrot.center[0], this.mandelbrot.center[1] ],
        width: this.mandelbrot.width,
        height: this.mandelbrot.height
      });
      this._scan();
    }
  }
  
  _handlePointerCancel = event => {
    event.preventDefault();
    if (!this.pointerDown || this.pointerId != event.pointerId) return;
    
    this._removePointerEventListeners(event);
    this.pointerDown = false;
    this.pointerId = undefined;
  }
  
  _removePointerEventListeners(event) {
    event.target.releasePointerCapture(event.pointerId);
    document.removeEventListener('pointermove', this._handlePointerMove, true);
    document.removeEventListener('pointerup', this._handlePointerUp, true);
    document.removeEventListener('pointercancel', this._handlePointerCancel, true);
  }
  
  _setMouseCoords(event) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouseX = event.clientX - rect.left;
    this.mouseY = event.clientY - rect.top;
    
    this.mouseX = Math.max(0, Math.min(this.canvas.width, this.mouseX));
    this.mouseY = Math.max(0, Math.min(this.canvas.height, this.mouseY));
    
    let disX = Math.abs(this.mouseX - this.mouseXIni);
    let disY = Math.abs(this.mouseY - this.mouseYIni);
    if (disX / disY > this.ratio) disX = disY * this.ratio;
    else disY = disX / this.ratio;
    
    this.mouseX = this.mouseX < this.mouseXIni ? this.mouseXIni - disX : this.mouseXIni + disX;
    this.mouseY = this.mouseY < this.mouseYIni ? this.mouseYIni - disY : this.mouseYIni + disY;
  }
  
  _setSelectionCenterAndWidth() {
    const hwidth = this.params.width / 2.0;
    const hheight = this.params.height / 2.0;
    const top = this.params.center[1] - hwidth;
    const left = this.params.center[0] - hheight;
    
    const x0 = Math.max(0, Math.min(this.mouseXIni, this.mouseX));
    const y0 = Math.max(0, Math.min(this.mouseYIni, this.mouseY));
    const x1 = Math.min(this.canvas.width, Math.max(this.mouseXIni, this.mouseX));
    const y1 = Math.min(this.canvas.height, Math.max(this.mouseYIni, this.mouseY));
    
    this.params.center[1] = top + ((x0 + x1) / 2) * this.params.width / this.canvas.width;
    this.params.center[0] = left + ((y0 + y1) / 2) * this.params.height / this.canvas.height;
    this.params.width = (x1 - x0) * this.params.width / this.canvas.width;
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
    this._renderLoop();
  }
  
  _renderLoop() {
    this._render();
    requestAnimationFrame(() => { this._renderLoop(); });
  }
  
  // draw zoom square if necessary
  _render() {
    this.mandelbrot.render();
    if (this.pointerDown) this._drawSelection();
  }
  
  _drawSelection() {
    const x0 = Math.max(0, Math.min(this.mouseXIni, this.mouseX));
    const y0 = Math.max(0, Math.min(this.mouseYIni, this.mouseY)) + 0.5;
    const x1 = Math.min(this.canvas.width, Math.max(this.mouseXIni, this.mouseX));
    const y1 = Math.min(this.canvas.height, Math.max(this.mouseYIni, this.mouseY)) + 0.5;
    
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
    
    this.colorSelect.value = this.params.colorFuncId;
    
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
    const zoomParams = this.zoomChain[this.zoomChain.length - 1];
    this.params.width = zoomParams.width;
    this.params.height = zoomParams.height;
    this.params.center = [ zoomParams.center[0], zoomParams.center[1] ];
    
    this._setMandelbrotParams();
    this._scan();
  }
  
  
  // set scan parameters
  _setMandelbrotParams() {
    this.params.colorFuncId = Number(this.colorSelect.value);
    
    this.mandelbrot.center = [ this.params.center[0], this.params.center[1] ];
    this.mandelbrot.width = this.params.width;
    this.mandelbrot.height = this.params.height;
    this.mandelbrot.colorFuncId = this.params.colorFuncId;
  }
  
  // scan
  _scan() {
    this.canvas.style.cursor = 'progress';  // wait cursor
    this._updateParamsText();               // parameters text box
    
    // fire scan start event
    const eventData = this._getEventData(MandelbrotControls.SCAN_START, true);
    this._dispatch(MandelbrotControls.SCAN_START, eventData);
    
    this.mandelbrot.scan((success) => {
      this.canvas.style.cursor = 'pointer';   // pointer cursor
      
      // fire scan end event
      const eventData = this._getEventData(MandelbrotControls.SCAN_END, success);
      this._dispatch(MandelbrotControls.SCAN_END, eventData);
    });
  }
  
  _updateParamsText() {
    const str = 'Center @ (' + this.mandelbrot.center[0] + ', ' + this.mandelbrot.center[1] + 'i); &nbsp; ' + 
        'Width: ' + this.mandelbrot.width + '; &nbsp; Height: ' + this.mandelbrot.height;
    this.paramsText.innerHTML = str;
  }
  
  //-----------------------------------------------------------
  // 
  // observer pattern
  // 
  //-----------------------------------------------------------
  
  // add an event handler
  on(event, handler) {
    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.push(handler);
    }
  }
  
  // remove an event handler
  off(event, handler) {
    const handlers = this.handlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index != -1) handlers.splice(index, 1);
    }
  }
  
  // fire events
  _dispatch(event, data) {
    const handlers = this.handlers.get(event);
    if (handlers) {
      for (let handler of handlers) {
        handler(data);
      }
    }
  }
  
  _getEventData(type, success) {
    return {
      type: type,
      data: {
        // mandelbrot render parameters
        center: [ this.mandelbrot.center[0], this.mandelbrot.center[1] ],
        width: this.mandelbrot.width,
        height: this.mandelbrot.height,
        colorFuncId: this.mandelbrot.colorFuncId
      },
      success: success,
      timestamp: performance.now()
    };
  }
  
}
