// Third-party deps
import * as THREE from "three"
import * as dat from 'dat.gui';
import Stats from "three/examples/jsm/libs/stats.module"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls"
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass"
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry"
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial"
import { Line2 } from "three/examples/jsm/lines/Line2"

// Your deps
import { createCamera, createComposer, createRenderer, getDefaultUniforms, setupApp } from "./core-utils";
import { hexToRgb, maintainBgAspect } from "./common-utils"
import { getZFromImageDataPoint } from "./functions"
import Background from "./assets/Starfield.png"
import HeightMap3 from "./assets/heightmap.png"

global.THREE = THREE

// app/scene params
const guiOptions = {
  // scene params
  speed: 2.5,
  dirLightColor1: 0x2dd7ff,
  dirLightColor2: 0x2dd7ff,
  pixelize: false,
  // bloom params
  bloomStrength: 0.5,
  bloomRadius: 0.2,
  bloomThreshold: 0.5,
  // plane params
  metalness: 0.2,
  roughness: 0.7,
  meshColor: 0xffffff,
  meshEmissive: 0x000098,
  lineWidth: 0.04,
  lineColor: 0xcee4ff,
  // sun params
  topColor: 0xffab00,
  bottomColor: 0xff51c8
}
const uniforms = {
  ...getDefaultUniforms(),
  color_main: { // sun's top color
    value: {
      r: 1.0,
      g: 0.671,
      b: 0.0
    }
  },
  color_accent: { // sun's bottom color
    value: {
      r: 1.0,
      g: 0.318,
      b: 0.784
    }
  }
}
const terrainWidth = 30
const terrainHeight = 30
const loopInstances = 5
const lightPos1 = {
  x: 15,
  y: 1,
  z: 5
}
const lightIntensity1 = 0.85
const lightPos2 = {
  x: -15,
  y: 1,
  z: 5
}
const lightIntensity2 = 0.85

// initialize core threejs components
let scene = new THREE.Scene()

// deactivating antialias gives performance boost
// see https://threejs.org/manual/#en/cameras for why the need for logarithmicDepthBuffer
let renderer = createRenderer({ antialias: true, logarithmicDepthBuffer: true }, (rdr) => {
  // see https://discourse.threejs.org/t/renderer-info-render-triangles-always-on-0/28916
  rdr.info.autoReset = false
})

// create the camera with an extra layer, don't set a near value being too small (depth test could run out of precision units)
let camera = createCamera(70, 1, 110, { x: 0, y: 0, z: 2.4 })

