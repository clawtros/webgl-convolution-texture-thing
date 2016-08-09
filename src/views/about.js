const html = require("choo/html");

module.exports = (state, prev, send) => {
  return html`
<div class="about">
  <h1>About</h1>
  <p>
    This here thing takes a bunch of convolution kernels and continually applies them to a bitmap, mapping rgb values to hsv and back again.
  </p>
</div>
`;
}


