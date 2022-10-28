// Third-party deps
import * as THREE from "three"
import * as dat from 'dat.gui';
import Stats from "three/examples/jsm/libs/stats.module"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls"
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass"
import { RGBShiftShader } from "three/examples/jsm/shaders/RGBShiftShader"

// Your deps
import { createCamera, createComposer, createRenderer, getDefaultUniforms, setupApp } from "./core-utils";
import { hexToRgb, maintainBgAspect } from "./common-utils"
import { drawTriangleAsVertices } from "./functions"
import Background from "./assets/stars-nebula.jpeg"
import HeightMap from "./assets/heightmap-20x20.jpg"

global.THREE = THREE

// app/scene params
const guiOptions = {
  // scene params
  speed: 4,
  ambientColor: 0x000888,
  directionalColor: 0xff1600,
  rgbShiftAmount: 0.002,
  // plane params
  metalness: 0.99,
  roughness: 0.76,
  meshColor: 0xffbc14,
  meshEmissive: 0x000099,
  lineColor: 0x4c93ff,
  // sun params
  topColor: 0xff18ff,
  bottomColor: 0xffd81a
}
const uniforms = {
  ...getDefaultUniforms(),
  color_main: { // sun's top color
    value: {
      r: 1.0,
      g: 0.095,
      b: 1.0
    }
  },
  color_accent: { // sun's bottom color
    value: {
      r: 1.0,
      g: 0.847,
      b: 0.1
    }
  }
}
const radius = 1 / (2 * Math.cos(Math.PI / 4))
const width = 20
const height = 20
const loopInstances = 5
const maxWidth = (width + 0.5) * 2 * radius
const maxHeight = (height + 0.5) * 2 * radius
const initialPosOffset = maxHeight / 2
const lengthOfRepeat = maxHeight - radius
const lightDir = {
  x: 0,
  y: 1,
  z: -5.5
}

// initialize core threejs components
let scene = new THREE.Scene()
let renderer = createRenderer({ antialias: true, alpha: true })
let camera = createCamera(75, 0.1, 110, { x: 0, y: 0, z: 2.4 })
let rgbShiftPass = new ShaderPass(RGBShiftShader)
let composer = createComposer(renderer, scene, camera, (comp) => {
  rgbShiftPass.uniforms["amount"].value = guiOptions.rgbShiftAmount
  comp.addPass(rgbShiftPass)
})

/**
 * Define the threejs app object that consists of at least the async initScene() function (it is async so the animate function can wait for initScene to finish before being called)
 * initScene is called after a basic threejs environment has been set up, you can add objects/lighting to you scene in that function
 * if your app needs to animate things(i.e. not static), include a updateScene(interval, elapsed) function as well
 */