// Post-processing with Bloom effect
let bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  guiOptions.bloomStrength,
  guiOptions.bloomRadius,
  guiOptions.bloomThreshold
);
let composer = createComposer(renderer, scene, camera, (comp) => {
  comp.addPass(bloomPass)
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
  loadImage(path) {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = "Anonymous" // to avoid CORS if used with Canvas
      img.src = path
      img.onload = () => {
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
    this.dirLight1 = new THREE.DirectionalLight(guiOptions.dirLightColor1, lightIntensity1)
    this.dirLight1.position.set(lightPos1.x, lightPos1.y, lightPos1.z)
    this.scene.add(this.dirLight1)
    this.dirLight2 = new THREE.DirectionalLight(guiOptions.dirLightColor2, lightIntensity2)
    this.dirLight2.position.set(lightPos2.x, lightPos2.y, lightPos2.z)
    this.scene.add(this.dirLight2)

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

    // create a set of objects according to each heightmap
    let planeGeometries = []
    let lineGeometries = []
    let geometryPositionsArray = []
    for (let i = 0; i < 2; i++) {
      // see: https://gist.github.com/jawdatls/465d82f2158e1c4ce161
      // load heightmap to a new image and read color data to set the heights of our plane vertices
      let hm_image = await this.loadImage(HeightMap3)

      var canvas = document.createElement("canvas")
      canvas.width = hm_image.width
      canvas.height = hm_image.height

      var context = canvas.getContext("2d")
      context.drawImage(hm_image, 0, 0)
      var hm_imageData = context.getImageData(0, 0, canvas.width, canvas.height)

      // Create a PlaneGeom
      let planeGeometry = new THREE.PlaneGeometry(terrainWidth, terrainHeight, terrainWidth, terrainHeight)

      let geometryPositions = planeGeometry.getAttribute("position").array
      let geometryUVs = planeGeometry.getAttribute("uv").array

      // The vertices are ordered in the array by their numbers in ascending order, see https://hofk.de/main/discourse.threejs/2022/THREEn/NumberingHelperExamples.html
      for (let index = 0; index < geometryUVs.length / 2; index++) {
        let vertexU = geometryUVs[index * 2]
        let vertexV = geometryUVs[index * 2 + 1]
        // Update the z positions according to height map
        let terrainHeight = getZFromImageDataPoint(hm_imageData, (i == 0 ? vertexU : 1 - vertexU), vertexV, canvas.width, canvas.height)
        geometryPositions[index * 3 + 2] = terrainHeight
      }
      // skew the plane geometry
      const shearMtx = new THREE.Matrix4()
      shearMtx.makeShear(-0.5, 0, 0, 0, 0, 0)
      planeGeometry.applyMatrix4(shearMtx)

      planeGeometries.push(planeGeometry)
      geometryPositionsArray.push(geometryPositions)
    }
    // zip up the gaps between the two planeGeometries
    for (let index = 0; index <= terrainWidth; index++) {
      let bottomOffset = (terrainWidth + 1) * terrainHeight
      // 2nd geom's bottom row height should be synced with 1st geom's top
      geometryPositionsArray[1][(bottomOffset + index) * 3 + 2] = geometryPositionsArray[0][index * 3 + 2]
      // 1st geom's bottom row height should be synced with 2nd geom's top
      geometryPositionsArray[0][(bottomOffset + index) * 3 + 2] = geometryPositionsArray[1][index * 3 + 2]
    }
    // recalculate vertex normals after all z position changes
    for (let i = 0; i < 2; i++) {
      planeGeometries[i].computeVertexNormals()
    }

    // create the line geometries for the neon lines
    for (let i = 0; i < 2; i++) {
      // the grid lines, reference: https://threejs.org/examples/?q=line#webgl_lines_fat
      let lineGeometry = new LineGeometry()
      let linePositions = []
      for (let row = 0; row < terrainHeight; row++) {
        let isEvenRow = row % 2 == 0
        for (let col = (isEvenRow ? 0 : (terrainWidth - 1)); isEvenRow ? (col < terrainWidth) : (col >= 0); isEvenRow ? col++ : col--) {
          for (let point = (isEvenRow ? 0 : 3); isEvenRow ? (point < 4) : (point >= 0); isEvenRow ? point++ : point--) {
            // This is a specific way to map line points to cooresponding vertices of the planeGeometry
            let mappedIndex
            let rowOffset = row * (terrainWidth + 1)
            if (point < 2) {
              mappedIndex = rowOffset + col + point
            } else {
              mappedIndex = rowOffset + col + point + terrainWidth - 1
            }

            linePositions.push(geometryPositionsArray[i][(mappedIndex) * 3])
            linePositions.push(geometryPositionsArray[i][(mappedIndex) * 3 + 1])
            linePositions.push(geometryPositionsArray[i][(mappedIndex) * 3 + 2])
          }
        }
      }
      lineGeometry.setPositions(linePositions)

      lineGeometries.push(lineGeometry)
    }

    this.group = new THREE.Group()
    this.groupLines = new THREE.Group()

    // the material of the plane geometry
    this.meshMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(guiOptions.meshColor),
      emissive: new THREE.Color(guiOptions.meshEmissive),
      metalness: guiOptions.metalness,
      roughness: guiOptions.roughness,
      flatShading: true
    })
    // the material for the neon lines
    this.lineMaterial = new LineMaterial({
      color: guiOptions.lineColor,
      linewidth: guiOptions.lineWidth, // in world units with size attenuation, pixels otherwise
      alphaToCoverage: false,
      worldUnits: true // such that line width depends on world distance
    })

    this.meshGroup = []
    this.lineGroup = []
    // clone the remaining instances
    for (let i = 0; i < loopInstances; i++) {
      // create the meshes
      let mesh = new THREE.Mesh(planeGeometries[i % 2], this.meshMaterial)
      let line = new Line2(lineGeometries[i % 2], this.lineMaterial)
      line.computeLineDistances()
      // set the correct pos and rot for both the terrain and its wireframe
      mesh.position.set(0, -1.5, -terrainHeight * i)
      mesh.rotation.x -= Math.PI / 2
      line.position.set(0, -1.5, -terrainHeight * i)
      line.rotation.x -= Math.PI / 2
      // add the meshes to the group and arrays
      this.group.add(mesh)
      this.groupLines.add(line)
      this.meshGroup.push(mesh)
      this.lineGroup.push(line)
    }

    // // add the bunch of mesh instances to the scene
    scene.add(this.group)
    scene.add(this.groupLines)


    // GUI
    const gui = new dat.GUI()

    gui.add(guiOptions, "speed", 1, 10, 0.5)
    gui.addColor(guiOptions, 'dirLightColor1').name('Dir light 1').onChange((val) => {
      this.dirLight1.color.set(val)
    })
    gui.addColor(guiOptions, 'dirLightColor2').name('Dir light 2').onChange((val) => {
      this.dirLight2.color.set(val)
    })
    gui.add(guiOptions, "pixelize").onChange((val) => {
      this.composer.setPixelRatio(targetPixelRatio * (val ? 0.2 : 1))
    })

    let bloomFolder = gui.addFolder(`Bloom`)
    bloomFolder.add(guiOptions, "bloomStrength", 0, 3, 0.05).onChange((val) => {
      bloomPass.strength = Number(val)
    })
    bloomFolder.add(guiOptions, "bloomRadius", 0, 1, 0.05).onChange((val) => {
      bloomPass.radius = Number(val)
    })
    bloomFolder.add(guiOptions, "bloomThreshold", 0, 1, 0.05).onChange((val) => {
      bloomPass.threshold = Number(val)
    })

    let planeFolder = gui.addFolder(`Plane`)
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
    planeFolder.addColor(guiOptions, 'lineColor').name('line color').onChange((val) => {
      this.lineMaterial.color.set(val)
    })
    planeFolder.add(guiOptions, "lineWidth", 0, 0.1, 0.01).name('line width').onChange((val) => {
      this.lineMaterial.linewidth = val
    })

    let sunFolder = gui.addFolder(`Sun`)
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
      this.meshGroup[i].position.z += interval * guiOptions.speed
      this.lineGroup[i].position.z += interval * guiOptions.speed
      if (this.meshGroup[i].position.z >= terrainHeight) {
        this.meshGroup[i].position.z -= loopInstances * terrainHeight
        this.lineGroup[i].position.z -= loopInstances * terrainHeight
      }
    }
  }
}

// App's only entrypoint
setupApp(app, scene, renderer, camera, true, uniforms, composer)
