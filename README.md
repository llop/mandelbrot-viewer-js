mandelbrot-viewer-js
====================

Explore the [Mandelbrot set](https://en.wikipedia.org/wiki/Mandelbrot_set) using this HTML5 + Javascript viewer.

## Features

* Easy click + drag zooming.
* 'Checkered' and 'Checkered B&W' color schemes.
* Control the render using the 'Cancel' and 'Repaint' buttons.
* Zoom-in and zoom-out buttons.
* 'Reset' button to return to initial settings.

## Getting started

Include 'mandelbrot-viewer.js' in your HTML file. [jQuery](https://jquery.com/) is also required.

```html
<script src='https://ajax.googleapis.com/ajax/libs/jquery/3.4.1/jquery.min.js'></script>
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
$(() => {
  const canvas = $('#mandelbrot-canvas');
  const mandelbrot = new Mandelbrot(canvas);
  const mandelbrotControls = new MandelbrotControls(mandelbrot, {
    colorSelect: $('#color-select'),
    repaintButton: $('#repaint-btn'),
    resetButton: $('#reset-btn'),
    cancelButton: $('#cancel-btn'),
    zoomInButton: $('#zoom-in-btn'),
    zoomOutButton: $('#zoom-out-btn'),
    paramsText: $('#mandelbrot-params')
  });
  mandelbrotControls.on('scan-start', (event) => {
    console.log('scan-start', event);
  });
  mandelbrotControls.on('scan-end', (event) => {
    console.log('scan-end', event);
  });
  mandelbrotControls.start();
});
</script>
```

A working example can be found in [index.html](index.html).

## Advanced use

Specify the coloring function for the Mandelbrot:

```javascript
let mandelbrot = new Mandelbrot(canvas, {
  colorFuncId: Mandelbrot.COLOR_CHECKERED
});
```

Available options are `Mandelbrot.COLOR_CHECKERED` and `Mandelbrot.COLOR_CHECKERED_BW`.

Events are dispatched whenever a scan starts or ends. To add listeners:

```javascript
// Attach listeners before calling mandelbrotControls.start()
mandelbrotControls.on('scan-start', (event) => {
  console.log('scan-start', event);
});
mandelbrotControls.on('scan-end', (event) => {
  console.log('scan-end', event);
});
mandelbrotControls.start();
```

## License

`mandelbrot-viewer-js` is resealsed under the MIT License. See [LICENSE](LICENSE) for details.