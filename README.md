mandelbrot-viewer-js
====================

Explore the [Mandelbrot set](https://en.wikipedia.org/wiki/Mandelbrot_set) using this HTML5 + Javascript viewer.

Check out the [live demo](http://www.albertlobo.com/fractals/mandelbrot-viewer)!

## Features

* Click & drag zooming.
* 'Checkered' and 'Checkered B&W' color schemes.
* Control the render using the 'Cancel' and 'Repaint' buttons.
* Zoom-in and zoom-out buttons.
* 'Reset' button to return to initial settings.

## Quick start

Options to add `mandelbrot-viewer-js` to your project:
* Install with [npm](https://npmjs.org): `npm install mandelbrot-viewer-js`
* [Download the latest release](https://github.com/llop/mandelbrot-viewer-js/archive/master.zip)
* Clone the repo: `git clone https://github.com/llop/mandelbrot-viewer-js.git`

## Basic use


Include 'mandelbrot-viewer.js' in your HTML file.

```html
<script src='mandelbrot-viewer.js'></script>
``` 

Add the viewer's HTML elements:

```html
<canvas id='mandelbrot-canvas' width='1000' height='562'>Your browser does not support canvas.</canvas>
<div id='mandelbrot-params'>
  Center @ (, i); &nbsp; Width: ; &nbsp; Height:
</div>
<div>
  <label for='color-select'>Color scheme:</label>
  <select id='color-select' name='color-select'>
    <option value='0' selected>Checkered</option>
    <option value='1'>Checkered B&amp;W</option>
  </select>
  <button id='repaint-btn' type='button'>Repaint</button>
  <button id='zoom-in-btn' type='button'>Zoom in</button>
  <button id='zoom-out-btn' type='button'>Zoom out</button>
  <button id='reset-btn' type='button'>Reset</button>
  <button id='cancel-btn' type='button'>Cancel</button>
</div>
```

A circle of radius 2 and centered at (0, 0i) is initially fitted in the canvas regardless of its dimensions. 
All elements are, of course, customizable via CSS.

Start the viewer with the following code:

```html
<script>
window.addEventListener('load', event => {
  const canvas = document.getElementById('mandelbrot-canvas');
  const mandelbrot = new Mandelbrot(canvas);
  const mandelbrotControls = new MandelbrotControls(mandelbrot, {
    colorSelect: document.getElementById('color-select'),
    repaintButton: document.getElementById('repaint-btn'),
    resetButton: document.getElementById('reset-btn'),
    cancelButton: document.getElementById('cancel-btn'),
    zoomInButton: document.getElementById('zoom-in-btn'),
    zoomOutButton: document.getElementById('zoom-out-btn'),
    paramsText: document.getElementById('mandelbrot-params')
  });
  mandelbrotControls.start();
});
</script>
```

A working example can be found in [index.html](index.html).

## Advanced use

Specify the coloring function for the Mandelbrot:

```javascript
const mandelbrot = new Mandelbrot(canvas, {
  colorFuncId: Mandelbrot.COLOR_CHECKERED
});
```

Available options are `Mandelbrot.COLOR_CHECKERED` and `Mandelbrot.COLOR_CHECKERED_BW`.

Events are dispatched whenever a scan starts or ends. To add listeners:

```javascript
// Attach listeners before calling mandelbrotControls.start()
mandelbrotControls.on('scan-start', event => {
  console.log('scan-start', event);
});
mandelbrotControls.on('scan-end', event => {
  console.log('scan-end', event);
});
mandelbrotControls.start();
```

## License

`mandelbrot-viewer-js` is released under the MIT License. See [LICENSE](LICENSE) for details.