/**
 * see https://gist.github.com/jawdatls/465d82f2158e1c4ce161
 * This function lets you get the greyscale color value from a specific point in an image
 * In this scenario, we pass in a displacement map as imageData,
 * and u/v values which gets translated to a certain point on the image
 * getting either one of r/g/b value as the displacement value is the same
 * since the image is supposed to be black and white
 *
 * @param {object} imageData the color data of the displacement map image to be passed in
 * @param {number} u the x position of the targeted pixel to get the displacement value from
 * @param {number} v the y position of the targeted pixel to get the displacement value from
 * @param {number} cvWidth the width of the heightmap image in canvas
 * @param {number} cvHeight the height of the heightmap image in canvas
 */
function getZFromImageDataPoint(imageData, u, v, cvWidth, cvHeight) {
  // return 0; // This is for debugging/testing purposes
  const mapWidth = cvWidth
  const mapHeight = cvHeight
  const displacementScale = 3.2
  var x = Math.round(u * (mapWidth - 1))
  var y = Math.round(v * (mapHeight - 1))
  var index = (y * imageData.width + x) * 4
  var red = imageData.data[index]
  return (red * displacementScale) / 255
}

/**
 * This function draws a particular(1-4) triangle that forms the rhombuses in the plane geometry
 * Triangle 1 & 2 form the 1st rhombus
 * Triangle 3 & 4 form the 2nd rhombus, which clings to the bottom-right face of the 1st rhombus
 * Calling this function 4 times within a 2D loop completes the pattern of a plane of rhombuses
 *
 * @param {number} triangle which triangle to draw, within range of 1-4 (so that 2 rhombuses are drawn)
 * @param {number} x the horizontal loop index
 * @param {number} y the vertical loop index
 * @param {array} vertices the array that stores the vertices in order
 * @param {number} radius the length from a vertex to the rhombus center
 * @param {number} maxWidth max width of the geometry
 * @param {number} maxHeight max height of the geometry
 * @param {number} height the length of the geometry
 * @param {number} cvWidth the width of the heightmap image in canvas
 * @param {number} cvHeight the height of the heightmap image in canvas
 * @param {object} imageData image data of the displacement map
 */
export const drawTriangleAsVertices = (triangle, x, y, vertices, radius, maxWidth, maxHeight, height, cvWidth, cvHeight, imageData) => {
  let offset = 0,
    vts_xy = []
  if (triangle === 3 || triangle === 4) {
    offset = radius
  }
  // origin at (0,0), left and top of the geometry
  // Build the 3 vertices depending on which triangle we're drawing
  if (triangle === 1 || triangle === 3) {
    vts_xy.push({
      x: 0 + x * 2 * radius + offset,
      y: 0 - radius - y * 2 * radius - offset
    }) // 1st triangle's initial val: (0, -radius)
    vts_xy.push({
      x: radius + x * 2 * radius + offset,
      y: -2 * radius - y * 2 * radius - offset
    }) // 1st triangle's initial val: (radius, -2 * radius)
    vts_xy.push({
      x: radius + x * 2 * radius + offset,
      y: 0 - y * 2 * radius - offset
    }) // 1st triangle's initial val: (radius, 0)
  }
  if (triangle === 2 || triangle === 4) {
    vts_xy.push({
      x: radius + x * 2 * radius + offset,
      y: 0 - y * 2 * radius - offset
    }) // 2nd triangle's initial val: (radius, 0)
    vts_xy.push({
      x: radius + x * 2 * radius + offset,
      y: -2 * radius - y * 2 * radius - offset
    }) // 2nd triangle's initial val: (radius, -2 * radius)
    vts_xy.push({
      x: 2 * radius + x * 2 * radius + offset,
      y: 0 - radius - y * 2 * radius - offset
    }) // 2nd triangle's initial val: (2 * radius, -radius)
  }

  // loop through the 3 vertices to form the triangle
  for (const vt_xy of vts_xy) {
    let vt_u = vt_xy.x / maxWidth
    let vt_v = 1 + vt_xy.y / maxHeight // since the latter operation gives negative value, and v value is 1 at the top of the map
    let vt_z
    // custom workaround logic to make the bottom vertices get the same Z value as the top vertices
    // add 0.1 buffer so as to make sure all vertices in the bottom row gets covered
    if (vt_xy.y < (-2 * radius * height + 0.1)) {
      let new_v = vt_v + 1 - radius / maxHeight
      vt_z = getZFromImageDataPoint(imageData, vt_u, new_v, cvWidth, cvHeight)
    } else {
      vt_z = getZFromImageDataPoint(imageData, vt_u, vt_v, cvWidth, cvHeight)
    }
    vertices.push({
      pos: [vt_xy.x, vt_xy.y, vt_z],
      uv: [vt_u, vt_v]
    })
  }
}