let app = {
  vertexShader() {
    return `
      varying vec2 vUv;
      varying vec3 vPos;

      void main() {
        vUv = uv;
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); 
      }
      `
  },
  fragmentShader() {
    return `
      #ifdef GL_ES
      precision mediump float;
      #endif

      #define PI 3.14159265359
      #define TWO_PI 6.28318530718
      
      uniform vec2 u_resolution;
      uniform vec2 u_mouse;
      uniform float u_time;
      uniform vec3 color_main;
      uniform vec3 color_accent;
      varying vec2 vUv;
      varying vec3 vPos;

      void main() {
        vec2 st = gl_FragCoord.xy/u_resolution.xy;

        // TODO: explain the following calculations + attach graphtoy example
        float x = vPos.y;
        float osc = ceil(sin((3. - (x - u_time) / 1.5) * 5.) / 2. + 0.4 - floor((3. - x / 1.5) * 5. / TWO_PI) / 10.);
        vec3 color = mix(color_accent, color_main, smoothstep(0.2, 1., vUv.y));
        gl_FragColor = vec4(color, osc);
      }
      `
  },
  // set up objects in the scene only after the image is loaded
  // because the code builds the vertexes from the loaded heightmap image
  // so that we can use computeVertexNormals afterwards
  // (normals aren't calculated for you if you use displacementMap property in the MeshStandardMaterial directly)
  loadImage(path, onload) {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = "Anonymous" // to avoid CORS if used with Canvas
      img.src = path
      img.onload = () => {
        onload(img)
        resolve(img)
      }
      img.onerror = (e) => {
        reject(e)
      }
    })
  },

  // The Image.prototype.onload property is not a promise,
  // if you want to chain events after image is loaded, should return a Promise for an await expression
  // need to pass scene instead of using this.scene since the scope of this isn't the parent scope
  loadSceneBackground(scene) {
    return new Promise((resolve, reject) => {
      var loader = new THREE.TextureLoader();
      loader.load(Background, function (texture) {
        scene.background = texture
        maintainBgAspect(scene, texture.image.width, texture.image.height)
        resolve()
      }, undefined, function (error) {
        console.log(error)
        reject(error)
      });
    })
  },

  // scene, renderer, composer, container and camera will have been defined as props of the app object by the time this is called
  async initScene() {
    // OrbitControls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true

    // Environment
    await this.loadSceneBackground(this.scene)

    // Lighting
    this.ambientLight = new THREE.AmbientLight(guiOptions.ambientColor)
    this.scene.add(this.ambientLight)
    this.dirLight = new THREE.DirectionalLight(guiOptions.directionalColor)
    this.dirLight.position.set(lightDir.x, lightDir.y, lightDir.z)
    this.scene.add(this.dirLight)

    // the sun
    const sungeom = new THREE.SphereGeometry(30, 64, 64)
    const sunmat = new THREE.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: this.vertexShader(),
      fragmentShader: this.fragmentShader(),
      transparent: true
    })
    this.sun = new THREE.Mesh(sungeom, sunmat)
    this.scene.add(this.sun)
    this.sun.position.set(0, 16, -100)

    // see: https://gist.github.com/jawdatls/465d82f2158e1c4ce161
    // load heightmap to a new image and read color data to build our buffer geometry
    await this.loadImage(HeightMap, (img) => {
      var canvas = document.createElement("canvas")
      canvas.width = img.width
      canvas.height = img.height
      console.log(canvas.width, canvas.height)

      var context = canvas.getContext("2d")
      context.drawImage(img, 0, 0)

      var imageData = context.getImageData(0, 0, canvas.width, canvas.height)

      // Build the vertices
      const vertices = []
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          for (let i = 1; i <= 4; i++) {
            // triangle 1-4
            drawTriangleAsVertices(i, x, y, vertices, radius, maxWidth, maxHeight, height, canvas.width, canvas.height, imageData)
          }
        }
      }

      // set up the BufferGeometry from vertices
      const positions = []
      const uvs = []
      for (const vertex of vertices) {
        positions.push(...vertex.pos)
        uvs.push(...vertex.uv)
      }
      const geometry = new THREE.BufferGeometry()
      const positionNumComponents = 3
      const uvNumComponents = 2
      geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positions), positionNumComponents))
      geometry.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(uvs), uvNumComponents))
      // calculate the normals from positions so we don't have to calculate ourselves
      geometry.computeVertexNormals()

      this.group = new THREE.Group()

      // the material of the plane geometry
      this.meshMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color(guiOptions.meshColor),
        emissive: new THREE.Color(guiOptions.meshEmissive),
        metalness: guiOptions.metalness,
        roughness: guiOptions.roughness,
        polygonOffset: true,
        polygonOffsetFactor: 1, // positive value pushes polygon further away
        polygonOffsetUnits: 1
      })
      // wireframe of the plane geometry
      var wfgeo = new THREE.WireframeGeometry(geometry)
      this.lineMaterial = new THREE.LineBasicMaterial({
        color: guiOptions.lineColor,
        linewidth: 1, // probably ignored by WebGLRenderer
        linecap: 'round', //ignored by WebGLRenderer
        linejoin: 'round' //ignored by WebGLRenderer
      })

      this.meshGroup = []
      this.lineGroup = []
      // clone the remaining instances
      for (let i = 0; i < loopInstances; i++) {
        // create the meshes
        let mesh = new THREE.Mesh(geometry, this.meshMaterial)
        let line = new THREE.LineSegments(wfgeo, this.lineMaterial)
        // set the correct pos and rot for both the terrain and its wireframe
        mesh.position.set(-radius * width, -1, -initialPosOffset - maxHeight * i + radius * i)
        mesh.rotation.x -= Math.PI / 2
        line.position.set(-radius * width, -1, -initialPosOffset - maxHeight * i + radius * i)
        line.rotation.x -= Math.PI / 2
        // add the meshes to the group and arrays
        this.group.add(mesh)
        this.group.add(line)
        this.meshGroup.push(mesh)
        this.lineGroup.push(line)
      }

      // add the bunch of mesh instances to the scene
      this.scene.add(this.group)

      // debugging angles, to see if the gap is closed perfectly between the butt and the head
      // this.group.rotation.y -= Math.PI / 2
      // this.group.position.set(-15, 0, 4)
    })

    // GUI
    const gui = new dat.GUI()

    gui.add(guiOptions, "speed", 1, 10, 0.5)
    gui.addColor(guiOptions, 'ambientColor').name('ambient color').onChange((val) => {
      this.ambientLight.color.set(val)
    })
    gui.addColor(guiOptions, 'directionalColor').name('sunlight color').onChange((val) => {
      this.dirLight.color.set(val)
    })
    gui.add(guiOptions, "rgbShiftAmount", 0, 0.01, 0.0005).onChange((val) => {
      rgbShiftPass.uniforms["amount"].value = val
    })

    planeFolder = gui.addFolder(`Plane`)
    planeFolder.add(guiOptions, "metalness", 0, 1, 0.05).onChange((val) => {
      this.meshMaterial.metalness = val
    })
    planeFolder.add(guiOptions, "roughness", 0, 1, 0.05).onChange((val) => {
      this.meshMaterial.roughness = val
    })
    planeFolder.addColor(guiOptions, 'meshColor').name('color').onChange((val) => {
      this.meshMaterial.color.set(val)
    })
    planeFolder.addColor(guiOptions, 'meshEmissive').name('emissive').onChange((val) => {
      this.meshMaterial.emissive.set(val)
    })
    planeFolder.addColor(guiOptions, 'lineColor').name('wireframe color').onChange((val) => {
      this.lineMaterial.color.set(val)
    })

    sunFolder = gui.addFolder(`Sun`)
    sunFolder.addColor(guiOptions, 'topColor').name('top color').onChange((val) => {
      let clr = new THREE.Color(val)
      uniforms.color_main.value = hexToRgb(clr.getHexString(), true)
    })
    sunFolder.addColor(guiOptions, 'bottomColor').name('bottom color').onChange((val) => {
      let clr = new THREE.Color(val)
      uniforms.color_accent.value = hexToRgb(clr.getHexString(), true)
    })

    // Stats - show fps
    this.stats1 = new Stats()
    this.stats1.showPanel(0) // Panel 0 = fps
    this.stats1.domElement.style.cssText = "position:absolute;top:0px;left:0px;"
    this.container.appendChild(this.stats1.domElement)
  },
  // @param {number} interval - time elapsed between 2 frames
  // @param {number} elapsed - total time elapsed since app start
  updateScene(interval, elapsed) {
    this.controls.update()
    this.stats1.update()

    for (let i = 0; i < loopInstances; i++) {
      this.meshGroup[i].position.z = ((elapsed * guiOptions.speed) % lengthOfRepeat) - initialPosOffset - maxHeight * i + radius * i
      this.lineGroup[i].position.z = ((elapsed * guiOptions.speed) % lengthOfRepeat) - initialPosOffset - maxHeight * i + radius * i
    }
  }
}

// App's only entrypoint
setupApp(app, scene, renderer, camera, true, uniforms, composer)
