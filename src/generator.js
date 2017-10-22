var GLUtils = {
  // GL -> ProgramType -> DOM ID -> Shader
  compileShader: function(gl, programType, domId) {
    var shaderScript = document.getElementById(domId),
        shaderSource = shaderScript.text,
        shader = gl.createShader(programType);
    gl.shaderSource(shader, shaderSource);
    gl.compileShader(shader);
    var success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if (!success) {
      throw "could not compile shader:" + gl.getShaderInfoLog(shader);
    }
    return shader
  },
  // GL -> Shader -> Shader -> Program
  makeProgram: function(gl, vertexShader, fragmentShader) {
    var program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    return program;
  },
  // GL -> Program -> Void
  linkProgram: function(gl, program) {
    gl.linkProgram(program);
    var success = gl.getProgramParameter(program, gl.LINK_STATUS);
    if (!success) {
      throw ("program failed to link:" + gl.getProgramInfoLog (program));
    }
    gl.useProgram(program);
  }
}

function createAndSetupTexture(gl) {
  var texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

  return texture;
}


function randomCanvas(size) {
  var canvas = document.createElement("canvas"),
      ctx = canvas.getContext('2d');

  canvas.width = size;
  canvas.height = size;

  var imgdata = ctx.createImageData(canvas.width, canvas.height),
      data = imgdata.data;

  for (var i = 0; i < data.length; i += 4) {
    data[i] = Math.random() * 255;
    data[i + 1] = Math.random() * 255;
    data[i + 2] = Math.random() * 255;
    data[i + 3] = 255;
  }
  ctx.putImageData(imgdata, 0, 0);
  return canvas;
}


function TextureGenerator(options) {

  var options = options || {},
      canvas = document.getElementById(options.canvasId || 'c'),
      isRunning = true,
      resolution = options.resolution || 512;
  
  canvas.width = resolution;
  canvas.height = resolution;

  var gl = canvas.getContext('experimental-webgl'),
      buffer = gl.createBuffer(),
      convolveShader = GLUtils.compileShader(gl, gl.FRAGMENT_SHADER, '2d-fragment-shader'),
      vertexShader = GLUtils.compileShader(gl, gl.VERTEX_SHADER, '2d-vertex-shader'),

      hsvShader = GLUtils.compileShader(gl, gl.FRAGMENT_SHADER, '2d-hsv-shader'),
      hsvVertexShader = GLUtils.compileShader(gl, gl.VERTEX_SHADER, '2d-vertex-shader'),
      hsvProgram = GLUtils.makeProgram(gl, hsvVertexShader, hsvShader),
      
      rgbhsvShader = GLUtils.compileShader(gl, gl.FRAGMENT_SHADER, '2d-hsv-rgb-shader'),
      rgbhsvVertexShader = GLUtils.compileShader(gl, gl.VERTEX_SHADER, '2d-vertex-shader'),
      rgbhsvProgram = GLUtils.makeProgram(gl, rgbhsvVertexShader, rgbhsvShader),

      program = GLUtils.makeProgram(gl, vertexShader, convolveShader),
      currentFbo = 0,
      originalImageTexture = createAndSetupTexture(gl),
      textures = [],
      framebuffers = [];

  
  for (var ii = 0; ii < 2; ++ii) {
    var texture = createAndSetupTexture(gl),
        fbo = gl.createFramebuffer();
    textures.push(texture);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA, resolution, resolution, 0,
      gl.RGBA, gl.UNSIGNED_BYTE, null);
    framebuffers.push(fbo);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  }

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, originalImageTexture);

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1.0, -1.0,
                      1.0, -1.0,
                     -1.0,  1.0,
                     -1.0,  1.0,
                      1.0, -1.0,
                      1.0,  1.0]),
    gl.STATIC_DRAW
  );

  GLUtils.linkProgram(gl, program);

  gl.useProgram(program);

  gl.enableVertexAttribArray(gl.getAttribLocation(program, "a_position"));
  gl.vertexAttribPointer(gl.getAttribLocation(program, "a_position"), 2, gl.FLOAT, false, 0, 0);
  gl.uniform1i(gl.getUniformLocation(program, "uSampler"), 0);
  gl.uniform1f(gl.getUniformLocation(program, "canvasPixels"), parseFloat(resolution));

  GLUtils.linkProgram(gl, hsvProgram);

  gl.useProgram(hsvProgram);
  gl.uniform1i(gl.getUniformLocation(hsvProgram, "uSampler"), 0);
  gl.uniform1f(gl.getUniformLocation(hsvProgram, "canvasPixels"), parseFloat(resolution));

  GLUtils.linkProgram(gl, rgbhsvProgram);

  gl.useProgram(rgbhsvProgram);
  gl.uniform1i(gl.getUniformLocation(rgbhsvProgram, "uSampler"), 0);
  gl.uniform1f(gl.getUniformLocation(rgbhsvProgram, "canvasPixels"), parseFloat(resolution));

  gl.viewport(0, 0, canvas.width, canvas.height);
  reset();  

  function drawWithKernel(filter) {
    gl.useProgram(program);
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffers[currentFbo]);
    gl.uniform1fv(gl.getUniformLocation(program, "kernel"), filter);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindTexture(gl.TEXTURE_2D, textures[currentFbo]);
    currentFbo = (currentFbo + 1) % 2;
  }

  function drawWithProgram(prog) {
    gl.useProgram(prog == "hsv" ? hsvProgram : rgbhsvProgram)
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffers[currentFbo]);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindTexture(gl.TEXTURE_2D, textures[currentFbo]);
    currentFbo = (currentFbo + 1) % 2;
  }
  
  function reset() {
    gl.texImage2D(
      gl.TEXTURE_2D, 0,
      gl.RGBA, gl.RGBA,
      gl.UNSIGNED_BYTE,
      randomCanvas(resolution)
        .getContext('2d')
        .getImageData(0, 0, resolution, resolution))
  }
  return {
    isRunning: isRunning,
    reset: reset,
    
    hide: function() {
      canvas.style.visibility = "hidden";
    },
    
    show: function() {
      canvas.style.visibility = "visible";
    },
    drawWithProgram,
    drawWithKernel,
    render: function() {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    },
    canvas: canvas
  }
}

module.exports = TextureGenerator;
