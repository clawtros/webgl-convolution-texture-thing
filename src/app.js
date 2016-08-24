const TextureGenerator = require("./generator");
const GeneratorModel = require("./models/texture_generator");

const choo = require("choo");
const app = choo();

app.router(
  "/",
  (route) => [
    route("/", require('./views/main'), [
      route('/about', require('./views/about'))
    ]),
  ]
);

window.startApp = () => {
  const textureGenerator = TextureGenerator({
    canvasId: "c",
    resolution: 256
  });

  app.model(
    GeneratorModel(
      textureGenerator,
      require('./presets'),
      require('./kernels')
    ));
  
  const tree = app.start({history: false, hash: true});
  document.body.appendChild(tree);
};
