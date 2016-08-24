const html = require("choo/html");

module.exports = (state, prev, send) => {
  return html`
<div class="about">
  <a role="top-nav" href="#">Back</a>
  <h1>About</h1>
  <p>
    This here thing takes a bunch of convolution kernels and continually applies them to a bitmap, mapping rgb values to hsv and back again.  It makes some pretty patterns sometimes!
  </p>
  <p>
    You can click on one of the available kernels to add it to the stack of kernels that get applied each frame.
  </p>
  <p>
    "Reset to noise" will effectively "start over" if your display goes black.  "pause / snapshot" shows you the current canvas state stops iterating and shows you the current state of the canvas so you can right click and save it as an image.
  </p>
  <p>
     Since these textures are generated on a toroidal surface, they should work as tileable images for like backgrounds or something?
  </p>
<h1>Usage</h1>
 <p>Click on things; see what happens.</p>
</div>`;
}
