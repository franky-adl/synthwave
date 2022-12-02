/**
 * see https://gist.github.com/jawdatls/465d82f2158e1c4ce161
 * This function lets you get the greyscale color value from a specific point in an image
 * In this scenario, we pass in a displacement map as imageData,
 * and u/v values which gets translated to a certain point on the image
 * getting either one of r/g/b value as the displacement value is the same
 * since the image is supposed to be black and white
 * note that the v axis in texture data is the inverse of the y axis in image data
 *
 * @param {object} imageData the color data of the displacement map image to be passed in
 * @param {number} u the x position of the targeted pixel to get the displacement value from
 * @param {number} v the y position of the targeted pixel to get the displacement value from
 * @param {number} cvWidth the width of the heightmap image in canvas
 * @param {number} cvHeight the height of the heightmap image in canvas
 */
export function getZFromImageDataPoint(imageData, u, v, cvWidth, cvHeight) {
  // return 0; // This is for debugging/testing purposes
  const mapWidth = cvWidth
  const mapHeight = cvHeight
  const displacementScale = 5
  var x = Math.round(u * (mapWidth - 1))
  var y = Math.round((1 - v) * (mapHeight - 1))
  var index = (y * imageData.width + x) * 4
  var red = imageData.data[index]
  return (red * displacementScale) / 255
}
