const presets = require('./presets');
const kernels = require('./kernels');

const Generator = require("./generator");
const choo = require("choo");
const createGeneratorModel = require("./models/texture_generator");
const app = choo();


app.router("/",
           (route) => [
               
               route('/', require('./views/main'), [
                   route('/about', require('./views/about')),
               ])
           ]);


window.startApp = () => {
    const texGen = Generator({
        canvasId: "c",
        resolution: 256
    });
    app.model(createGeneratorModel(texGen, presets, kernels));  

    const tree = app.start();
    document.body.appendChild(tree);
};
