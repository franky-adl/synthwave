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
 */
function getZFromImageDataPoint(imageData, u, v) {
  // return 0; // This is for debugging/testing purposes
  const mapWidth = 786
  const mapHeight = 1965
  const displacementScale = 3
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
 * @param {object} imageData image data of the displacement map
 */
export const drawTriangleAsVertices = (triangle, x, y, vertices, radius, maxWidth, maxHeight, imageData) => {
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

  // loop throught the 3 vertices to form the triangle
  for (const vt_xy of vts_xy) {
    let vt_u = vt_xy.x / maxWidth
    let vt_v = 1 + vt_xy.y / maxHeight // since the latter operation gives negative value, and v value is 1 at the top of the map
    let vt_z
    // custom workaround logic to make the bottom vertices get the same Z value as the top vertices
    // -28.1 is roughly = -2 * radius * 20, set it a bit higher so as to make sure all the in range vertices are included
    if (vt_xy.y < -70.6) {
      let new_v = vt_v + 1 - radius / maxHeight
      vt_z = getZFromImageDataPoint(imageData, vt_u, new_v)
    } else {
      vt_z = getZFromImageDataPoint(imageData, vt_u, vt_v)
    }
    vertices.push({
      pos: [vt_xy.x, vt_xy.y, vt_z],
      uv: [vt_u, vt_v]
    })
  }
}
