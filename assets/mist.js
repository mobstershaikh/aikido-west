/* Mist: layered value-noise fog drifting slowly across the hero. Plain WebGL, no dependencies. */
window.Mist = function (canvas, opts) {
  opts = opts || {};
  var gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false });
  if (!gl) return null;
  var vs = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
  var fs = [
    'precision highp float;uniform vec2 r;uniform float t;uniform vec2 m;',
    'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
    'float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}',
    'float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}',
    'void main(){vec2 uv=gl_FragCoord.xy/r;vec2 p=uv*vec2(r.x/r.y,1.)*1.5;',
    'vec2 d=vec2(t*.011,t*.0035)+m*.05;',
    'float warp=fbm(p*.7-d*.5);',
    'float n=fbm(p+d+warp*.65);',
    'float low=smoothstep(.0,.6,1.-uv.y);',
    'float high=smoothstep(.55,1.,uv.y)*.25;',
    'float mist=smoothstep(.38,.86,n)*(low+high);',
    'vec3 col=vec3(.84,.87,.92);',
    'gl_FragColor=vec4(col*mist,mist);}'
  ].join('\n');
  function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; }
  var prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(prog); gl.useProgram(prog);
  var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  var a = gl.getAttribLocation(prog, 'a'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
  var ur = gl.getUniformLocation(prog, 'r'), ut = gl.getUniformLocation(prog, 't'), um = gl.getUniformLocation(prog, 'm');
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  var mx = 0, my = 0, tx = 0, ty = 0, running = true, start = performance.now();
  function size() { var s = 0.5; var w = Math.max(2, Math.floor(canvas.clientWidth * s)), h = Math.max(2, Math.floor(canvas.clientHeight * s)); if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; } gl.viewport(0, 0, w, h); }
  function frame(now) {
    if (!running) return;
    size();
    mx += (tx - mx) * 0.015; my += (ty - my) * 0.015;
    gl.uniform2f(ur, canvas.width, canvas.height);
    gl.uniform1f(ut, opts.reduce ? 40 : (now - start) / 1000);
    gl.uniform2f(um, mx, my);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    if (!opts.reduce) requestAnimationFrame(frame);
  }
  if (!opts.reduce) {
    window.addEventListener('pointermove', function (e) { var b = canvas.getBoundingClientRect(); tx = (e.clientX - b.left) / b.width - 0.5; ty = 0.5 - (e.clientY - b.top) / b.height; }, { passive: true });
  }
  requestAnimationFrame(frame);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { es.forEach(function (e) { var was = running; running = e.isIntersecting; if (running && !was && !opts.reduce) requestAnimationFrame(frame); }); }).observe(canvas);
  }
  return { pause: function () { running = false; }, resume: function () { if (!running) { running = true; requestAnimationFrame(frame); } } };
};
