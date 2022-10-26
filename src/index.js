// Third-party deps
import * as THREE from "three"
import * as dat from 'dat.gui';
import Stats from "three/examples/jsm/libs/stats.module"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls"
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass"
import { RGBShiftShader } from "three/examples/jsm/shaders/RGBShiftShader"

// Your deps
import { createCamera, createComposer, createRenderer, getDefaultUniforms, setupApp } from "./core-utils";
import { setBackground } from "./common-utils"
import { drawTriangleAsVertices } from "./functions"
import Background from "./assets/stars-nebula.jpeg"
import HeightMap from "./assets/heightmap-12.png"
import SunTexture from "./assets/sun-texture-2.jpg"

global.THREE = THREE

// initialize core threejs components
let scene = new THREE.Scene()
let renderer = createRenderer({ antialias: true, alpha: true })
let camera = createCamera(75, 0.1, 100, { x: 0, y: 0, z: 2.4 })
let composer = createComposer(renderer, scene, camera, (comp) => {
  const rgbShiftPass = new ShaderPass(RGBShiftShader)
  rgbShiftPass.uniforms["amount"].value = 0.0015
  comp.addPass(rgbShiftPass)
})

// app/scene params
let guiOptions = {
  speed: 4
}
const radius = 1 / (2 * Math.cos(Math.PI / 4))
const width = 20
const height = 50
const maxWidth = (width + 0.5) * 2 * radius
const maxHeight = (height + 0.5) * 2 * radius
const initialPosOffset = maxHeight / 2
const lengthOfRepeat = maxHeight - radius
const meshMetalness = 0.99
const meshRoughness = 0.76
const meshColor = "#ffbc14"
const meshEmissive = "#009"
const lineColor = 0x4c93ff
const ambientColor = 0x000888
const directionalColor = 0xff1600
const sunColor = "#ff1655"
const sunHighColor = 0xffeb16
const fogColor = "#ff1655"
const lightDir = {
  x: 0,
  y: 1,
  z: -5.5
}

/**
 * Define the threejs app object that consists of at least the async initScene() function (it is async so the animate function can wait for initScene to finish before being called)
 * initScene is called after a basic threejs environment has been set up, you can add objects/lighting to you scene in that function
 * if your app needs to animate things(i.e. not static), include a updateScene(interval, elapsed) function as well
 */
let app = {
  vertexShader() {
    return `
      void main() {
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

      void main() {
        vec2 st = gl_FragCoord.xy/u_resolution.xy;

        gl_FragColor = vec4(vec3(0.0, st),1.0);
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

  // scene, renderer, composer, container and camera will have been defined as props of the app object by the time this is called
  async initScene() {
    // init loaders
    const textureLoader = new THREE.TextureLoader()

    // OrbitControls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true

    // Environment
    var bgImg = new Image()
    bgImg.onload = () => {
      this.scene.background = textureLoader.load(bgImg.src)
      setBackground(this.scene, bgImg.width, bgImg.height)
    }
    bgImg.src = Background
    // this.scene.background = new THREE.Color("#222222")

    // Lighting
    this.scene.add(new THREE.AmbientLight(ambientColor))
    let dLight = new THREE.DirectionalLight(directionalColor)
    dLight.position.set(lightDir.x, lightDir.y, lightDir.z)
    this.scene.add(dLight)

    // see: https://gist.github.com/jawdatls/465d82f2158e1c4ce161
    const img = await this.loadImage(HeightMap, (img) => {
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
            drawTriangleAsVertices(i, x, y, vertices, radius, maxWidth, maxHeight, imageData)
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

      // the sun
      const sungeom = new THREE.SphereGeometry(14, 64, 64)
      const sunText = textureLoader.load(SunTexture)
      const sunmat = new THREE.MeshBasicMaterial({
        map: sunText
      })
      // const sunmat = new THREE.MeshNormalMaterial()
      this.sun = new THREE.Mesh(sungeom, sunmat)
      this.scene.add(this.sun)
      this.sun.position.set(0, 8, -60)
      this.sun.rotation.x -= Math.PI / 2

      // the actual mesh of the plane geometry
      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(meshColor),
        emissive: new THREE.Color(meshEmissive),
        metalness: meshMetalness,
        roughness: meshRoughness,
        // roughnessMap: roughMap,
        polygonOffset: true,
        polygonOffsetFactor: 1, // positive value pushes polygon further away
        polygonOffsetUnits: 1
      })
      this.mesh = new THREE.Mesh(geometry, material)
      this.group.add(this.mesh)

      // wireframe mesh of the plane geometry
      var wfgeo = new THREE.WireframeGeometry(geometry)
      this.line = new THREE.LineSegments(wfgeo)
      this.line.material.color.setHex(lineColor)
      this.group.add(this.line)

      // set the correct pos and rot for both the terrain and its wireframe
      this.mesh.position.set(-radius * width, -1, -initialPosOffset)
      this.mesh.rotation.x -= Math.PI / 2
      this.line.position.set(-radius * width, -1, -initialPosOffset)
      this.line.rotation.x -= Math.PI / 2

      // copy another set of objects for the looping animation
      this.mesh2 = new THREE.Mesh(geometry, material)
      this.line2 = new THREE.LineSegments(wfgeo)
      this.line2.material.color.setHex(lineColor)
      // set the pos and rot
      this.mesh2.position.set(-radius * width, -1, -initialPosOffset - maxHeight + radius)
      this.mesh2.rotation.x -= Math.PI / 2
      this.line2.position.set(-radius * width, -1, -initialPosOffset - maxHeight + radius)
      this.line2.rotation.x -= Math.PI / 2
      this.group.add(this.mesh2)
      this.group.add(this.line2)

      this.scene.add(this.group)
      // debugging angles, to see if the gap is closed perfectly between the butt and the head
      // this.group.rotation.y -= Math.PI / 2
      // this.group.position.set(-15, 0, 4)
    })

    // GUI
    const gui = new dat.GUI()
    gui.add(guiOptions, "speed", 1, 10, 0.5)

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

    this.mesh.position.z = ((elapsed * guiOptions.speed) % lengthOfRepeat) - initialPosOffset
    this.line.position.z = ((elapsed * guiOptions.speed) % lengthOfRepeat) - initialPosOffset

    this.mesh2.position.z = ((elapsed * guiOptions.speed) % lengthOfRepeat) - initialPosOffset - maxHeight + radius
    this.line2.position.z = ((elapsed * guiOptions.speed) % lengthOfRepeat) - initialPosOffset - maxHeight + radius
  }
}

// App's only entrypoint
setupApp(app, scene, renderer, camera, true, getDefaultUniforms(), composer)
